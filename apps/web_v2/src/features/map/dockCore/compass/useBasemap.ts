'use client';

import { useSyncExternalStore } from 'react';
import {
  getBasemapSnapshot,
  subscribeBasemap,
  basemapSurface,
  type MapBasemapId,
  type MapSurfaceId,
} from '@/features/map/dockCore/compass/basemap';

/** Live basemap id + chrome surface from the shared store (Controls + rails). */
export function useBasemap(): {
  basemap: MapBasemapId;
  surface: MapSurfaceId;
  darkSurface: boolean;
} {
  const { value } = useSyncExternalStore(
    subscribeBasemap,
    getBasemapSnapshot,
    getBasemapSnapshot,
  );
  const surface = basemapSurface(value);
  return { basemap: value, surface, darkSurface: surface === 'dark' };
}
