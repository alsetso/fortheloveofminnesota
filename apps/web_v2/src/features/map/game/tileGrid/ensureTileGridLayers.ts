/**
 * Mapbox layer management for the tile grid feature.
 *
 * Two independent overlays, each independently togglable:
 *
 * 1. Satellite raster layer — Mapbox Satellite imagery rendered as a ground
 *    plane at `slot: 'bottom'` so it sits under buildings/models.
 *
 * 2. Tile grid lines — GeoJSON polygon outlines for each visible tile at the
 *    current integer zoom, useful for spatial awareness and debugging.
 *    Rendered at `slot: 'middle'` so they're visible above the satellite but
 *    below 3D buildings and world models.
 */

import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, Polygon } from 'geojson';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
} from '@/map/engine/mapStyleGuard';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';

// ---------------------------------------------------------------------------
// Source / layer ID constants
// ---------------------------------------------------------------------------

export const TILE_GRID_SATELLITE_SOURCE_ID = 'ftl-tile-grid-satellite';
export const TILE_GRID_SATELLITE_LAYER_ID  = 'ftl-tile-grid-satellite-layer';

export const TILE_GRID_LINES_SOURCE_ID = 'ftl-tile-grid-lines';
export const TILE_GRID_LINES_LAYER_ID  = 'ftl-tile-grid-lines-layer';

// ---------------------------------------------------------------------------
// Satellite raster source + layer
// ---------------------------------------------------------------------------

function ensureSatelliteSource(map: MapboxMap, token: string): void {
  if (safeGetSource(map, TILE_GRID_SATELLITE_SOURCE_ID)) return;
  try {
    map.addSource(TILE_GRID_SATELLITE_SOURCE_ID, {
      type: 'raster',
      tiles: [
        `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${token}`,
      ],
      tileSize: 512,
      attribution: '© Mapbox © OpenStreetMap',
    });
  } catch {
    /* style race */
  }
}

function ensureSatelliteLayer(map: MapboxMap): void {
  if (safeGetLayer(map, TILE_GRID_SATELLITE_LAYER_ID)) return;
  const usesStandard = mapUsesMapboxStandard(map);
  try {
    map.addLayer({
      id: TILE_GRID_SATELLITE_LAYER_ID,
      type: 'raster',
      source: TILE_GRID_SATELLITE_SOURCE_ID,
      paint: {
        'raster-opacity': 0.72,
        'raster-fade-duration': 300,
        'raster-saturation': -0.15,
        'raster-brightness-min': 0.05,
      },
      ...(usesStandard ? { slot: 'bottom' as const } : {}),
    });
  } catch {
    /* race or unsupported */
  }
}

// ---------------------------------------------------------------------------
// Tile grid lines source + layers
// ---------------------------------------------------------------------------

function ensureGridLinesSource(
  map: MapboxMap,
  data: FeatureCollection<Polygon>,
): void {
  const existing = safeGetSource(map, TILE_GRID_LINES_SOURCE_ID);
  if (existing) {
    try {
      (existing as GeoJSONSource).setData(data);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    map.addSource(TILE_GRID_LINES_SOURCE_ID, {
      type: 'geojson',
      data,
    });
  } catch {
    /* style race */
  }
}

function ensureGridLinesLayers(map: MapboxMap): void {
  const usesStandard = mapUsesMapboxStandard(map);
  // 'top' guarantees visibility above basemap fills and 3D terrain at any pitch.
  const slot = usesStandard ? { slot: 'top' as const } : {};

  if (!safeGetLayer(map, TILE_GRID_LINES_LAYER_ID)) {
    try {
      map.addLayer({
        id: TILE_GRID_LINES_LAYER_ID,
        type: 'line',
        source: TILE_GRID_LINES_SOURCE_ID,
        paint: {
          'line-color': '#888888',
          'line-width': 1.5,
          'line-opacity': 0.9,
        },
        ...slot,
      });
    } catch {
      /* race */
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type TileGridLayerOptions = {
  /** Mapbox access token (required for satellite tile URL). */
  token: string;
  /** Whether to show satellite imagery ground plane. */
  showSatellite: boolean;
  /** Whether to draw tile boundary lines. */
  showGridLines: boolean;
  /** Current tile boundary polygons to render as grid lines. */
  gridData: FeatureCollection<Polygon>;
};

export function ensureTileGridLayers(
  map: MapboxMap,
  opts: TileGridLayerOptions,
): void {
  if (!isMapStyleReady(map)) return;

  if (opts.showSatellite) {
    ensureSatelliteSource(map, opts.token);
    ensureSatelliteLayer(map);
  } else {
    removeSatelliteLayers(map);
  }

  if (opts.showGridLines) {
    ensureGridLinesSource(map, opts.gridData);
    ensureGridLinesLayers(map);
  } else {
    removeGridLineLayers(map);
  }
}

function removeSatelliteLayers(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  try {
    if (safeGetLayer(map, TILE_GRID_SATELLITE_LAYER_ID)) {
      map.removeLayer(TILE_GRID_SATELLITE_LAYER_ID);
    }
  } catch { /* ignore */ }
  try {
    if (safeGetSource(map, TILE_GRID_SATELLITE_SOURCE_ID)) {
      map.removeSource(TILE_GRID_SATELLITE_SOURCE_ID);
    }
  } catch { /* ignore */ }
}

function removeGridLineLayers(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  for (const id of [TILE_GRID_LINES_LAYER_ID]) {
    try {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    } catch { /* ignore */ }
  }
  try {
    if (safeGetSource(map, TILE_GRID_LINES_SOURCE_ID)) {
      map.removeSource(TILE_GRID_LINES_SOURCE_ID);
    }
  } catch { /* ignore */ }
}

export function removeTileGridLayers(map: MapboxMap): void {
  removeSatelliteLayers(map);
  removeGridLineLayers(map);
}

/** Update only the GeoJSON source data (called on map move without full re-ensure). */
export function syncTileGridData(
  map: MapboxMap,
  data: FeatureCollection<Polygon>,
): void {
  if (!isMapStyleReady(map)) return;
  const src = safeGetSource(map, TILE_GRID_LINES_SOURCE_ID);
  if (!src) return;
  try {
    (src as GeoJSONSource).setData(data);
  } catch { /* ignore */ }
}
