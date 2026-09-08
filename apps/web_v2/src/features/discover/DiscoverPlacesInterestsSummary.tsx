'use client';

/**
 * Discover idle — followed cities as pills (same pattern as Interests).
 */

import { useMemo } from 'react';
import Link from 'next/link';
import {
  DiscoverAddChip,
  DiscoverSectionHeader,
  DISCOVER_FOLLOW_PILL_CLASS,
} from '@/features/discover/DiscoverChrome';
import { useWarmPlacesInterests } from '@/features/discover/useWarmPlacesInterests';
import { sortAlertPlaces } from '@/lib/accountPlaces/alerts';
import {
  PLACE_KIND_LABEL,
  kindLabel,
  placeDisplayName,
  type AccountPlace,
  type AccountPlaceKind,
} from '@/lib/accountPlaces/api';
import { useAccountPlaceRows } from '@/lib/accountPlaces/store';
import { DISCOVER_PLACES_PATH, directoryTerritoryPath } from '@/lib/routes/routePolicy';

const PILL_PREVIEW = 12;

export type PlaceCityGroup = {
  unitId: string;
  name: string;
  kinds: AccountPlaceKind[];
  notify: boolean;
  isHome: boolean;
};

export function groupPlaceCities(places: AccountPlace[]): PlaceCityGroup[] {
  const map = new Map<string, PlaceCityGroup>();
  for (const row of sortAlertPlaces(places)) {
    const unitId = row.territory_unit_id;
    if (!unitId) continue;
    const existing = map.get(unitId);
    if (existing) {
      if (!existing.kinds.includes(row.kind)) existing.kinds.push(row.kind);
      existing.notify = existing.notify || row.notify;
      existing.isHome = existing.isHome || row.is_home;
      continue;
    }
    map.set(unitId, {
      unitId,
      name: row.unit_name?.trim() || placeDisplayName(row),
      kinds: [row.kind],
      notify: row.notify,
      isHome: row.is_home,
    });
  }
  return [...map.values()].sort((a, b) => {
    if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function placeCityEyebrow(city: PlaceCityGroup): string {
  if (city.isHome) return 'Home';
  return city.kinds.map((k) => PLACE_KIND_LABEL[k]).join(' · ');
}

export function placeCitySubtitle(city: PlaceCityGroup): string {
  if (city.notify) return 'Post alerts on';
  return city.kinds.map((k) => kindLabel(k)).join(' · ');
}

export function DiscoverPlacesInterestsSummary({
  accountId,
}: {
  accountId: string | null;
}) {
  useWarmPlacesInterests(accountId);
  const places = useAccountPlaceRows();
  const cities = useMemo(() => groupPlaceCities(places), [places]);

  const preview = cities.slice(0, PILL_PREVIEW);
  const overflow = Math.max(0, cities.length - preview.length);

  return (
    <section className="pt-5">
      <DiscoverSectionHeader
        title="Places"
        actionHref={DISCOVER_PLACES_PATH}
        actionLabel={!accountId ? 'See All' : cities.length === 0 ? 'Add' : 'Edit'}
      />

      {!accountId ? (
        <div className="px-5 pt-2.5">
          <DiscoverAddChip href={DISCOVER_PLACES_PATH} label="Add" />
          <p className="mt-2 text-[12px] leading-snug text-foreground-muted">
            Sign in to follow cities.
          </p>
        </div>
      ) : cities.length === 0 ? (
        <div className="px-5 pt-2.5">
          <DiscoverAddChip href={DISCOVER_PLACES_PATH} label="Add" />
          <p className="mt-2 text-[12px] leading-snug text-foreground-muted">
            Follow a city for post alerts where you live, work, or care.
          </p>
        </div>
      ) : (
        <div
          className="mt-2.5 flex flex-wrap items-center gap-1.5 px-5"
          role="list"
          aria-label="Your places"
        >
          <DiscoverAddChip href={DISCOVER_PLACES_PATH} label="Add" />
          {preview.map((city) => (
            <Link
              key={city.unitId}
              href={directoryTerritoryPath(city.unitId)}
              role="listitem"
              className={`${DISCOVER_FOLLOW_PILL_CLASS} transition active:opacity-70`}
            >
              {city.name}
            </Link>
          ))}
          {overflow > 0 ? (
            <Link
              href={DISCOVER_PLACES_PATH}
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
