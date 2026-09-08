'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, Point } from 'geojson';
import { useDirectoryPagesVisible } from '@/features/map/directory/directoryPagesVisibilityStore';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import { useMapContext } from '@/map/MapProvider';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';

// ── Constants ──────────────────────────────────────────────────────────────────

const SOURCE_ID = MAP_SOURCE_IDS.pages;

const BLUE_PIN_MODEL_ID  = 'ftlomn-map-pin-blue';
const BLUE_PIN_MODEL_URL = '/models/props/map-pin-blue.glb';

/** Transparent hit circle — Mapbox queryRenderedFeatures target for tap events. */
const HIT_LAYER_ID   = 'app-directory-pages-hit';
/** Blue GLB map pin rendered at each page location. */
const MODEL_LAYER_ID = 'app-directory-pages-model';

const LAYER_IDS = [HIT_LAYER_ID, MODEL_LAYER_ID] as const;

const MODEL_SCALE: [number, number, number]       = [3, 3, 3];
const MODEL_ROTATION: [number, number, number]    = [0, 0, 0];
const MODEL_TRANSLATION: [number, number, number] = [0, 0, 0];

const MIN_ZOOM = 5;

// ── Helpers ────────────────────────────────────────────────────────────────────

type MapboxModelApi = MapboxMap & {
  addModel: (id: string, url: string) => void;
  hasModel?: (id: string) => boolean;
  removeModel?: (id: string) => void;
};

function supportsModels(map: MapboxMap): map is MapboxModelApi {
  return typeof (map as MapboxModelApi).addModel === 'function';
}

function registerBluePin(map: MapboxMap): boolean {
  if (!supportsModels(map)) return false;
  try {
    if (!map.hasModel?.(BLUE_PIN_MODEL_ID)) {
      map.addModel(BLUE_PIN_MODEL_ID, BLUE_PIN_MODEL_URL);
    }
    return true;
  } catch {
    return false;
  }
}

function unregisterBluePin(map: MapboxMap): void {
  if (!supportsModels(map)) return;
  try {
    if (map.hasModel?.(BLUE_PIN_MODEL_ID)) map.removeModel?.(BLUE_PIN_MODEL_ID);
  } catch { /* ignore */ }
}

function styleSlot(map: MapboxMap, prefer: 'top' | 'middle' = 'top') {
  return mapUsesMapboxStandard(map) ? { slot: prefer } : {};
}

function applyVisibility(map: MapboxMap, visible: boolean): void {
  const vis = visible ? 'visible' : 'none';
  for (const id of LAYER_IDS) {
    if (!safeGetLayer(map, id)) continue;
    try {
      map.setLayoutProperty(id, 'visibility', vis);
    } catch { /* ignore */ }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * User-generated directory pages as blue 3D GLB map pins.
 *
 * Rendering model: GeoJSON source (mapDataStore) → transparent hit circle +
 * `map-pin-blue.glb` model layer. Mirrors the SavedAddressesLayer pattern.
 *
 * Always mount this inside DirectoryPagesProvider so the source data is
 * populated before the layer tries to render.
 */
export function DirectoryPagesLayer() {
  const { map, ready } = useMapContext();
  const pagesOn = useDirectoryPagesVisible();
  const pagesOnRef = useRef(pagesOn);
  pagesOnRef.current = pagesOn;

  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;

    const pushData = () => {
      if (!isMapStyleReady(map)) return;
      try {
        const src = map.getSource(SOURCE_ID) as
          | { setData?: (d: FeatureCollection) => void }
          | undefined;
        src?.setData?.(mapDataStore.get(SOURCE_ID) as FeatureCollection<Point>);
      } catch { /* mid-reload */ }
    };

    const ensure = (): boolean => {
      if (cancelled || !isMapStyleReady(map)) return false;

      // ── Source ──────────────────────────────────────────────────────────────
      if (!safeGetSource(map, SOURCE_ID)) {
        try {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: mapDataStore.get(SOURCE_ID) as FeatureCollection<Point>,
            promoteId: 'id',
            generateId: false,
          });
        } catch (err) {
          console.warn('[DirectoryPagesLayer] addSource', err);
          return false;
        }
      }

      // ── Model registration ────────────────────────────────────────────────
      const modelReady = registerBluePin(map);

      // ── Hit circle (tap detection) ────────────────────────────────────────
      if (!safeGetLayer(map, HIT_LAYER_ID)) {
        try {
          map.addLayer({
            id: HIT_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['geometry-type'], 'Point'],
            minzoom: MIN_ZOOM,
            layout: { visibility: pagesOnRef.current ? 'visible' : 'none' },
            paint: {
              'circle-radius': 16,
              'circle-color': '#0a84ff',
              'circle-opacity': 0,
            },
            ...styleSlot(map, 'top'),
          });
        } catch (err) {
          console.warn('[DirectoryPagesLayer] addLayer hit', err);
        }
      }

      // ── Blue GLB model layer ────────────────────────────────────────────────
      if (modelReady && !safeGetLayer(map, MODEL_LAYER_ID)) {
        try {
          map.addLayer({
            id: MODEL_LAYER_ID,
            type: 'model' as const,
            source: SOURCE_ID,
            filter: ['==', ['geometry-type'], 'Point'],
            minzoom: MIN_ZOOM,
            layout: {
              'model-id': BLUE_PIN_MODEL_ID,
              visibility: pagesOnRef.current ? 'visible' : 'none',
            },
            paint: {
              'model-type': 'common-3d' as const,
              'model-scale': MODEL_SCALE as unknown as [number, number, number],
              'model-rotation': MODEL_ROTATION as unknown as [number, number, number],
              'model-translation': MODEL_TRANSLATION as unknown as [number, number, number],
              'model-elevation-reference': 'ground' as const,
              'model-opacity': 1,
            } as Record<string, unknown>,
            ...styleSlot(map, 'top'),
          } as Parameters<typeof map.addLayer>[0]);
        } catch (err) {
          console.warn('[DirectoryPagesLayer] addLayer model', err);
        }
      }

      applyVisibility(map, pagesOnRef.current);
      pushData();
      try { map.triggerRepaint(); } catch { /* ignore */ }
      return true;
    };

    ensure();

    const unsub = mapDataStore.subscribe(SOURCE_ID, () => {
      if (cancelled) return;
      if (!ensure()) pushData();
    });

    const onStyle = () => ensure();
    map.on('style.load', onStyle);

    const onIdle = () => ensure();
    map.once('idle', onIdle);

    return () => {
      cancelled = true;
      unsub();
      map.off('style.load', onStyle);
      map.off('idle', onIdle);
      if (!isMapStyleReady(map)) return;
      try {
        for (const id of [...LAYER_IDS].reverse()) {
          if (safeGetLayer(map, id)) map.removeLayer(id);
        }
        if (safeGetSource(map, SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch { /* style torn down */ }
      unregisterBluePin(map);
    };
  }, [map, ready]);

  // Sync visibility toggle without tearing down/recreating layers.
  useEffect(() => {
    if (!map || !ready || !isMapStyleReady(map)) return;
    applyVisibility(map, pagesOn);
  }, [map, ready, pagesOn]);

  return null;
}
