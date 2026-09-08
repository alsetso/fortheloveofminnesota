'use client';

import { useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import type { ExpressionSpecification, Map as MapboxMap } from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
} from '@/map/engine/mapStyleGuard';

const FILL_SOURCE_ID = MAP_SOURCE_IDS.stateMask;
const FILL_LAYER_ID = 'app-state-mask-fill';

/** Outside-MN cutout — soft cool wash that fades with atlas zoom. */
const MASK_FILL_COLOR = '#a0a8b0';
const MASK_FILL_OPACITY: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5.5,
  0.42,
  9,
  0.52,
  12,
  0.62,
] as ExpressionSpecification;

/** Dedicated source/layer for road-shield + place-label clipping. */
export const SYMBOL_CLIP_SOURCE_ID = 'app-state-symbol-clip-source';
export const SYMBOL_CLIP_LAYER_ID = 'app-state-symbol-clip';

/** Legacy id from earlier iterations — remove if still present. */
const LEGACY_CLIP_LAYER_IDS = ['app-state-label-clip'];
const LEGACY_CLIP_SOURCE_IDS = ['app-state-label-clip-source'];

/** Bump when symbolClip geometry / clip layout contract changes. */
const CUTOUT_CACHE_VERSION = 9;

type MaskPayload = {
  cutout: FeatureCollection;
  symbolClip: FeatureCollection;
  /** Raw MN polygon — shared with useMinnesotaLabelFilter to avoid a duplicate fetch. */
  minnesota: FeatureCollection | null;
};

let payloadCache: MaskPayload | null = null;
let payloadCacheVersion = 0;
let loadPromise: Promise<MaskPayload> | null = null;

/**
 * Returns the shared Minnesota polygon FeatureCollection that was loaded as
 * part of the state-boundary request. Resolves on the same promise as the
 * mask so there is never a duplicate network hit.
 */
export async function loadStateBoundaryMinnesota(): Promise<FeatureCollection | null> {
  const payload = await loadMaskPayload().catch(() => null);
  return payload?.minnesota ?? null;
}

let ensureLock = false;
let ensureQueued: { map: MapboxMap; payload: MaskPayload } | null = null;

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as FeatureCollection).type === 'FeatureCollection' &&
    Array.isArray((value as FeatureCollection).features)
  );
}

function isAlreadyExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /already exists/i.test(msg);
}

async function loadMaskPayload(): Promise<MaskPayload> {
  if (payloadCache && payloadCacheVersion === CUTOUT_CACHE_VERSION) {
    return payloadCache;
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch('/api/civic/state-boundary');
    if (!res.ok) throw new Error(`State boundary fetch failed (${res.status})`);
    const payload = (await res.json()) as {
      cutout?: unknown;
      symbolClip?: unknown;
      minnesota?: unknown;
      diagnostics?: unknown;
      error?: string;
    };
    if (!isFeatureCollection(payload.cutout) || !payload.cutout.features.length) {
      throw new Error(payload.error || 'State cutout missing');
    }
    if (
      !isFeatureCollection(payload.symbolClip) ||
      !payload.symbolClip.features.length
    ) {
      throw new Error('State symbolClip missing');
    }
    if (process.env.NODE_ENV === 'development' && payload.diagnostics) {
      console.info('[MinnesotaStateMask] diagnostics', payload.diagnostics);
    }
    const next: MaskPayload = {
      cutout: payload.cutout,
      symbolClip: payload.symbolClip,
      minnesota: isFeatureCollection(payload.minnesota) && payload.minnesota.features.length > 0
        ? payload.minnesota
        : null,
    };
    payloadCache = next;
    payloadCacheVersion = CUTOUT_CACHE_VERSION;
    return next;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

type GeoJsonSource = { setData: (data: FeatureCollection) => void };

function upsertGeoJsonSource(
  map: MapboxMap,
  sourceId: string,
  data: FeatureCollection,
): boolean {
  try {
    const existing = safeGetSource(map, sourceId) as GeoJsonSource | undefined;
    if (!existing) {
      map.addSource(sourceId, { type: 'geojson', data });
    } else {
      existing.setData(data);
    }
    return true;
  } catch (err) {
    if (isAlreadyExistsError(err)) {
      try {
        (safeGetSource(map, sourceId) as GeoJsonSource | undefined)?.setData(data);
        return true;
      } catch {
        /* fall through */
      }
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[MinnesotaStateMask] source ${sourceId}`, err);
    }
    return false;
  }
}

function removeLegacyClips(map: MapboxMap): void {
  for (const id of LEGACY_CLIP_LAYER_IDS) {
    try {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    } catch {
      /* ignore */
    }
  }
  for (const id of LEGACY_CLIP_SOURCE_IDS) {
    try {
      if (safeGetSource(map, id)) map.removeSource(id);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Road shields + city labels outside MN.
 *
 * Important Mapbox Standard details:
 * - `clip` only affects layers *below* it
 * - `clip-layer-types` must include `'symbol'` (shields + place labels)
 * - `clip-layer-scope: ['basemap']` targets Standard import layers (official example)
 * - Solid regional panels only — world-sized / holed clip geometry fails silently
 */
export function ensureSymbolClipLayer(
  map: MapboxMap,
  symbolClip: FeatureCollection,
): void {
  if (!upsertGeoJsonSource(map, SYMBOL_CLIP_SOURCE_ID, symbolClip)) return;

  const standard = mapUsesMapboxStandard(map);

  // If an older clip exists with bad layout (e.g. wrong scope), replace it.
  if (safeGetLayer(map, SYMBOL_CLIP_LAYER_ID)) {
    try {
      map.removeLayer(SYMBOL_CLIP_LAYER_ID);
    } catch {
      /* ignore */
    }
  }

  // Match Mapbox's official Standard clip example: no slot, clip symbols+models.
  // Scope 'basemap' keeps app pin/page symbols safe when they sit below this layer.
  const layout = {
    'clip-layer-types': ['symbol', 'model'] as string[],
    ...(standard ? { 'clip-layer-scope': ['basemap'] } : {}),
  };

  try {
    map.addLayer({
      id: SYMBOL_CLIP_LAYER_ID,
      type: 'clip',
      source: SYMBOL_CLIP_SOURCE_ID,
      layout,
    } as never);

    if (process.env.NODE_ENV === 'development') {
      console.info('[MinnesotaStateMask] symbol clip ready', {
        panels: symbolClip.features.length,
        standard,
        layout,
      });
    }
  } catch (err) {
    // Fallback: also try in top slot if root placement is rejected.
    try {
      map.addLayer({
        id: SYMBOL_CLIP_LAYER_ID,
        type: 'clip',
        source: SYMBOL_CLIP_SOURCE_ID,
        layout,
        ...(standard ? { slot: 'top' as const } : {}),
      } as never);
    } catch (err2) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MinnesotaStateMask] symbol clip failed', err, err2);
      }
    }
  }
}

function ensureMaskStack(map: MapboxMap, payload: MaskPayload): void {
  if (!isMapStyleReady(map)) return;

  if (ensureLock) {
    ensureQueued = { map, payload };
    return;
  }
  ensureLock = true;
  try {
    removeLegacyClips(map);

    const standard = mapUsesMapboxStandard(map);

    if (!upsertGeoJsonSource(map, FILL_SOURCE_ID, payload.cutout)) return;

    // White world cutout (holed polygon — OK for fill).
    if (!safeGetLayer(map, FILL_LAYER_ID)) {
      try {
        map.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: FILL_SOURCE_ID,
          paint: {
            'fill-color': MASK_FILL_COLOR,
            'fill-opacity': MASK_FILL_OPACITY,
            'fill-antialias': true,
          },
          ...(standard ? { slot: 'top' as const } : {}),
        } as never);
      } catch (err) {
        if (!isAlreadyExistsError(err) && process.env.NODE_ENV === 'development') {
          console.warn('[MinnesotaStateMask] fill layer', err);
        }
      }
    } else {
      try {
        map.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'visible');
        map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', MASK_FILL_OPACITY);
        map.setPaintProperty(FILL_LAYER_ID, 'fill-color', MASK_FILL_COLOR);
      } catch {
        /* ignore */
      }
    }

    // Clip ABOVE the fill — kills city labels + road shields in the panels.
    ensureSymbolClipLayer(map, payload.symbolClip);

    if (!standard && safeGetLayer(map, SYMBOL_CLIP_LAYER_ID)) {
      try {
        map.moveLayer(SYMBOL_CLIP_LAYER_ID);
      } catch {
        /* ignore */
      }
    }
  } finally {
    ensureLock = false;
    const queued = ensureQueued;
    ensureQueued = null;
    if (queued) ensureMaskStack(queued.map, queued.payload);
  }
}

/** Always-on grey outside-MN fog + symbol clip for road shields / place labels. */
export function useMinnesotaStateMask(
  map: MapboxMap | null,
  ready: boolean,
): void {
  useEffect(() => {
    if (!map || !ready) return;
    let cancelled = false;
    let payload: MaskPayload | null =
      payloadCacheVersion === CUTOUT_CACHE_VERSION ? payloadCache : null;

    const paint = () => {
      if (cancelled || !payload) return;
      ensureMaskStack(map, payload);
    };

    const onStyle = () => {
      paint();
      requestAnimationFrame(paint);
    };

    const onIdle = () => {
      if (!payload || cancelled) return;
      const missingFill =
        !safeGetLayer(map, FILL_LAYER_ID) || !safeGetSource(map, FILL_SOURCE_ID);
      const missingClip =
        !safeGetLayer(map, SYMBOL_CLIP_LAYER_ID) ||
        !safeGetSource(map, SYMBOL_CLIP_SOURCE_ID);
      if (missingFill || missingClip) paint();
    };

    void loadMaskPayload()
      .then((data) => {
        if (cancelled) return;
        payload = data;
        paint();
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MinnesotaStateMask]', err);
        }
      });

    map.on('style.load', onStyle);
    map.on('idle', onIdle);

    return () => {
      cancelled = true;
      map.off('style.load', onStyle);
      map.off('idle', onIdle);
    };
  }, [map, ready]);
}
