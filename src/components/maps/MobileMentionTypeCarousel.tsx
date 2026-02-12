'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import MentionMapLabel from '@/components/shared/MentionMapLabel';

type MentionType = { id: string; emoji: string; name: string };

interface MobileMentionTypeCarouselProps {
  /** When false, carousel is hidden */
  visible?: boolean;
}

/**
 * Mobile-only horizontal carousel of mention type chips.
 * Floats at the top of the map container. Multi-select filter via ?type=slug1,slug2.
 */
export default function MobileMentionTypeCarousel({ visible = true }: MobileMentionTypeCarouselProps) {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mentionTypes, setMentionTypes] = useState<MentionType[]>([]);
  const [loading, setLoading] = useState(true);

  const typeParam = searchParams.get('type');
  const selectedSlugs = typeParam
    ? typeParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

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
        console.error('[MobileMentionTypeCarousel] Failed to fetch:', err);
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
      const isSelected = selectedSlugs.includes(slug);
      const next = isSelected
        ? selectedSlugs.filter((s) => s !== slug)
        : [...selectedSlugs, slug];
      if (next.length === 0) {
        params.delete('type');
      } else {
        params.set('type', next.join(','));
      }
      const qs = params.toString();
      const base = pathname || '/maps';
      router.replace(qs ? `${base}?${qs}` : base);
    },
    [router, pathname, searchParams, selectedSlugs]
  );

  if (!visible || loading || mentionTypes.length === 0) return null;

  return (
    <div
      className="md:hidden absolute top-0 left-0 right-0 z-[100] px-2 pb-2 overflow-x-auto scrollbar-hide bg-[hsl(var(--header)/0.9)] backdrop-blur-sm"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-2 min-w-max">
        {mentionTypes.map((type) => {
          const slug = mentionTypeNameToSlug(type.name);
          const isSelected = selectedSlugs.includes(slug);
          return (
            <MentionMapLabel
              key={type.id}
              emoji={type.emoji}
              name={type.name}
              isSelected={isSelected}
              onClick={() => handleChipClick(slug)}
              onClear={isSelected ? () => handleChipClick(slug) : undefined}
              maxWidth="max-w-[100px]"
            />
          );
        })}
      </div>
    </div>
  );
}
