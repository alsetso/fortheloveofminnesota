'use client';

/**
 * Discover idle — Atlas as a compact horizontal carousel (Places strip).
 * Territory record lists first, then feature sets.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  DiscoverHeroCarousel,
  type DiscoverHeroCard,
} from '@/features/discover/DiscoverChrome';
import {
  DISCOVER_TERRITORY_ATLAS_CARDS,
  atlasCollectionCardMedia,
  atlasTerritoryCardMedia,
} from '@/features/discover/discoverAtlasTerritoryCards';
import {
  atlasVisibilityLabel,
  type AtlasCollectionRow,
} from '@/lib/atlas/types';
import {
  DISCOVER_ATLAS_PATH,
  discoverAtlasCollectionPath,
  discoverKindPath,
} from '@/lib/routes/routePolicy';

const ATLAS_TONES: NonNullable<DiscoverHeroCard['tone']>[] = [
  'lake',
  'pine',
  'dusk',
  'clay',
];

export function DiscoverAtlasSection() {
  const [sets, setSets] = useState<AtlasCollectionRow[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/discover/atlas', {
          credentials: 'include',
          cache: 'no-store',
          signal: ac.signal,
        });
        if (!res.ok) throw new Error('Failed to load');
        const body = (await res.json()) as { featureSets?: AtlasCollectionRow[] };
        if (ac.signal.aborted) return;
        setSets(body.featureSets ?? []);
      } catch {
        if (ac.signal.aborted) return;
        setSets([]);
      }
    })();
    return () => ac.abort();
  }, []);

  const cards = useMemo((): DiscoverHeroCard[] => {
    const territoryCards: DiscoverHeroCard[] = DISCOVER_TERRITORY_ATLAS_CARDS.map(
      (kind, index) => ({
        id: `territory-${kind.slug}`,
        eyebrow: 'Territory',
        title: kind.label,
        subtitle: `${kind.total.toLocaleString()} records`,
        href: discoverKindPath(kind.slug),
        tone: ATLAS_TONES[index % ATLAS_TONES.length],
        media: atlasTerritoryCardMedia(kind.unitKind),
      }),
    );

    if (sets === null) return territoryCards;

    const featureCards: DiscoverHeroCard[] = sets.map((set, index) => {
      const countLabel =
        set.featureCount > 0 ? set.featureCount.toLocaleString() : '—';
      return {
        id: set.id,
        eyebrow: atlasVisibilityLabel(set.visibility),
        title: set.name,
        subtitle: `${atlasVisibilityLabel(set.visibility)} · ${countLabel}`,
        href: discoverAtlasCollectionPath(set.slug),
        tone: ATLAS_TONES[(territoryCards.length + index) % ATLAS_TONES.length],
        media: atlasCollectionCardMedia(set.filterKind),
      };
    });

    return [...territoryCards, ...featureCards];
  }, [sets]);

  return (
    <DiscoverHeroCarousel
      sectionTitle="Atlas"
      headerHref={DISCOVER_ATLAS_PATH}
      headerLabel="See All"
      cards={cards}
      size="compact"
    />
  );
}
