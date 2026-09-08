/**
 * Ground-plane user mark — Mapbox circle layers (not HTML Marker).
 *
 * `dot`    — Story / Explore: filled blue pin.
 * `avatar` — Campaign / Game: halo + fill disc + ring under the 3D player.
 *
 * The 3D mesh lives in player/playerAvatarRuntime. This module only paints
 * the circle stack glued to the presentation pose.
 */

import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';
import type { UserCoords } from '@/map/location/device/geolocation';

export const USER_MAP_POSITION_SOURCE = 'ftlomn-user-map-position';
export const USER_MAP_POSITION_HALO_LAYER = 'ftlomn-user-map-position-halo';
/** Solid inner fill — avatar ground-plane shadow disc. */
export const USER_MAP_POSITION_FILL_LAYER = 'ftlomn-user-map-position-fill';
export const USER_MAP_POSITION_DOT_LAYER = 'ftlomn-user-map-position-dot';

export type UserMapPositionVariant = 'avatar' | 'dot';

export type SyncUserMapPositionOpts = {
  variant?: UserMapPositionVariant;
  /** Fire a short pulse on the halo (GPS tick). */
  pulse?: boolean;
  /**
   * Center marker visibility.
   * Avatar → ground-plane feet disc. Explore / Story → classic blue pin.
   */
  dotVisible?: boolean;
  /** Soft outer wash around the center marker. */
  haloVisible?: boolean;
};

const EMPTY: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
};

const HALO_RADIUS = 18;
/** Outer soft wash around avatar feet. */
const HALO_RADIUS_FEET = 24;
/** Outer stroke ring around the solid fill — visible boundary. */
const FEET_RING_RADIUS = 11;
/** Solid inner fill disc — the ground shadow under the avatar (iOS-style). */
const FEET_FILL_RADIUS = 8;
const DOT_RADIUS_DOT = 8;

const FEET_RING_COLOR = '#007AFF';

type LastState = {
  coords: UserCoords | null;
  variant: UserMapPositionVariant;
};

let last: LastState = {
  coords: null,
  variant: 'avatar',
};

let pulseRaf = 0;
let pulseToken = 0;

function pointFc(coords: UserCoords): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
      },
    ],
  };
}

function circlePaint(base: Record<string, unknown>) {
  return {
    'circle-pitch-alignment': 'map' as const,
    'circle-pitch-scale': 'viewport' as const,
    ...base,
  };
}

function slotProps(map: MapboxMap, slot: 'top' | 'middle' = 'top') {
  return mapUsesMapboxStandard(map) ? { slot } : {};
}

function addCircleLayer(
  map: MapboxMap,
  id: string,
  paint: Record<string, unknown>,
  slot: 'top' | 'middle' = 'top',
): void {
  if (safeGetLayer(map, id)) return;
  const layer = {
    id,
    type: 'circle' as const,
    source: USER_MAP_POSITION_SOURCE,
    paint: circlePaint(paint),
    ...slotProps(map, slot),
  };
  try {
    map.addLayer(layer);
  } catch {
    try {
      const { slot: _s, ...rest } = layer as typeof layer & { slot?: string };
      void _s;
      map.addLayer(rest);
    } catch {
      /* style race */
    }
  }
}

function ensureSourceAndCircles(map: MapboxMap): boolean {
  if (!isMapStyleReady(map)) return false;

  if (!safeGetSource(map, USER_MAP_POSITION_SOURCE)) {
    try {
      map.addSource(USER_MAP_POSITION_SOURCE, {
        type: 'geojson',
        data: EMPTY,
      });
    } catch {
      return false;
    }
  }

  // All layers sit in the 'middle' slot so they render under the 3D player
  // model but on top of terrain/road geometry.

  addCircleLayer(
    map,
    USER_MAP_POSITION_HALO_LAYER,
    {
      'circle-radius': HALO_RADIUS,
      'circle-color': FEET_RING_COLOR,
      'circle-opacity': 0.15,
      'circle-stroke-width': 0,
    },
    'middle',
  );

  addCircleLayer(
    map,
    USER_MAP_POSITION_FILL_LAYER,
    {
      'circle-radius': FEET_FILL_RADIUS,
      'circle-color': FEET_RING_COLOR,
      'circle-opacity': 0.22,
      'circle-stroke-width': 0,
    },
    'middle',
  );

  addCircleLayer(
    map,
    USER_MAP_POSITION_DOT_LAYER,
    {
      'circle-radius': DOT_RADIUS_DOT,
      'circle-color': FEET_RING_COLOR,
      'circle-opacity': 0,
      'circle-stroke-width': 2.5,
      'circle-stroke-color': FEET_RING_COLOR,
      'circle-stroke-opacity': 0.9,
    },
    'middle',
  );

  return Boolean(safeGetLayer(map, USER_MAP_POSITION_DOT_LAYER));
}

/**
 * Explore / Story = classic blue pin.
 * Avatar = iOS-style ground-plane shadow:
 *   - Soft outer halo wash
 *   - Solid inner fill disc (ground shadow)
 *   - Crisp outer stroke ring
 */
function applyPositionCircleStyle(
  map: MapboxMap,
  variant: UserMapPositionVariant,
): void {
  const isFeet = variant === 'avatar';
  try {
    if (safeGetLayer(map, USER_MAP_POSITION_HALO_LAYER)) {
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-pitch-alignment', 'map');
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-pitch-scale', 'map');
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-radius', isFeet ? HALO_RADIUS_FEET : HALO_RADIUS);
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-color', FEET_RING_COLOR);
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-opacity', isFeet ? 0.18 : 0.22);
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-stroke-width', 0);
    }

    if (safeGetLayer(map, USER_MAP_POSITION_FILL_LAYER)) {
      map.setLayoutProperty(
        USER_MAP_POSITION_FILL_LAYER,
        'visibility',
        isFeet ? 'visible' : 'none',
      );
      if (isFeet) {
        map.setPaintProperty(USER_MAP_POSITION_FILL_LAYER, 'circle-pitch-alignment', 'map');
        map.setPaintProperty(USER_MAP_POSITION_FILL_LAYER, 'circle-pitch-scale', 'map');
        map.setPaintProperty(USER_MAP_POSITION_FILL_LAYER, 'circle-radius', FEET_FILL_RADIUS);
        map.setPaintProperty(USER_MAP_POSITION_FILL_LAYER, 'circle-color', FEET_RING_COLOR);
        map.setPaintProperty(USER_MAP_POSITION_FILL_LAYER, 'circle-opacity', 0.18);
        map.setPaintProperty(USER_MAP_POSITION_FILL_LAYER, 'circle-stroke-width', 0);
      }
    }

    if (safeGetLayer(map, USER_MAP_POSITION_DOT_LAYER)) {
      map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-pitch-alignment', 'map');
      map.setPaintProperty(
        USER_MAP_POSITION_DOT_LAYER,
        'circle-pitch-scale',
        isFeet ? 'map' : 'viewport',
      );
      if (isFeet) {
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-radius', FEET_RING_RADIUS);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-color', FEET_RING_COLOR);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-opacity', 0);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-stroke-width', 2.5);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-stroke-color', FEET_RING_COLOR);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-stroke-opacity', 0.9);
      } else {
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-radius', DOT_RADIUS_DOT);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-color', FEET_RING_COLOR);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-opacity', 0.95);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-stroke-width', 2.5);
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-stroke-color', '#ffffff');
        map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-stroke-opacity', 1);
      }
    }
  } catch {
    /* style race */
  }
}

function setDotVisible(map: MapboxMap, visible: boolean, radius: number): void {
  if (!safeGetLayer(map, USER_MAP_POSITION_DOT_LAYER)) return;
  const isFeet = radius === FEET_RING_RADIUS;
  try {
    map.setLayoutProperty(
      USER_MAP_POSITION_DOT_LAYER,
      'visibility',
      visible ? 'visible' : 'none',
    );
    map.setPaintProperty(USER_MAP_POSITION_DOT_LAYER, 'circle-radius', radius);

    if (safeGetLayer(map, USER_MAP_POSITION_FILL_LAYER)) {
      map.setLayoutProperty(
        USER_MAP_POSITION_FILL_LAYER,
        'visibility',
        visible && isFeet ? 'visible' : 'none',
      );
    }
  } catch {
    /* ignore */
  }
}

function setHaloVisible(map: MapboxMap, visible: boolean): void {
  if (!safeGetLayer(map, USER_MAP_POSITION_HALO_LAYER)) return;
  try {
    map.setLayoutProperty(
      USER_MAP_POSITION_HALO_LAYER,
      'visibility',
      visible ? 'visible' : 'none',
    );
  } catch {
    /* ignore */
  }
}

/** Move geo center without restyling (walk ticks). */
export function syncUserMapPositionCoords(
  map: MapboxMap,
  coords: UserCoords,
): void {
  const source = safeGetSource(map, USER_MAP_POSITION_SOURCE) as
    | GeoJSONSource
    | undefined;
  if (!source) return;
  last = { ...last, coords };
  try {
    source.setData(pointFc(coords));
  } catch {
    /* style race — this.style can go null mid-tick (dock resize / setStyle) */
  }
}

function runPulse(map: MapboxMap): void {
  window.cancelAnimationFrame(pulseRaf);
  const token = ++pulseToken;
  if (!safeGetLayer(map, USER_MAP_POSITION_HALO_LAYER)) return;

  try {
    map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-radius', HALO_RADIUS);
    map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-opacity', 0.22);
  } catch {
    return;
  }

  const start = performance.now();
  const duration = 700;
  const tick = (now: number) => {
    if (token !== pulseToken) return;
    if (!isMapStyleReady(map) || !safeGetLayer(map, USER_MAP_POSITION_HALO_LAYER)) return;
    const t = Math.min(1, (now - start) / duration);
    const radius = HALO_RADIUS + t * 22;
    const opacity = 0.35 * (1 - t) * (1 - t);
    try {
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-radius', radius);
      map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-opacity', opacity);
    } catch {
      return;
    }
    if (t < 1) pulseRaf = window.requestAnimationFrame(tick);
    else {
      try {
        map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-radius', HALO_RADIUS);
        map.setPaintProperty(USER_MAP_POSITION_HALO_LAYER, 'circle-opacity', 0.22);
      } catch {
        /* ignore */
      }
    }
  };
  pulseRaf = window.requestAnimationFrame(tick);
}

/**
 * Place / move / restyle the user position layers.
 * Pass `coords: null` to hide (Find Me idle / error).
 */
export function syncUserMapPosition(
  map: MapboxMap,
  coords: UserCoords | null,
  opts: SyncUserMapPositionOpts = {},
): void {
  const variant = opts.variant ?? last.variant;

  last = { coords, variant };

  if (!isMapStyleReady(map)) return;

  if (!coords) {
    clearUserMapPosition(map);
    return;
  }

  if (!ensureSourceAndCircles(map)) return;

  const source = safeGetSource(map, USER_MAP_POSITION_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData(pointFc(coords));

  const haloVisible = opts.haloVisible !== false;
  const centerVisible = opts.dotVisible !== false;
  const centerRadius = variant === 'avatar' ? FEET_RING_RADIUS : DOT_RADIUS_DOT;

  applyPositionCircleStyle(map, variant);
  setDotVisible(map, centerVisible, centerRadius);
  setHaloVisible(map, haloVisible);

  if (opts.pulse) runPulse(map);
  map.triggerRepaint?.();
}

/** Re-apply after style.load. */
export function restoreUserMapPosition(map: MapboxMap): void {
  const { coords, variant } = last;
  syncUserMapPosition(map, coords, { variant, pulse: false });
}

export function clearUserMapPosition(map: MapboxMap | null | undefined): void {
  window.cancelAnimationFrame(pulseRaf);
  pulseToken += 1;
  if (!map || !isMapStyleReady(map)) return;
  try {
    const source = safeGetSource(map, USER_MAP_POSITION_SOURCE) as GeoJSONSource | undefined;
    source?.setData(EMPTY);
  } catch {
    /* style gone */
  }
}

export function removeUserMapPositionLayers(
  map: MapboxMap | null | undefined,
): void {
  window.cancelAnimationFrame(pulseRaf);
  pulseToken += 1;
  last = { coords: null, variant: 'avatar' };
  if (!map || !isMapStyleReady(map)) return;
  try {
    for (const id of [
      USER_MAP_POSITION_DOT_LAYER,
      USER_MAP_POSITION_FILL_LAYER,
      USER_MAP_POSITION_HALO_LAYER,
    ]) {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    }
    if (safeGetSource(map, USER_MAP_POSITION_SOURCE)) {
      map.removeSource(USER_MAP_POSITION_SOURCE);
    }
  } catch {
    /* ignore */
  }
}
