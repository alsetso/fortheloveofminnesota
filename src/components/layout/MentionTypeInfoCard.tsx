'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

type MentionType = { id: string; emoji: string; name: string };

interface MentionTypeInfoCardProps {
  /** URL type param (slug). Used to resolve id/name/emoji and open contribute with that type. */
  typeSlug: string;
}

/**
 * Footer card shown when a mention type filter is selected and contribute overlay is not open.
 * Renders "Add [Type Name] to map" and opens contribute with that type on click.
 */
export default function MentionTypeInfoCard({ typeSlug }: MentionTypeInfoCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabaseClient();
  const { account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account || activeAccountId);
  const [type, setType] = useState<MentionType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!typeSlug) {
      setType(null);
      setLoading(false);
      return;
    }
    const resolve = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true);

        if (error) throw error;
        const all = (data || []) as MentionType[];
        const match = all.find((t) => mentionTypeNameToSlug(t.name) === typeSlug);
        setType(match ?? null);
      } catch (err) {
        console.error('Failed to resolve mention type:', err);
        setType(null);
      } finally {
        setLoading(false);
      }
    };
    resolve();
  }, [typeSlug, supabase]);

  const handleAddToMap = () => {
    if (!type) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('type', mentionTypeNameToSlug(type.name));
    const qs = params.toString();
    router.push(qs ? `/maps?${qs}` : '/maps');
  };

  if (loading || !type) return null;

  const handleButtonClick = () => {
    if (isAuthenticated) {
      handleAddToMap();
    } else {
      openWelcome();
    }
  };

  return (
    <div
      className="p-[10px] border-b border-border bg-surface"
      data-container="mention-type-info-card"
      aria-label={`Add ${type.name} to map`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base flex-shrink-0" aria-hidden>
          {type.emoji}
        </span>
        <span className="text-xs font-medium text-foreground truncate flex-1">{type.name}</span>
      </div>
      {isAuthenticated ? (
        <button
          type="button"
          onClick={handleAddToMap}
          className="mt-2 flex items-center justify-center gap-1.5 max-w-fit py-1.5 px-2 text-xs font-medium text-foreground bg-surface border border-border rounded-md hover:bg-surface-accent transition-colors"
          aria-label={`Add ${type.name} to map`}
        >
          <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
          Add {type.name} to map
        </button>
      ) : (
        <button
          type="button"
          onClick={openWelcome}
          className="mt-2 flex items-center justify-center gap-1.5 max-w-fit py-1.5 px-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          aria-label="Sign in to see all events"
        >
          <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
          Sign in to see all events
        </button>
      )}
    </div>
  );
}
