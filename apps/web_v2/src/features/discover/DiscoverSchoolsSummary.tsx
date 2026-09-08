'use client';

/**
 * Discover idle — your schools as pills (same pattern as Interests).
 */

import { useMemo } from 'react';
import Link from 'next/link';
import {
  DiscoverAddChip,
  DiscoverSectionHeader,
  DISCOVER_FOLLOW_PILL_CLASS,
} from '@/features/discover/DiscoverChrome';
import { useWarmAccountSchools } from '@/features/discover/useWarmAccountSchools';
import { useAccountSchoolRows } from '@/lib/accountSchools/store';
import { directoryPageSharePath } from '@/lib/directory/pageContactLinks';
import { groupAccountSchools } from '@/lib/schools/groupAccountSchools';
import { DISCOVER_SCHOOLS_PATH, GAME_PATH } from '@/lib/routes/routePolicy';
import { queuePendingMapFocus } from '@/map/location/camera/pendingMapFocus';

const PILL_PREVIEW = 12;

export function DiscoverSchoolsSummary({
  accountId,
}: {
  accountId: string | null;
}) {
  useWarmAccountSchools(accountId);
  const schools = useAccountSchoolRows();
  const groups = useMemo(() => groupAccountSchools(schools), [schools]);

  const preview = groups.slice(0, PILL_PREVIEW);
  const overflow = Math.max(0, groups.length - preview.length);

  return (
    <section className="pt-5">
      <DiscoverSectionHeader
        title="Schools"
        actionHref={DISCOVER_SCHOOLS_PATH}
        actionLabel={!accountId ? 'See All' : groups.length === 0 ? 'Add' : 'Edit'}
      />

      {!accountId ? (
        <div className="px-5 pt-2.5">
          <DiscoverAddChip href={DISCOVER_SCHOOLS_PATH} label="Add" />
          <p className="mt-2 text-[12px] leading-snug text-foreground-muted">
            Sign in to save schools.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="px-5 pt-2.5">
          <DiscoverAddChip href={DISCOVER_SCHOOLS_PATH} label="Add" />
          <p className="mt-2 text-[12px] leading-snug text-foreground-muted">
            Add a school you attend, teach at, or follow.
          </p>
        </div>
      ) : (
        <div
          className="mt-2.5 flex flex-wrap items-center gap-1.5 px-5"
          role="list"
          aria-label="Your schools"
        >
          <DiscoverAddChip href={DISCOVER_SCHOOLS_PATH} label="Add" />
          {preview.map((group) => {
            const pagePath = directoryPageSharePath(group.pageSlug);
            const hasCoords =
              group.lat != null &&
              group.lng != null &&
              Number.isFinite(group.lat) &&
              Number.isFinite(group.lng);
            const href = pagePath ?? (hasCoords ? GAME_PATH : DISCOVER_SCHOOLS_PATH);
            return (
              <Link
                key={group.schoolId}
                href={href}
                role="listitem"
                className={`${DISCOVER_FOLLOW_PILL_CLASS} transition active:opacity-70`}
                onClick={
                  hasCoords && !pagePath
                    ? () => {
                        queuePendingMapFocus({
                          lat: group.lat!,
                          lng: group.lng!,
                          label: group.name,
                        });
                      }
                    : undefined
                }
              >
                {group.name}
              </Link>
            );
          })}
          {overflow > 0 ? (
            <Link
              href={DISCOVER_SCHOOLS_PATH}
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
