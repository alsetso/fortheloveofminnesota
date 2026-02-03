'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import MentionMapLabel from '@/components/shared/MentionMapLabel';

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
      <div className="flex-shrink-0 px-[10px] pb-2">
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[28px] w-24 bg-gray-100 rounded-full animate-pulse flex-shrink-0" />
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
      <div className="flex-shrink-0 px-[10px] pb-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <MentionMapLabel
            emoji={selectedType.emoji}
            name={selectedType.name}
            isSelected={true}
            onClick={() => handleChipClick(slug)}
            onClear={() => handleChipClick(slug)}
            maxWidth="max-w-[100px]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 px-[10px] pb-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {mentionTypes.map((type) => {
          const slug = mentionTypeNameToSlug(type.name);
          return (
            <MentionMapLabel
              key={type.id}
              emoji={type.emoji}
              name={type.name}
              isSelected={false}
              onClick={() => handleChipClick(slug)}
              maxWidth="max-w-[100px]"
            />
          );
        })}
      </div>
    </div>
  );
}
