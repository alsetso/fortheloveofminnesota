'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';

export type Tag = { id: string; emoji: string; name: string };

interface MentionTypeFilterProps {
  tags: Tag[];
  /** When false, filter is hidden */
  visible?: boolean;
}

/**
 * Horizontal filter chips for maps page. Updates URL ?type=slug for MentionsLayer filtering.
 */
export default function MentionTypeFilter({ tags, visible = true }: MentionTypeFilterProps) {
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
      className="absolute top-0 left-0 right-0 z-[100] px-2 pb-2 overflow-x-auto scrollbar-hide bg-[hsl(var(--header)/0.9)] backdrop-blur-sm"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <div className="flex gap-2 min-w-max">
        {tags.map((tag) => {
          const slug = mentionTypeNameToSlug(tag.name);
          const isSelected = selectedSlugs.includes(slug);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleChipClick(slug)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap
                transition-colors border
                ${isSelected
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white/90 text-gray-700 border-gray-200 hover:bg-gray-50'
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
  );
}
