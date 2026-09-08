/**
 * Selected-point mark as a Mapbox circle layer (not HTML Marker).
 * Lands on the exact click lng/lat on a pitched 3D map.
 */

import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { isMapStyleReady } from '@/map/engine/mapStyleGuard';
import type { UserCoords } from '@/map/location/device/geolocation';

export const SELECTED_POINT_SOURCE = 'ftlomn-selected-point';
export const SELECTED_POINT_PULSE_LAYER = 'ftlomn-selected-point-pulse';
export const SELECTED_POINT_HALO_LAYER = 'ftlomn-selected-point-halo';
export const SELECTED_POINT_DOT_LAYER = 'ftlomn-selected-point-dot';

const EMPTY: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
};

/** Steady mark — never driven by the pulse animation. */
const HALO_RADIUS = 16;
const HALO_OPACITY = 0.28;
const DOT_RADIUS = 8;

function pointFc(coords: UserCoords): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [coords.lng, coords.lat],
        },
      },
    ],
  };
}

function circlePaint(base: Record<string, unknown>) {
  return {
    'circle-pitch-alignment': 'map' as const,
    // Viewport scale keeps a readable disc at street zoom + heavy pitch.
    'circle-pitch-scale': 'viewport' as const,
    ...base,
  };
}

function addCircleLayer(
  map: MapboxMap,
  id: string,
  paint: Record<string, unknown>,
): void {
  if (map.getLayer(id)) return;
  const layer = {
    id,
    type: 'circle' as const,
    source: SELECTED_POINT_SOURCE,
    paint: circlePaint(paint),
    ...(mapUsesMapboxStandard(map) ? { slot: 'top' as const } : {}),
  };
  try {
    map.addLayer(layer);
  } catch {
    // Slot rejected on non-Standard — retry without.
    try {
      const { slot: _slot, ...rest } = layer as typeof layer & { slot?: string };
      void _slot;
      map.addLayer(rest);
    } catch {
      /* style race */
    }
  }
}

function bringToFront(map: MapboxMap): void {
  for (const id of [
    SELECTED_POINT_PULSE_LAYER,
    SELECTED_POINT_HALO_LAYER,
    SELECTED_POINT_DOT_LAYER,
  ]) {
    try {
      if (map.getLayer(id)) map.moveLayer(id);
    } catch {
      /* ignore */
    }
  }
}

function resetSteadyPaint(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  try {
    if (map.getLayer(SELECTED_POINT_HALO_LAYER)) {
      map.setPaintProperty(SELECTED_POINT_HALO_LAYER, 'circle-radius', HALO_RADIUS);
      map.setPaintProperty(SELECTED_POINT_HALO_LAYER, 'circle-opacity', HALO_OPACITY);
    }
    if (map.getLayer(SELECTED_POINT_DOT_LAYER)) {
      map.setPaintProperty(SELECTED_POINT_DOT_LAYER, 'circle-radius', DOT_RADIUS);
      map.setPaintProperty(SELECTED_POINT_DOT_LAYER, 'circle-opacity', 0.92);
    }
    if (map.getLayer(SELECTED_POINT_PULSE_LAYER)) {
      map.setPaintProperty(SELECTED_POINT_PULSE_LAYER, 'circle-radius', DOT_RADIUS);
      map.setPaintProperty(SELECTED_POINT_PULSE_LAYER, 'circle-opacity', 0);
    }
  } catch {
    /* style race */
  }
}

function ensureLayers(map: MapboxMap): boolean {
  if (!isMapStyleReady(map)) return false;

  if (!map.getSource(SELECTED_POINT_SOURCE)) {
    try {
      map.addSource(SELECTED_POINT_SOURCE, {
        type: 'geojson',
        data: EMPTY,
      });
    } catch {
      return false;
    }
  }

  // Pulse ring (animated) → steady halo → solid core. Core always stays lit.
  addCircleLayer(map, SELECTED_POINT_PULSE_LAYER, {
    'circle-radius': DOT_RADIUS,
    'circle-color': '#007AFF',
    'circle-opacity': 0,
    'circle-stroke-width': 0,
  });
  addCircleLayer(map, SELECTED_POINT_HALO_LAYER, {
    'circle-radius': HALO_RADIUS,
    'circle-color': '#007AFF',
    'circle-opacity': HALO_OPACITY,
    'circle-stroke-width': 0,
  });
  addCircleLayer(map, SELECTED_POINT_DOT_LAYER, {
    'circle-radius': DOT_RADIUS,
    'circle-color': '#007AFF',
    'circle-opacity': 0.92,
    'circle-stroke-width': 2.5,
    'circle-stroke-color': '#ffffff',
  });

  bringToFront(map);
  resetSteadyPaint(map);
  return Boolean(map.getLayer(SELECTED_POINT_DOT_LAYER));
}

let pulseRaf = 0;
let pulseToken = 0;
/** Last placed coords — re-paint after style.reload. */
let lastCoords: UserCoords | null = null;

function runPulse(map: MapboxMap): void {
  window.cancelAnimationFrame(pulseRaf);
  const token = ++pulseToken;
  // Never leave the steady mark faded from a prior cancelled pulse.
  resetSteadyPaint(map);

  if (!map.getLayer(SELECTED_POINT_PULSE_LAYER)) return;

  const start = performance.now();
  const duration = 900;

  const tick = (now: number) => {
    if (token !== pulseToken) return;
    if (!isMapStyleReady(map) || !map.getLayer(SELECTED_POINT_PULSE_LAYER)) {
      return;
    }

    const t = Math.min(1, (now - start) / duration);
    const radius = DOT_RADIUS + t * 28;
    const opacity = 0.45 * (1 - t) * (1 - t);
    try {
      map.setPaintProperty(SELECTED_POINT_PULSE_LAYER, 'circle-radius', radius);
      map.setPaintProperty(SELECTED_POINT_PULSE_LAYER, 'circle-opacity', opacity);
    } catch {
      return;
    }

    if (t < 1) {
      pulseRaf = window.requestAnimationFrame(tick);
    } else {
      try {
        map.setPaintProperty(SELECTED_POINT_PULSE_LAYER, 'circle-opacity', 0);
        map.setPaintProperty(SELECTED_POINT_PULSE_LAYER, 'circle-radius', DOT_RADIUS);
      } catch {
        /* ignore */
      }
    }
  };

  pulseRaf = window.requestAnimationFrame(tick);
}

/** Place / move the ground circle and fire a pulse. */
export function syncSelectedPointCircle(
  map: MapboxMap,
  coords: UserCoords | null,
): void {
  lastCoords = coords;
  if (!isMapStyleReady(map)) return;

  if (!coords) {
    clearSelectedPointCircle(map);
    return;
  }

  if (!ensureLayers(map)) return;

  const source = map.getSource(SELECTED_POINT_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(pointFc(coords));
  bringToFront(map);
  resetSteadyPaint(map);
  runPulse(map);
  map.triggerRepaint?.();
}

/** Re-apply after style.load using the last known point. */
export function restoreSelectedPointCircle(map: MapboxMap): void {
  syncSelectedPointCircle(map, lastCoords);
}

export function clearSelectedPointCircle(map: MapboxMap | null | undefined): void {
  window.cancelAnimationFrame(pulseRaf);
  pulseToken += 1;
  lastCoords = null;
  if (!map || !isMapStyleReady(map)) return;
  try {
    const source = map.getSource(SELECTED_POINT_SOURCE) as GeoJSONSource | undefined;
    source?.setData(EMPTY);
    resetSteadyPaint(map);
  } catch {
    /* style gone */
  }
}

export function removeSelectedPointCircleLayers(
  map: MapboxMap | null | undefined,
): void {
  window.cancelAnimationFrame(pulseRaf);
  pulseToken += 1;
  lastCoords = null;
  if (!map || !isMapStyleReady(map)) return;
  try {
    for (const id of [
      SELECTED_POINT_DOT_LAYER,
      SELECTED_POINT_HALO_LAYER,
      SELECTED_POINT_PULSE_LAYER,
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(SELECTED_POINT_SOURCE)) map.removeSource(SELECTED_POINT_SOURCE);
  } catch {
    /* style gone */
  }
}
