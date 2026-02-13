'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';

export type Tag = { id: string; emoji: string; name: string };

interface MentionTypeFilterProps {
  tags: Tag[];
  /** When false, filter is hidden */
  visible?: boolean;
  /** Renders to the left of the scrollable chips */
  leftSlot?: React.ReactNode;
}

/**
 * Horizontal filter chips for maps page. Updates URL ?type=slug for MentionsLayer filtering.
 */
export default function MentionTypeFilter({ tags, visible = true, leftSlot }: MentionTypeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const selectedSlugs = typeParam ? typeParam.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const handleChipClick = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('pin');
      params.delete('layer');
      params.delete('id');
      params.delete('lat');
      params.delete('lng');
      const isSelected = selectedSlugs.includes(slug);
      const next = isSelected ? selectedSlugs.filter((s) => s !== slug) : [...selectedSlugs, slug];
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

  if (!visible || tags.length === 0) return null;

  return (
    <div
      className="absolute top-0 left-0 z-[100] flex max-w-[80%] items-center gap-2 px-2 pb-2"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', right: '2rem' }}
    >
      {leftSlot}
      <div
        className="min-w-0 flex-1 overflow-x-auto scrollbar-hide"
        style={{
          maskImage: 'linear-gradient(to right, black 0, black calc(100% - 40px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, black 0, black calc(100% - 40px), transparent 100%)',
          maskSize: '100% 100%',
          WebkitMaskSize: '100% 100%',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        } as React.CSSProperties}
      >
        <div className="flex gap-2">
          {tags.map((tag) => {
            const slug = mentionTypeNameToSlug(tag.name);
            const isSelected = selectedSlugs.includes(slug);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleChipClick(slug)}
                className={`
                  flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium
                  transition-colors
                  ${isSelected
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white/90 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <span>{tag.emoji}</span>
                <span>{tag.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
