'use client';

/**
 * SavedAddressesLayer — renders the user's saved addresses as white 3D map pins.
 *
 * Uses the same Mapbox `model` layer mechanism as world placements:
 *   - GeoJSON source fed by savedAddressesStore / mapDataStore
 *   - `map-pin-white.glb` model registered once and filtered to this source
 *   - Transparent hit-circle layer for tap detection (same pattern as world props)
 *
 * The source holds ALL of the user's addresses (not tile-streamed) because the
 * count is small. The *rendering* path — addModel → model layer → GeoJSON source —
 * is identical to how WorldModelsLayer renders its props.
 */

import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, Point } from 'geojson';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import { useMapContext } from '@/map/MapProvider';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';

// ── Constants ──────────────────────────────────────────────────────────────────

const SOURCE_ID  = MAP_SOURCE_IDS.savedAddresses;

const WHITE_PIN_MODEL_ID  = 'ftlomn-map-pin-white';
const WHITE_PIN_MODEL_URL = '/models/props/map-pin-white.glb';

/** Mapbox model layer — renders the white GLB at each saved address. */
const MODEL_LAYER_ID = 'app-saved-addresses-model';
/** Transparent circle — gives Mapbox something to hit-test for tap events. */
const HIT_LAYER_ID   = 'app-saved-addresses-hit';

const MODEL_SCALE: [number, number, number]       = [3, 3, 3];
const MODEL_ROTATION: [number, number, number]    = [0, 0, 0];
const MODEL_TRANSLATION: [number, number, number] = [0, 0, 0];

const LAYER_IDS = [HIT_LAYER_ID, MODEL_LAYER_ID] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

type MapboxModelApi = MapboxMap & {
  addModel: (id: string, url: string) => void;
  hasModel?: (id: string) => boolean;
  removeModel?: (id: string) => void;
};

function supportsModels(map: MapboxMap): map is MapboxModelApi {
  return typeof (map as MapboxModelApi).addModel === 'function';
}

function registerWhitePin(map: MapboxMap): boolean {
  if (!supportsModels(map)) return false;
  try {
    if (!map.hasModel?.(WHITE_PIN_MODEL_ID)) {
      map.addModel(WHITE_PIN_MODEL_ID, WHITE_PIN_MODEL_URL);
    }
    return true;
  } catch {
    return false;
  }
}

function unregisterWhitePin(map: MapboxMap): void {
  if (!supportsModels(map)) return;
  try {
    if (map.hasModel?.(WHITE_PIN_MODEL_ID)) map.removeModel?.(WHITE_PIN_MODEL_ID);
  } catch { /* ignore */ }
}

function styleSlot(map: MapboxMap, prefer: 'top' | 'middle' = 'top') {
  return mapUsesMapboxStandard(map) ? { slot: prefer } : {};
}

// ── Layer ─────────────────────────────────────────────────────────────────────

/**
 * Always-on saved address white pin 3D layer.
 * Re-ensures source / layers after style.load and whenever data arrives.
 */
export function SavedAddressesLayer() {
  const { map, ready } = useMapContext();

  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;

    /** Push latest GeoJSON into the existing Mapbox source. */
    const pushData = () => {
      if (!isMapStyleReady(map)) return;
      try {
        const src = map.getSource(SOURCE_ID) as { setData?: (d: FeatureCollection) => void } | undefined;
        src?.setData?.(mapDataStore.get(SOURCE_ID) as FeatureCollection<Point>);
      } catch { /* mid-reload */ }
    };

    /** Create source + layers if missing; push latest data. */
    const ensure = (): boolean => {
      if (cancelled || !isMapStyleReady(map)) return false;

      // ── Source ────────────────────────────────────────────────────────────
      if (!safeGetSource(map, SOURCE_ID)) {
        try {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: mapDataStore.get(SOURCE_ID) as FeatureCollection<Point>,
            promoteId: 'id',
            generateId: false,
          });
        } catch (err) {
          console.warn('[SavedAddressesLayer] addSource', err);
          return false;
        }
      }

      // ── Model registration ────────────────────────────────────────────────
      const modelReady = registerWhitePin(map);

      // ── Transparent hit circle (tappability) ─────────────────────────────
      if (!safeGetLayer(map, HIT_LAYER_ID)) {
        try {
          map.addLayer({
            id: HIT_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 14,
              'circle-color': '#FFFFFF',
              'circle-opacity': 0,
            },
            ...styleSlot(map, 'top'),
          });
        } catch (err) {
          console.warn('[SavedAddressesLayer] addLayer hit', err);
        }
      }

      // ── White GLB model layer ─────────────────────────────────────────────
      if (modelReady && !safeGetLayer(map, MODEL_LAYER_ID)) {
        try {
          map.addLayer({
            id: MODEL_LAYER_ID,
            type: 'model' as const,
            source: SOURCE_ID,
            layout: {
              'model-id': WHITE_PIN_MODEL_ID,
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
          console.warn('[SavedAddressesLayer] addLayer model', err);
        }
      }

      pushData();
      try { map.triggerRepaint(); } catch { /* ignore */ }
      return true;
    };

    ensure();

    // Re-ensure whenever data changes (new saves, unsaves, tag edits).
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
      unregisterWhitePin(map);
    };
  }, [map, ready]);

  return null;
}
