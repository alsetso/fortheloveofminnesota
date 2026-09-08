'use client';

import { DiscoverSectionHeader } from '@/features/discover/DiscoverChrome';
import type { DiscoverSearchRecentRow } from '@/features/discover/discoverSearchApi';
import {
  DISCOVER_SEARCH_SECTION_LABELS,
  type DiscoverSearchKind,
} from '@/lib/discover/search/types';
import { IconClock, IconSearch } from '@/features/map/dockCore/core/icons';

const KIND_OPENED_LABEL: Partial<Record<DiscoverSearchKind, string>> = {
  page: 'Opened page',
  territory: 'Opened territory',
  atlas_feature: 'Opened atlas',
  atlas_collection: 'Opened atlas',
  place: 'Opened place',
  experience_zone: 'Opened zone',
  school: 'Opened school',
  post: 'Opened post',
  account: 'Opened person',
};

function recentSubtitle(row: DiscoverSearchRecentRow): string {
  if (row.hitTitle && row.hitKind) {
    const opened =
      KIND_OPENED_LABEL[row.hitKind] ??
      `Opened ${DISCOVER_SEARCH_SECTION_LABELS[row.hitKind] ?? 'result'}`;
    return `${opened} · ${row.hitTitle}`;
  }
  if (row.completedVia === 'submit') return 'Search submitted';
  return 'Recent search';
}

/**
 * Idle Discover recents — tap re-runs the query in the omnibox.
 */
export function DiscoverRecentSearches({
  rows,
  onSelect,
  compact = false,
}: {
  rows: DiscoverSearchRecentRow[];
  onSelect: (query: string) => void;
  compact?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <section className={compact ? 'pt-1 pb-2' : 'pt-1 pb-2'}>
      <DiscoverSectionHeader
        title="Recent"
        className={compact ? 'px-0' : undefined}
      />
      <div
        className={`mt-2 divide-y divide-black/[0.07] border-y border-black/[0.06] bg-white/70 ${
          compact ? 'rounded-[12px] border' : ''
        }`}
      >
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.query)}
            className={`flex w-full items-center gap-3 py-3 text-left transition active:bg-black/[0.03] ${
              compact ? 'px-3' : 'px-5'
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-black/[0.08] bg-[#f4f6f8] text-foreground-muted">
              {row.hitKind ? (
                <IconSearch className="h-[18px] w-[18px]" />
              ) : (
                <IconClock className="h-[18px] w-[18px]" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">
                {row.query}
              </span>
              <span className="mt-0.5 block truncate text-[12px] leading-snug text-foreground-muted">
                {recentSubtitle(row)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
