'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  getPointAtLocationCacheSnapshot,
  pointAtLocationCacheKey,
  subscribePointAtLocationCache,
} from '@/features/map/dockCore/store/pointAtLocationCache';
import { useSelectedPointCoords } from '@/map/location/camera/useSelectedPointCoords';

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Live title/subtitle for the selected-point dock pill.
 * Coordinates are never shown in the subtitle — they are available via
 * `coordsLabel` for the copy-to-clipboard button instead.
 */
export function useSelectedPointChrome() {
  const { coords } = useSelectedPointCoords();
  const cache = useSyncExternalStore(
    subscribePointAtLocationCache,
    getPointAtLocationCacheSnapshot,
    () => null,
  );

  return useMemo(() => {
    if (!coords) {
      return { title: 'Selected point', subtitle: null as string | null, coordsLabel: null as string | null };
    }

    const key = pointAtLocationCacheKey(coords.lat, coords.lng);
    const match = cache?.key === key ? cache : null;
    const coordsLabel = formatCoords(coords.lat, coords.lng);
    const address = match?.address?.trim() || null;

    if (address) {
      return { title: address, subtitle: null, coordsLabel };
    }

    if (match?.error) {
      return { title: 'Address unavailable', subtitle: null, coordsLabel };
    }

    // Still loading — show coords as title so the pill isn't empty
    return { title: coordsLabel, subtitle: 'Looking up address…', coordsLabel };
  }, [coords, cache]);
}
