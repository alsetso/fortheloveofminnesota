'use client';

/**
 * CtuBoundaryLayer — renders a subtle visual outline of the user's current
 * CTU (city/township/unorganized territory) on the game map.
 *
 * Visual spec:
 *   - Dashed line: #5BA3FF (ring blue), 1.5px, dash 6/4
 *   - Fill: #5BA3FF at 3 % opacity — barely-there tint
 *   - Visible at all game zoom levels (no zoom gate needed; it's a soft hint)
 *   - No map interaction — pointer-events none at the layer level
 *
 * Layers are purely additive; zero changes to locked-state, zoom, or dock logic.
 */

import { useEffect, useRef } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useSyncExternalStore } from 'react';
import { useMapContext } from '@/map/MapProvider';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  subscribeCurrentTerritoryStack,
  getCurrentTerritoryStackSnapshot,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';

const SOURCE_ID       = 'ctu-floor-boundary';
const FILL_LAYER_ID   = 'ctu-floor-fill';
const LINE_LAYER_ID   = 'ctu-floor-line';
const LABEL_LAYER_ID  = 'ctu-floor-label';
const RING_BLUE       = '#5BA3FF';
const LABEL_MIN_ZOOM  = 10;
const LABEL_MAX_ZOOM  = 15;

// ─── GL layer helpers ──────────────────────────────────────────────────────────

function ensureCtuLayers(map: import('mapbox-gl').Map): void {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] } as FeatureCollection,
    });
  }

  if (!map.getLayer(FILL_LAYER_ID)) {
    map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color':   RING_BLUE,
        'fill-opacity': 0.03,
      },
    });
  }

  if (!map.getLayer(LINE_LAYER_ID)) {
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: {
        'line-color':     RING_BLUE,
        'line-opacity':   0.22,
        'line-width':     1.5,
        'line-dasharray': [6, 4],
      },
    });
  }

  if (!map.getLayer(LABEL_LAYER_ID)) {
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      minzoom: LABEL_MIN_ZOOM,
      maxzoom: LABEL_MAX_ZOOM,
      layout: {
        'symbol-placement':      'line',
        'symbol-spacing':        320,
        'text-field':            ['get', 'name'],
        'text-font':             ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-size':             12,
        'text-letter-spacing':   0.04,
        'text-max-angle':        30,
        'text-keep-upright':     true,
        'text-padding':          4,
        'text-allow-overlap':    false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color':      '#ffffff',
        'text-halo-color': 'rgba(0, 0, 0, 0.72)',
        'text-halo-width': 1.5,
        'text-opacity': [
          'interpolate', ['linear'], ['zoom'],
          LABEL_MIN_ZOOM,     0,
          LABEL_MIN_ZOOM + 1, 1,
          LABEL_MAX_ZOOM - 1, 1,
          LABEL_MAX_ZOOM,     0,
        ],
      },
    });
  }
}

function setCtuBoundaryData(
  map: import('mapbox-gl').Map,
  feature: Feature<Geometry> | null,
  name?: string | null,
): void {
  const src = map.getSource(SOURCE_ID) as import('mapbox-gl').GeoJSONSource | undefined;
  if (!src) return;

  if (!feature) {
    src.setData({ type: 'FeatureCollection', features: [] } as FeatureCollection);
    return;
  }

  // Inject name into properties so the label layer can read it.
  const enriched: Feature<Geometry> = {
    ...feature,
    properties: { ...(feature.properties ?? {}), name: name ?? feature.properties?.name ?? '' },
  };
  src.setData({ type: 'FeatureCollection', features: [enriched] } as FeatureCollection);
}

function removeCtuLayers(map: import('mapbox-gl').Map): void {
  try { map.removeLayer(LABEL_LAYER_ID); } catch { /* already gone */ }
  try { map.removeLayer(LINE_LAYER_ID);  } catch { /* already gone */ }
  try { map.removeLayer(FILL_LAYER_ID);  } catch { /* already gone */ }
  try { map.removeSource(SOURCE_ID);     } catch { /* already gone */ }
}

// ─── Geometry resolution ───────────────────────────────────────────────────────

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
  const local = featureFromDataStore(id);
  if (local?.geometry) return local;

  const res = await fetch(
    `/api/territory/selection?kind=ctu&id=${encodeURIComponent(id)}`,
    { signal, cache: 'force-cache' },
  );
  if (!res.ok) return null;
  const fc = (await res.json()) as FeatureCollection;
  return (fc.features[0] as Feature<Geometry> | undefined) ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CtuBoundaryLayer() {
  const { map, ready } = useMapContext();

  const stack = useSyncExternalStore(
    subscribeCurrentTerritoryStack,
    getCurrentTerritoryStackSnapshot,
    () => getCurrentTerritoryStackSnapshot(),
  );

  const ctuEntry = stack.jurisdictions.find((j) => j.kind === 'ctu') ?? null;
  const ctuId   = ctuEntry?.id   ?? null;
  const ctuName = ctuEntry?.name ?? null;
  const lastCtuIdRef = useRef<string | null>(null);

  // ── Initial layer setup + style reload ──────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    const ac = new AbortController();

    const paint = async (id: string | null, name: string | null) => {
      try {
        await waitForMapStyleReady(map, { timeoutMs: 10_000 });
        if (cancelled || ac.signal.aborted) return;
        ensureCtuLayers(map);
        if (!id) { setCtuBoundaryData(map, null); return; }

        const feature = await resolveCtuFeature(id, ac.signal);
        if (cancelled || ac.signal.aborted) return;
        setCtuBoundaryData(map, feature, name);
        lastCtuIdRef.current = id;
      } catch {
        /* aborted / network */
      }
    };

    const onStyleLoad = () => {
      lastCtuIdRef.current = null;
      void paint(ctuId, ctuName);
    };

    void paint(ctuId, ctuName);
    map.on('style.load', onStyleLoad);

    return () => {
      cancelled = true;
      ac.abort();
      map.off('style.load', onStyleLoad);
      removeCtuLayers(map);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready]);

  // ── CTU change — repaint boundary ───────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;
    if (lastCtuIdRef.current === ctuId) return;

    const ac = new AbortController();
    void (async () => {
      try {
        await waitForMapStyleReady(map, { timeoutMs: 10_000 });
        if (ac.signal.aborted) return;
        ensureCtuLayers(map);

        if (!ctuId) { setCtuBoundaryData(map, null); lastCtuIdRef.current = null; return; }

        const feature = await resolveCtuFeature(ctuId, ac.signal);
        if (ac.signal.aborted) return;
        setCtuBoundaryData(map, feature, ctuName);
        lastCtuIdRef.current = ctuId;
      } catch {
        /* aborted / network */
      }
    })();

    return () => { ac.abort(); };
  }, [map, ready, ctuId, ctuName]);

  return null;
}
