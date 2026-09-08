'use client';

import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import {
  ensureStreetsMetaQueryLayers,
  removeStreetsMetaQueryLayers,
  streetsMetaQueryLayerIds,
} from '@/map/meta/streetsMetaQuerySource';

/**
 * Keeps the Streets v8 query layers mounted for as long as the calling surface
 * is alive.
 *
 * Opt in per surface rather than globally: the layers hold a vector source, so
 * mounting them starts pulling tiles, and nothing should pay that unasked.
 */
export function useStreetsMetaQuerySource(
  map: MapboxMap | null,
  ready: boolean,
): void {
  useEffect(() => {
    if (!map || !ready) return;

    const install = () => ensureStreetsMetaQueryLayers(map);

    // A style swap drops every custom layer, and `style.load` can fire a beat
    // before the style will accept an addLayer — so `idle` re-checks the work.
    const healIfMissing = () => {
      if (streetsMetaQueryLayerIds(map).length === 0) install();
    };

    install();
    map.on('style.load', install);
    map.on('idle', healIfMissing);

    return () => {
      map.off('style.load', install);
      map.off('idle', healIfMissing);
      removeStreetsMetaQueryLayers(map);
    };
  }, [map, ready]);
}
