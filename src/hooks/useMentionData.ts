import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Mention } from '@/types/mention';

interface UseMentionDataResult {
  mention: Mention | null;
  isLoading: boolean;
  error: string | null;
}

// In-memory cache
const cache = new Map<string, { mention: Mention; timestamp: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const inFlightRequests = new Map<string, Promise<Mention | null>>();

export function useMentionData(mentionId: string | null): UseMentionDataResult {
  const [mention, setMention] = useState<Mention | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!mentionId) {
      setMention(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache
    const cached = cache.get(mentionId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setMention(cached.mention);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check if request already in flight
    const inFlight = inFlightRequests.get(mentionId);
    if (inFlight) {
      setIsLoading(true);
      inFlight
        .then((result) => {
          setMention(result);
          setIsLoading(false);
          setError(null);
        })
        .catch((err) => {
          setError(err.message);
          setIsLoading(false);
        });
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchMention = async (): Promise<Mention | null> => {
      try {
        const { data, error: fetchError } = await (supabase as any)
          .schema('maps')
          .from('pins')
          .select(`
            id,
            lat,
            lng,
            description,
            image_url,
            video_url,
            media_type,
            account_id,
            collection_id,
            mention_type_id,
            visibility,
            archived,
            post_date,
            created_at,
            updated_at,
            view_count,
            full_address,
            map_meta,
            accounts(
              id,
              username,
              first_name,
              image_url,
              plan
            ),
            collections(
              id,
              emoji,
              title
            ),
            mention_type:mention_types(
              id,
              emoji,
              name
            )
            `)
            .eq('id', mentionId)
            .eq('archived', false)
            .eq('is_active', true)
            .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        if (!data) {
          throw new Error('Mention not found');
        }

        const transformedMention = {
          ...data,
          account: data.accounts,
          collection: data.collections,
        } as unknown as Mention;

        // Cache result
        cache.set(mentionId, { mention: transformedMention, timestamp: Date.now() });
        inFlightRequests.delete(mentionId);

        if (!abortController.signal.aborted) {
          setMention(transformedMention);
          setIsLoading(false);
          setError(null);
        }
        return transformedMention;
      } catch (err: any) {
        inFlightRequests.delete(mentionId);
        if (err.name === 'AbortError') {
          return null;
        }
        if (!abortController.signal.aborted) {
          setError(err.message || 'Failed to fetch mention');
          setIsLoading(false);
        }
        return null;
      }
    };

    const promise = fetchMention();
    inFlightRequests.set(mentionId, promise);

    return () => {
      abortController.abort();
    };
  }, [mentionId]);

  return { mention, isLoading, error };
}
