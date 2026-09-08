'use client';

import { IconChevronDown } from '@/features/map/dockCore/core/icons';

export type FeedSegmentId = 'all' | 'places' | 'following';

const SEGMENTS: { id: FeedSegmentId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'places', label: 'Places' },
  { id: 'following', label: 'Following' },
];

/**
 * Feed segments — underline active tab (X-style).
 * Chevron only on the selected tab; tap selected opens filter, tap other switches.
 */
export function FeedSegmentToolbar({
  active,
  onChange,
  onOpenFilter,
}: {
  active: FeedSegmentId;
  onChange: (id: FeedSegmentId) => void;
  onOpenFilter: () => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Feed"
      className="relative flex gap-5 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-black/[0.08]"
      />
      {SEGMENTS.map((seg) => {
        const isActive = active === seg.id;
        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-haspopup="dialog"
            onClick={() => {
              if (isActive) onOpenFilter();
              else onChange(seg.id);
            }}
            className={`relative inline-flex shrink-0 items-center gap-1 pb-2.5 pt-1 text-[15px] transition-colors active:opacity-70 ${
              isActive
                ? 'font-bold text-foreground'
                : 'font-medium text-foreground-muted'
            }`}
          >
            {seg.label}
            {isActive ? (
              <IconChevronDown className="h-3.5 w-3.5 text-foreground" />
            ) : null}
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-[1] mx-auto h-[3px] w-full rounded-full bg-foreground"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
