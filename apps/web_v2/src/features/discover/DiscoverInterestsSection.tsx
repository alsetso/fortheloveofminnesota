'use client';

/**
 * Discover idle — followed interests with dashed + add chip first.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import {
  DiscoverAddChip,
  DiscoverSectionHeader,
  DISCOVER_FOLLOW_PILL_CLASS,
} from '@/features/discover/DiscoverChrome';
import { useWarmPlacesInterests } from '@/features/discover/useWarmPlacesInterests';
import {
  useSelectedInterestIds,
  useVisibleInterests,
} from '@/lib/accountInterests/store';
import { DISCOVER_INTERESTS_PATH } from '@/lib/routes/routePolicy';

const PILL_PREVIEW = 12;

export function DiscoverInterestsSection({
  accountId,
}: {
  accountId: string | null;
}) {
  useWarmPlacesInterests(accountId);
  const visible = useVisibleInterests();
  const selected = useSelectedInterestIds();

  const followed = useMemo(
    () => visible.filter((row) => selected.has(row.id)),
    [visible, selected],
  );

  const preview = followed.slice(0, PILL_PREVIEW);
  const overflow = Math.max(0, followed.length - preview.length);

  return (
    <section className="pt-5">
      <DiscoverSectionHeader
        title="Interests"
        actionHref={DISCOVER_INTERESTS_PATH}
        actionLabel={!accountId ? 'See All' : followed.length === 0 ? 'Add' : 'Edit'}
      />

      {!accountId ? (
        <div className="px-5 pt-2.5">
          <DiscoverAddChip href={DISCOVER_INTERESTS_PATH} label="Add" />
          <p className="mt-2 text-[12px] leading-snug text-foreground-muted">
            Sign in to follow topics for post alerts.
          </p>
        </div>
      ) : followed.length === 0 ? (
        <div className="px-5 pt-2.5">
          <DiscoverAddChip href={DISCOVER_INTERESTS_PATH} label="Add" />
          <p className="mt-2 text-[12px] leading-snug text-foreground-muted">
            Follow interests to quiet alerts to what you care about.
          </p>
        </div>
      ) : (
        <div
          className="mt-2.5 flex flex-wrap items-center gap-1.5 px-5"
          role="list"
          aria-label="Your interests"
        >
          <DiscoverAddChip href={DISCOVER_INTERESTS_PATH} label="Add" />
          {preview.map((row) => (
            <Link
              key={row.id}
              href={DISCOVER_INTERESTS_PATH}
              role="listitem"
              className={`${DISCOVER_FOLLOW_PILL_CLASS} transition active:opacity-70`}
            >
              {row.name}
            </Link>
          ))}
          {overflow > 0 ? (
            <Link
              href={DISCOVER_INTERESTS_PATH}
              className="rounded-full px-2 py-1 text-[12px] font-semibold text-foreground-muted transition active:opacity-70"
            >
              +{overflow}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
