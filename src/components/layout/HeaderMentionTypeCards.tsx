'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';

type MentionType = { id: string; emoji: string; name: string };

/**
 * Compact horizontal row of mention type chips for the app header.
 * Single-select filter: sets ?type=<slug> to filter map pins; selected chip shows filled style.
 */
export default function HeaderMentionTypeCards() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loading, setLoading] = useState(true);

  const typeSlugFromUrl = searchParams.get('type');

  useEffect(() => {
    const fetchMentionTypes = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setMentionTypes((data || []) as MentionType[]);
      } catch (err) {
        console.error('Failed to fetch mention types:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMentionTypes();
  }, [supabase]);

  const handleChipClick = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('pin');
      if (typeSlugFromUrl === slug) {
        params.delete('type');
      } else {
        params.set('type', slug);
      }
      const qs = params.toString();
      router.replace(qs ? `/live?${qs}` : '/live');
    },
    [router, searchParams, typeSlugFromUrl]
  );

  if (loading) {
    return (
      <div className="flex-shrink-0 px-2 pb-2">
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[30px] w-20 bg-gray-100 rounded-md animate-pulse flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (mentionTypes.length === 0) return null;

  const selectedType = typeSlugFromUrl
    ? mentionTypes.find((t) => mentionTypeNameToSlug(t.name) === typeSlugFromUrl)
    : null;

  if (selectedType) {
    const slug = mentionTypeNameToSlug(selectedType.name);
    return (
      <div className="flex-shrink-0 px-2 pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => handleChipClick(slug)}
            className="inline-flex items-center gap-1.5 h-[30px] px-2 rounded-md border border-gray-300 bg-white text-gray-900 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors hover:bg-gray-50 opacity-100"
            aria-pressed
            aria-label={`${selectedType.name} (selected), clear filter`}
          >
            <span className="text-sm">{selectedType.emoji}</span>
            <span className="truncate max-w-[80px]">{selectedType.name}</span>
            <XMarkIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 px-2 pb-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {mentionTypes.map((type) => {
          const slug = mentionTypeNameToSlug(type.name);
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => handleChipClick(slug)}
              className="inline-flex items-center gap-1.5 h-[30px] px-2 rounded-md border border-gray-200 bg-white text-gray-900 text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors opacity-100 hover:bg-gray-50"
              aria-pressed={false}
              aria-label={`Filter by ${type.name}`}
            >
              <span className="text-sm">{type.emoji}</span>
              <span className="truncate max-w-[80px]">{type.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
