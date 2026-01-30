'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';

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
    params.set('mention_type_id', type.id);
    const qs = params.toString();
    router.push(`/live?${qs}#contribute`);
  };

  if (loading || !type) return null;

  return (
    <div
      className="p-3 border-b border-gray-200 bg-white"
      data-container="mention-type-info-card"
      aria-label={`Add ${type.name} to map`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base flex-shrink-0" aria-hidden>
          {type.emoji}
        </span>
        <span className="text-xs font-medium text-gray-900 truncate flex-1">{type.name}</span>
      </div>
      <button
        type="button"
        onClick={handleAddToMap}
        className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 px-2 text-xs font-medium text-gray-900 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
        aria-label={`Add ${type.name} to map`}
      >
        <MapIcon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
        Add {type.name} to map
      </button>
    </div>
  );
}
