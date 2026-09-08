'use client';

/**
 * useCtuZoomFloor — enforces the user's current CTU (city/township boundary)
 * as the hard minimum zoom floor for the game surface.
 *
 * Runs once per CTU change:
 *   1. Resolves the CTU GeoJSON feature (mapDataStore → API fallback).
 *   2. Computes the zoom that fits the full CTU boundary using territoryFloorPadding.
 *   3. Calls map.setMinZoom(ctuFloorZoom) to set the baseline floor.
 *   4. Stores the value in ctuFloorZoomStore so clearTerritoryCameraLock can
 *      restore to this floor (not the global MAP_CONFIG.MIN_ZOOM) on deselect.
 *
 * On unmount, resets the floor to MAP_CONFIG.MIN_ZOOM as a safe fallback.
 */

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useSyncExternalStore } from 'react';
import { MAP_CONFIG } from '@/map/config';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import {
  boundsToMapbox,
  geometryLngLatBounds,
} from '@/map/geo/geometryLngLatBounds';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import { isFindMeZoomLocked } from '@/map/location/camera/flyToFindMe';
import { applyScoutZoomLimits } from '@/map/location/camera/scoutMapGestures';
import { getPresenceMode } from '@/map/location/positionMode/positionModeStore';
import {
  subscribeCurrentTerritoryStack,
  getCurrentTerritoryStackSnapshot,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';
import { setCtuFloorZoom } from './ctuFloorZoomStore';

/** Light padding matching territoryFloorPadding in focusTerritoryCamera.ts. */
function floorPadding(map: MapboxMap) {
  const bleed = MAP_CONFIG.BLEED_BOTTOM_PX;
  const hFull = map.getContainer().clientHeight || window.innerHeight;
  const h = Math.max(1, hFull - bleed);
  const w = map.getContainer().clientWidth || window.innerWidth;
  return {
    top:    Math.max(32, Math.round(h * 0.04)),
    left:   Math.max(24, Math.round(w * 0.04)),
    right:  Math.max(24, Math.round(w * 0.04)),
    bottom: Math.max(32, Math.round(h * 0.04)) + bleed,
  };
}

function featureFromDataStore(id: string): Feature<Geometry> | null {
  const fc = mapDataStore.get(MAP_SOURCE_IDS.ctus) as FeatureCollection;
  const match = fc.features.find((f) => {
    const fid = f.id ?? f.properties?.id;
    return fid != null && String(fid) === id;
  });
  return (match as Feature<Geometry> | undefined) ?? null;
}

async function resolveCtuFeature(
  id: string,
  signal: AbortSignal,
): Promise<Feature<Geometry> | null> {
  // Fast path — geometry already tiled into the GL source.
  const local = featureFromDataStore(id);
  if (local?.geometry) return local;

  // Fallback — server boundary fetch (same endpoint as territory selection).
  const res = await fetch(
    `/api/territory/selection?kind=ctu&id=${encodeURIComponent(id)}`,
    { signal, cache: 'force-cache' },
  );
  if (!res.ok) return null;
  const fc = (await res.json()) as FeatureCollection;
  return (fc.features[0] as Feature<Geometry> | undefined) ?? null;
}

export function useCtuZoomFloor(map: MapboxMap | null, ready: boolean): void {
  const stack = useSyncExternalStore(
    subscribeCurrentTerritoryStack,
    getCurrentTerritoryStackSnapshot,
    () => getCurrentTerritoryStackSnapshot(),
  );

  const ctuId = stack.jurisdictions.find((j) => j.kind === 'ctu')?.id ?? null;
  const appliedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map || !ready || !ctuId) return;
    if (appliedIdRef.current === ctuId) return;

    let cancelled = false;
    const ac = new AbortController();

    const apply = async () => {
      try {
        await waitForMapStyleReady(map, { timeoutMs: 10_000 });
        if (cancelled || ac.signal.aborted) return;

        const feature = await resolveCtuFeature(ctuId, ac.signal);
        if (cancelled || ac.signal.aborted || !feature?.geometry) return;

        const box = geometryLngLatBounds(feature.geometry);
        if (!box) return;

        const bounds = boundsToMapbox(box);
        const camera = map.cameraForBounds(bounds, {
          padding:  floorPadding(map),
          bearing:  map.getBearing(),
          pitch:    map.getPitch(),
        });

        if (camera?.zoom == null || !Number.isFinite(camera.zoom)) return;

        const floorZoom = camera.zoom;
        setCtuFloorZoom(floorZoom);
        appliedIdRef.current = ctuId;

        // Always store the CTU floor. Skip applying while Live close has
        // min=max pinned — unlock restores from the store.
        if (isFindMeZoomLocked()) return;

        // Scout owns a fixed 12–22 band — don't let the CTU floor raise/lower it.
        if (getPresenceMode() === 'scout') {
          applyScoutZoomLimits(map);
          return;
        }

        // Always apply the CTU floor as the baseline. Territory selection locks
        // call setMinZoom to a HIGHER value afterwards, so they win automatically.
        // clearTerritoryCameraLock restores to this value on deselect.
        try {
          map.setMinZoom(floorZoom);
        } catch {
          /* map removed */
        }
      } catch {
        /* network / map removed */
      }
    };

    void apply();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [map, ready, ctuId]);

  // Teardown: clear floor zoom store and restore global floor.
  useEffect(() => {
    return () => {
      setCtuFloorZoom(null);
      if (map && !isFindMeZoomLocked()) {
        try {
          if (getPresenceMode() === 'scout') applyScoutZoomLimits(map);
          else map.setMinZoom(MAP_CONFIG.MIN_ZOOM);
        } catch {
          /* map removed */
        }
      }
    };
  }, [map]);
}
