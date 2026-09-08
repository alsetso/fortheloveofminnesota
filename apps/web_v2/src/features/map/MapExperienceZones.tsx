'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DiscoverHeroCarousel,
  DiscoverSectionHeader,
  type DiscoverHeroCard,
} from '@/features/discover/DiscoverChrome';
import { DiscoverExperienceZoneCardMap } from '@/features/discover/DiscoverExperienceZoneCardMap';
import { fetchExperienceZonesList } from '@/lib/experienceZones/fetchExperienceZonesList';
import type { ExperienceZoneListItem } from '@/lib/experienceZones/experienceZoneTypes';
import { discoverZonePath } from '@/lib/routes/routePolicy';

const TONES: NonNullable<DiscoverHeroCard['tone']>[] = [
  'pine',
  'lake',
  'dusk',
  'clay',
];

function zoneToCard(
  zone: ExperienceZoneListItem,
  index: number,
): DiscoverHeroCard {
  return {
    id: zone.id,
    eyebrow: 'Experience zone',
    title: zone.name,
    subtitle: zone.description?.trim() || 'Open on the map and explore the zone.',
    href: discoverZonePath(zone.id),
    tone: TONES[index % TONES.length],
    media: zone.geometry ? (
      <DiscoverExperienceZoneCardMap
        zoneId={zone.id}
        name={zone.name}
        geometry={zone.geometry}
      />
    ) : undefined,
  };
}

/**
 * `/map` Play hub — featured primary experience zones.
 * Tap → `/discover/zone/[id]`.
 */
export function MapExperienceZones() {
  const [zones, setZones] = useState<ExperienceZoneListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      const result = await fetchExperienceZonesList({
        signal: ac.signal,
        featuredOnly: true,
      });
      if (ac.signal.aborted) return;
      if (!result) {
        setFailed(true);
        setZones([]);
        return;
      }
      setZones(result.zones);
      setFailed(false);
    })();
    return () => ac.abort();
  }, []);

  const cards = useMemo(
    () => (zones ?? []).map((zone, i) => zoneToCard(zone, i)),
    [zones],
  );

  if (zones === null) {
    return (
      <section className="pt-5">
        <DiscoverSectionHeader title="Experience Zones" />
        <p className="px-5 pt-3 text-[14px] text-foreground-muted">Loading…</p>
      </section>
    );
  }

  if (cards.length === 0) {
    return (
      <section className="pt-5">
        <DiscoverSectionHeader title="Experience Zones" />
        <p className="px-5 pt-3 text-[14px] text-foreground-muted">
          {failed
            ? 'Couldn’t load experience zones right now.'
            : 'No featured experience zones yet.'}
        </p>
      </section>
    );
  }

  return (
    <DiscoverHeroCarousel sectionTitle="Experience Zones" cards={cards} />
  );
}
