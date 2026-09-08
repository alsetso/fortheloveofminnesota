'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap, AnyLayer, ExpressionSpecification } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';
import {
  ACCOUNT_PIN_ICON_SIZE,
  createAccountMapPinMissingImageHandler,
  ensureAccountMapPinFallback,
  registerAccountMapPinIcons,
  buildAccountMapPinIconExpression,
} from '@/features/map/community/accountMapPinIcons';
import { useAuthSafe } from '@/features/auth';
import {
  useAllCommunityPinsVisible,
  useYourPinsVisible,
} from '@/features/map/community/communityPinsVisibilityStore';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import { useMapContext } from '@/map/MapProvider';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';

const SOURCE_ID = MAP_SOURCE_IDS.pins;
const HIT_LAYER_ID = 'app-community-pins-hit';
/** Tight 3px green stroke hugging unseen avatars (non-SDF-safe). */
const RING_LAYER_ID = 'app-community-pins-unseen-ring';
const AVATAR_LAYER_ID = 'app-community-pins-avatar';
const LAYER_IDS = [HIT_LAYER_ID, RING_LAYER_ID, AVATAR_LAYER_ID] as const;
const POINT_FILTER = ['==', ['geometry-type'], 'Point'];

/**
 * What a tap has to land on to mean "this post": the padded hit circle first,
 * the avatar itself as the backup. The unseen ring is never a target — it only
 * ever sits under an avatar that is already one.
 */
export const COMMUNITY_PIN_TAP_LAYER_IDS = [HIT_LAYER_ID, AVATAR_LAYER_ID] as const;

/**
 * Avatar icons use pixelRatio 2. Opaque disc radius in CSS px at icon-size 1
 * = (ICON/2 - 2px border) / 2 = 11. Keep in sync with accountMapPinIcons.
 */
const AVATAR_DISC_RADIUS_AT_SIZE_1 =
  (ACCOUNT_PIN_ICON_SIZE / 2 - 2) / 2;

const ICON_SIZE_BY_ZOOM = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  0.55,
  10,
  0.75,
  14,
  0.95,
  17,
  1.15,
] as unknown as ExpressionSpecification;

/** Circle radius that matches the visible avatar disc at each zoom. */
const UNSEEN_RING_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5,
  AVATAR_DISC_RADIUS_AT_SIZE_1 * 0.55,
  10,
  AVATAR_DISC_RADIUS_AT_SIZE_1 * 0.75,
  14,
  AVATAR_DISC_RADIUS_AT_SIZE_1 * 0.95,
  17,
  AVATAR_DISC_RADIUS_AT_SIZE_1 * 1.15,
] as unknown as ExpressionSpecification;

type GeoJsonSource = { setData: (data: FeatureCollection) => void };
type LayerWithSlot = AnyLayer & { slot?: 'bottom' | 'middle' | 'top' };

function withTopSlot(map: MapboxMap, layer: AnyLayer): LayerWithSlot {
  if (!mapUsesMapboxStandard(map)) return layer as LayerWithSlot;
  return { ...(layer as LayerWithSlot), slot: 'top' };
}

/**
 * `onlyMine` narrows the shared source to the signed-in account's own pins —
 * used when "Your pins" is on and "All community pins" is off (all is a
 * superset, so it always wins when both toggles are on).
 */
function buildPinsFilter(onlyMine: boolean, accountId: string | null): AnyLayer['filter'] {
  if (!onlyMine) return POINT_FILTER as AnyLayer['filter'];
  return [
    'all',
    POINT_FILTER,
    ['==', ['get', 'account_id'], accountId ?? '__none__'],
  ] as AnyLayer['filter'];
}

function buildUnseenPinsFilter(
  onlyMine: boolean,
  accountId: string | null,
): AnyLayer['filter'] {
  return [
    'all',
    buildPinsFilter(onlyMine, accountId) as unknown[],
    ['==', ['to-number', ['get', 'seen_by_me']], 0],
  ] as AnyLayer['filter'];
}

function applyVisibility(map: MapboxMap, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  for (const id of LAYER_IDS) {
    if (!safeGetLayer(map, id)) continue;
    try {
      map.setLayoutProperty(id, 'visibility', visibility);
    } catch {
      /* ignore */
    }
  }
}

function applyPinsFilter(map: MapboxMap, onlyMine: boolean, accountId: string | null): void {
  const pinsFilter = buildPinsFilter(onlyMine, accountId);
  const unseenFilter = buildUnseenPinsFilter(onlyMine, accountId);
  for (const id of LAYER_IDS) {
    if (!safeGetLayer(map, id)) continue;
    try {
      map.setFilter(id, id === RING_LAYER_ID ? unseenFilter : pinsFilter);
    } catch {
      /* ignore */
    }
  }
}

function movePinsToTop(map: MapboxMap): void {
  for (const id of LAYER_IDS) {
    if (!safeGetLayer(map, id)) continue;
    try {
      map.moveLayer(id);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Owns community pin source + layers + avatar icons end-to-end.
 * Mount once under MapProvider; data comes from `CommunityPinsProvider` → mapDataStore.
 */
export function CommunityPinsLayer() {
  const { map, ready } = useMapContext();
  const { account } = useAuthSafe();
  const yourPinsOn = useYourPinsVisible();
  const allPinsOn = useAllCommunityPinsVisible();
  const visible = yourPinsOn || allPinsOn;
  const onlyMine = yourPinsOn && !allPinsOn;
  const accountId = account?.id ?? null;

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const onlyMineRef = useRef(onlyMine);
  onlyMineRef.current = onlyMine;
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;

  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    const onMissing = createAccountMapPinMissingImageHandler(map);
    map.on('styleimagemissing', onMissing);

    const pushData = () => {
      const src = safeGetSource(map, SOURCE_ID) as GeoJsonSource | undefined;
      if (!src?.setData) return;
      try {
        src.setData(mapDataStore.get(SOURCE_ID));
      } catch {
        /* mid-reload */
      }
    };

    const ensure = async () => {
      if (cancelled || !isMapStyleReady(map)) return false;

      ensureAccountMapPinFallback(map);

      const fc = mapDataStore.get(SOURCE_ID);
      // Register avatars BEFORE first paint so styleimagemissing never claims
      // per-account ids (handler only seeds the shared fallback now).
      await registerAccountMapPinIcons(map, fc.features);
      if (cancelled) return false;

      if (!safeGetSource(map, SOURCE_ID)) {
        try {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: fc,
            promoteId: 'id',
            generateId: false,
          });
        } catch (err) {
          console.warn('[CommunityPinsLayer] addSource', err);
          return false;
        }
      }

      if (!safeGetLayer(map, HIT_LAYER_ID)) {
        try {
          map.addLayer(
            withTopSlot(map, {
              id: HIT_LAYER_ID,
              type: 'circle',
              source: SOURCE_ID,
              filter: buildPinsFilter(onlyMineRef.current, accountIdRef.current),
              minzoom: 5,
              layout: {
                visibility: visibleRef.current ? 'visible' : 'none',
              },
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  5,
                  12,
                  12,
                  16,
                  16,
                  22,
                ],
                'circle-color': '#000000',
                'circle-opacity': 0,
              },
            } as AnyLayer),
          );
        } catch (err) {
          console.warn('[CommunityPinsLayer] addLayer hit', err);
        }
      }

      if (!safeGetLayer(map, RING_LAYER_ID)) {
        try {
          map.addLayer(
            withTopSlot(map, {
              id: RING_LAYER_ID,
              type: 'circle',
              source: SOURCE_ID,
              filter: buildUnseenPinsFilter(onlyMineRef.current, accountIdRef.current),
              minzoom: 5,
              layout: {
                visibility: visibleRef.current ? 'visible' : 'none',
              },
              paint: {
                'circle-radius': UNSEEN_RING_RADIUS,
                'circle-color': '#22c55e',
                'circle-opacity': 0,
                'circle-stroke-color': '#22c55e',
                'circle-stroke-width': 3,
                'circle-stroke-opacity': 1,
              },
            } as AnyLayer),
          );
        } catch (err) {
          console.warn('[CommunityPinsLayer] addLayer unseen ring', err);
        }
      }

      if (!safeGetLayer(map, AVATAR_LAYER_ID)) {
        try {
          map.addLayer(
            withTopSlot(map, {
              id: AVATAR_LAYER_ID,
              type: 'symbol',
              source: SOURCE_ID,
              filter: buildPinsFilter(onlyMineRef.current, accountIdRef.current),
              minzoom: 5,
              layout: {
                visibility: visibleRef.current ? 'visible' : 'none',
                'icon-image': buildAccountMapPinIconExpression(),
                'icon-size': ICON_SIZE_BY_ZOOM,
                'icon-anchor': 'center',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-padding': 2,
              },
            } as AnyLayer),
          );
        } catch (err) {
          console.warn('[CommunityPinsLayer] addLayer avatar', err);
        }
      }

      applyPinsFilter(map, onlyMineRef.current, accountIdRef.current);
      applyVisibility(map, visibleRef.current);
      movePinsToTop(map);
      pushData();

      // Reset hit layer if an older build painted the ring on it.
      if (safeGetLayer(map, HIT_LAYER_ID)) {
        try {
          map.setPaintProperty(HIT_LAYER_ID, 'circle-color', '#000000');
          map.setPaintProperty(HIT_LAYER_ID, 'circle-opacity', 0);
          map.setPaintProperty(HIT_LAYER_ID, 'circle-stroke-width', 0);
        } catch {
          /* ignore */
        }
      }

      if (safeGetLayer(map, RING_LAYER_ID)) {
        try {
          map.setPaintProperty(RING_LAYER_ID, 'circle-radius', UNSEEN_RING_RADIUS);
          map.setPaintProperty(RING_LAYER_ID, 'circle-color', '#22c55e');
          map.setPaintProperty(RING_LAYER_ID, 'circle-opacity', 0);
          map.setPaintProperty(RING_LAYER_ID, 'circle-stroke-color', '#22c55e');
          map.setPaintProperty(RING_LAYER_ID, 'circle-stroke-width', 3);
          map.setPaintProperty(RING_LAYER_ID, 'circle-stroke-opacity', 1);
        } catch {
          /* ignore */
        }
      }

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
      try {
        map.triggerRepaint();
      } catch {
        /* ignore */
      }
      return true;
    };

    const run = () => {
      void ensure();
    };

    run();
    const unsub = mapDataStore.subscribe(SOURCE_ID, () => {
      if (cancelled) return;
      void ensure();
    });
    const onStyle = () => run();
    map.on('style.load', onStyle);

    return () => {
      cancelled = true;
      unsub();
      map.off('style.load', onStyle);
      map.off('styleimagemissing', onMissing);
      if (!isMapStyleReady(map)) return;
      try {
        for (const id of [...LAYER_IDS].reverse()) {
          if (safeGetLayer(map, id)) map.removeLayer(id);
        }
        if (safeGetSource(map, SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* style torn down */
      }
    };
  }, [map, ready]);

  // Split so flipping a toggle (common case) only pays for the cheap layout
  // property — `setFilter` recompiles a style-spec expression and is far
  // pricier, so it only reruns when the account scope actually changes.
  useEffect(() => {
    if (!map || !ready || !isMapStyleReady(map)) return;
    applyVisibility(map, visible);
  }, [map, ready, visible]);

  useEffect(() => {
    if (!map || !ready || !isMapStyleReady(map)) return;
    applyPinsFilter(map, onlyMine, accountId);
  }, [map, ready, onlyMine, accountId]);

  return null;
}
