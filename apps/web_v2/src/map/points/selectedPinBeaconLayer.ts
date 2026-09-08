/**
 * Selected-point 3D beacon model layer.
 *
 * Renders `map-pin-selected.glb` (red pulse beacon) at the tapped lat/lng
 * using a Mapbox `model` layer — the same mechanism as world placements.
 *
 * Falls back gracefully when `map.addModel` is unavailable (non-Standard styles
 * or older Mapbox builds) — caller checks the return value and can render the
 * legacy circle instead.
 */

import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';
import type { UserCoords } from '@/map/location/device/geolocation';

export const SELECTED_BEACON_SOURCE    = 'ftlomn-selected-beacon';
export const SELECTED_BEACON_LAYER_ID  = 'ftlomn-selected-beacon-model';
export const SELECTED_BEACON_MODEL_ID  = 'ftlomn-map-pin-selected';
export const SELECTED_BEACON_MODEL_URL = '/models/props/map-pin-selected.glb';

// ── Grey variant — save-pending / saved address beacon ────────────────────────
export const GREY_BEACON_MODEL_ID  = 'ftlomn-map-pin-grey';
export const GREY_BEACON_MODEL_URL = '/models/props/map-pin-grey.glb';

// ── Blue variant — post-composing / posted beacon ─────────────────────────────
export const BLUE_BEACON_MODEL_ID  = 'ftlomn-map-pin-blue';
export const BLUE_BEACON_MODEL_URL = '/models/props/map-pin-blue.glb';

// ── Green variant — page-composing (Create a Page) beacon ─────────────────────
export const GREEN_BEACON_MODEL_ID  = 'ftlomn-map-pin-green';
export const GREEN_BEACON_MODEL_URL = '/models/props/map-pin-green.glb';

const MODEL_SCALE: [number, number, number]       = [3, 3, 3];
const MODEL_ROTATION: [number, number, number]    = [0, 0, 0];
const MODEL_TRANSLATION: [number, number, number] = [0, 0, 0];

const EMPTY: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

function pointFc(coords: UserCoords): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 1,
        properties: {
          modelId: SELECTED_BEACON_MODEL_ID,
          modelScale: MODEL_SCALE,
          modelRotation: MODEL_ROTATION,
          modelTranslation: MODEL_TRANSLATION,
        },
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
      },
    ],
  };
}

type MapboxModelApi = {
  addModel: (id: string, url: string) => void;
  hasModel?: (id: string) => boolean;
  setLayoutProperty: (layer: string, name: string, value: unknown) => void;
};

/** Register a GLB with the Mapbox model registry — idempotent. Returns false when unsupported. */
function registerModel(map: MapboxMap): boolean {
  if (typeof (map as unknown as Record<string, unknown>).addModel !== 'function') return false;
  try {
    const m = map as unknown as MapboxModelApi;
    if (!m.hasModel?.(SELECTED_BEACON_MODEL_ID)) {
      m.addModel(SELECTED_BEACON_MODEL_ID, SELECTED_BEACON_MODEL_URL);
    }
    // Pre-register the grey variant so the swap is instant — no network stall.
    if (!m.hasModel?.(GREY_BEACON_MODEL_ID)) {
      m.addModel(GREY_BEACON_MODEL_ID, GREY_BEACON_MODEL_URL);
    }
    // Pre-register the blue variant for post-composing / posted states.
    if (!m.hasModel?.(BLUE_BEACON_MODEL_ID)) {
      m.addModel(BLUE_BEACON_MODEL_ID, BLUE_BEACON_MODEL_URL);
    }
    // Pre-register the green variant for page-composing (Create a Page) state.
    if (!m.hasModel?.(GREEN_BEACON_MODEL_ID)) {
      m.addModel(GREEN_BEACON_MODEL_ID, GREEN_BEACON_MODEL_URL);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Hot-swap the beacon model between red, grey, and blue without touching source data.
 * Safe to call while the layer is live — Mapbox re-paints on the next frame.
 */
export function switchSelectedBeaconModel(
  map: MapboxMap,
  modelId:
    | typeof SELECTED_BEACON_MODEL_ID
    | typeof GREY_BEACON_MODEL_ID
    | typeof BLUE_BEACON_MODEL_ID
    | typeof GREEN_BEACON_MODEL_ID,
): void {
  if (!safeGetLayer(map, SELECTED_BEACON_LAYER_ID)) return;
  try {
    map.setLayoutProperty(SELECTED_BEACON_LAYER_ID, 'model-id', modelId);
    map.triggerRepaint?.();
  } catch {
    /* layer may have been removed during style transition */
  }
}

function ensureLayer(map: MapboxMap): boolean {
  if (!isMapStyleReady(map)) return false;
  if (!registerModel(map)) return false;

  if (!safeGetSource(map, SELECTED_BEACON_SOURCE)) {
    try {
      map.addSource(SELECTED_BEACON_SOURCE, { type: 'geojson', data: EMPTY });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, SELECTED_BEACON_LAYER_ID)) {
    const layer = {
      id: SELECTED_BEACON_LAYER_ID,
      type: 'model' as const,
      source: SELECTED_BEACON_SOURCE,
      layout: {
        'model-id': SELECTED_BEACON_MODEL_ID,
      },
      paint: {
        'model-type': 'common-3d' as const,
        'model-scale': MODEL_SCALE as unknown as [number, number, number],
        'model-rotation': MODEL_ROTATION as unknown as [number, number, number],
        'model-translation': MODEL_TRANSLATION as unknown as [number, number, number],
        'model-elevation-reference': 'ground' as const,
        'model-opacity': 1,
      } as Record<string, unknown>,
      ...(mapUsesMapboxStandard(map) ? { slot: 'top' as const } : {}),
    };
    try {
      map.addLayer(layer as Parameters<typeof map.addLayer>[0]);
    } catch {
      return false;
    }
  }

  return Boolean(safeGetLayer(map, SELECTED_BEACON_LAYER_ID));
}

/** Last placed coords — re-paint after style.load. */
let lastCoords: UserCoords | null = null;

/**
 * Place / move the 3D beacon at `coords`.
 * Returns `true` when the model layer is live; `false` means caller should
 * fall back to the legacy circle.
 */
export function syncSelectedPinBeacon(
  map: MapboxMap,
  coords: UserCoords | null,
): boolean {
  lastCoords = coords;
  if (!isMapStyleReady(map)) return false;

  if (!coords) {
    clearSelectedPinBeacon(map);
    return true;
  }

  if (!ensureLayer(map)) return false;

  const source = safeGetSource(map, SELECTED_BEACON_SOURCE) as GeoJSONSource | undefined;
  if (!source) return false;
  source.setData(pointFc(coords));
  map.triggerRepaint?.();
  return true;
}

/** Re-apply after style.load using the last known point. */
export function restoreSelectedPinBeacon(map: MapboxMap): void {
  syncSelectedPinBeacon(map, lastCoords);
}

export function clearSelectedPinBeacon(map: MapboxMap | null | undefined): void {
  lastCoords = null;
  if (!map || !isMapStyleReady(map)) return;
  try {
    const source = safeGetSource(map, SELECTED_BEACON_SOURCE) as GeoJSONSource | undefined;
    source?.setData(EMPTY);
  } catch {
    /* style gone */
  }
}

export function removeSelectedPinBeaconLayers(map: MapboxMap | null | undefined): void {
  lastCoords = null;
  if (!map || !isMapStyleReady(map)) return;
  try {
    if (safeGetLayer(map, SELECTED_BEACON_LAYER_ID)) map.removeLayer(SELECTED_BEACON_LAYER_ID);
    if (safeGetSource(map, SELECTED_BEACON_SOURCE)) map.removeSource(SELECTED_BEACON_SOURCE);
  } catch {
    /* style gone */
  }
}

/**
 * Remove beacon layers from a secondary map instance (e.g. an inline compose
 * map) WITHOUT touching the module-level `lastCoords` singleton — that
 * singleton belongs to the main game map so style-reloads restore correctly.
 */
export function removeSecondaryBeaconLayers(map: MapboxMap | null | undefined): void {
  if (!map || !isMapStyleReady(map)) return;
  try {
    if (safeGetLayer(map, SELECTED_BEACON_LAYER_ID)) map.removeLayer(SELECTED_BEACON_LAYER_ID);
    if (safeGetSource(map, SELECTED_BEACON_SOURCE)) map.removeSource(SELECTED_BEACON_SOURCE);
  } catch {
    /* style gone */
  }
}
