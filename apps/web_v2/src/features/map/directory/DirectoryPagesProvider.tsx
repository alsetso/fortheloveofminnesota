'use client';

import { useEffect } from 'react';
import type { Feature, FeatureCollection, Point } from 'geojson';
import {
  refreshDirectoryPages,
  getRawDirectoryPages,
} from '@/features/map/directory/directoryPagesStore';
import { fetchAccountOwnedPages, type AccountOwnedPage } from '@/features/map/directory/accountPages';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import { useMapContext } from '@/map/MapProvider';

/**
 * Convert the user's own AccountOwnedPage records to a GeoJSON FeatureCollection
 * using the same shape as directoryPagesToFeatureCollection.
 *
 * Called only as a fallback when the public directory returns 0 results
 * (e.g. early in the app's life or very sparse areas).
 */
function accountPagesToFeatureCollection(pages: AccountOwnedPage[]): FeatureCollection {
  const features: Feature<Point>[] = [];
  for (const page of pages) {
    if (!Number.isFinite(page.lat) || !Number.isFinite(page.lng)) continue;
    features.push({
      type: 'Feature',
      id: page.id,
      geometry: {
        type: 'Point',
        coordinates: [page.lng as number, page.lat as number],
      },
      properties: {
        id: page.id,
        slug: page.slug,
        name: page.title,
        title: page.title,
        page_type: page.pageType,
        page_type_label: page.pageTypeLabel,
        description: page.description,
        address: page.addressLine,
        website: null,
        logo_url: page.logoUrl,
        icon: page.icon,
        cover_url: page.coverUrl,
        /** Mark so controls/chips can style owned pins differently in the future. */
        is_owner: true,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Fetches user-generated directory pages → mapDataStore once the map is ready.
 *
 * Fallback: if the public endpoint returns 0 pages (sparse early directory),
 * fetches the signed-in user's own pages so creators always see their work on
 * the map even before a community exists.
 *
 * Note: CommunityPinsProvider is not mounted on /game, so there is no
 * pins-version signal to wait for. Start immediately on map ready.
 */
export function DirectoryPagesProvider({ children }: { children: React.ReactNode }) {
  const { ready } = useMapContext();

  useEffect(() => {
    if (!ready) return;

    const ac = new AbortController();

    void (async () => {
      await refreshDirectoryPages(ac.signal);
      if (ac.signal.aborted) return;

      // If public directory is empty, show the user's own pages as a fallback
      // so creators always see their work on the map even before a community exists.
      const raw = getRawDirectoryPages();
      if (!raw || raw.features.length === 0) {
        try {
          const ownPages = await fetchAccountOwnedPages(ac.signal);
          if (ac.signal.aborted) return;
          if (ownPages.length > 0) {
            const fc = accountPagesToFeatureCollection(ownPages);
            mapDataStore.set(MAP_SOURCE_IDS.pages, fc);
            if (process.env.NODE_ENV !== 'production') {
              console.info(`[DirectoryPagesProvider] fallback: ${fc.features.length} user pages`);
            }
          }
        } catch {
          // Non-fatal — user may not be signed in.
        }
      }
    })();

    return () => ac.abort();
  }, [ready]);

  return <>{children}</>;
}
