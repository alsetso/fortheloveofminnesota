'use client';

import { useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import {
  buildAccountMapPinIconExpression,
  createAccountMapPinMissingImageHandler,
  ensureAccountMapPinFallback,
  registerAccountMapPinIcons,
} from '@/features/map/community/accountMapPinIcons';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import { useMapContext } from '@/map/MapProvider';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';

const AVATAR_LAYER_ID = 'app-community-pins-avatar';
const HIT_LAYER_ID = 'app-community-pins-hit';

type GeoJsonSource = { setData: (data: FeatureCollection) => void };

/**
 * Registers circular account avatars on the Mapbox style for community pins.
 * Must mount *before* the pins GeoJsonLayer so fallback + styleimagemissing
 * are ready when the symbol layer first paints (otherwise icons stay blank).
 */
export function CommunityPinAvatarIcons() {
  const { map, ready } = useMapContext();

  useEffect(() => {
    if (!map || !ready) return;

    const onMissing = createAccountMapPinMissingImageHandler(map);
    map.on('styleimagemissing', onMissing);

    const bumpPinSource = () => {
      if (!isMapStyleReady(map)) return;
      const src = safeGetSource(map, MAP_SOURCE_IDS.pins) as GeoJsonSource | undefined;
      if (!src?.setData) return;
      try {
        src.setData(mapDataStore.get(MAP_SOURCE_IDS.pins));
      } catch {
        /* mid-reload */
      }
      // Re-assert icon-image so Mapbox re-resolves after late addImage.
      if (safeGetLayer(map, AVATAR_LAYER_ID)) {
        try {
          map.setLayoutProperty(
            AVATAR_LAYER_ID,
            'icon-image',
            buildAccountMapPinIconExpression(),
          );
        } catch {
          /* ignore */
        }
      }
    };

    const movePinsToTop = () => {
      if (!isMapStyleReady(map)) return;
      for (const id of [AVATAR_LAYER_ID, HIT_LAYER_ID]) {
        if (!safeGetLayer(map, id)) continue;
        try {
          map.moveLayer(id);
        } catch {
          /* ignore */
        }
      }
    };

    const sync = () => {
      if (!isMapStyleReady(map)) return;
      ensureAccountMapPinFallback(map);
      const fc = mapDataStore.get(MAP_SOURCE_IDS.pins);
      void registerAccountMapPinIcons(map, fc.features).then(() => {
        bumpPinSource();
        movePinsToTop();
        try {
          map.triggerRepaint();
        } catch {
          /* ignore */
        }
      });
      movePinsToTop();
    };

    // Synchronous fallback before any symbol paint.
    if (isMapStyleReady(map)) {
      ensureAccountMapPinFallback(map);
    }

    sync();
    const unsub = mapDataStore.subscribe(MAP_SOURCE_IDS.pins, () => sync());
    const onStyle = () => {
      ensureAccountMapPinFallback(map);
      sync();
    };
    map.on('style.load', onStyle);

    return () => {
      unsub();
      map.off('style.load', onStyle);
      map.off('styleimagemissing', onMissing);
    };
  }, [map, ready]);

  return null;
}
