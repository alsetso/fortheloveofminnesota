/**
 * TileViewportService — pure XYZ tile math + Mapbox viewport subscription.
 *
 * At zoom 18 (game lock), each tile covers ~38 m × ~38 m of ground.
 * The iOS game viewport sees ~4–9 tiles at any moment.
 *
 * This service converts map bounds → tile IDs, diffs added/removed sets on
 * moveend, and drives PlacementStreamService with a crisp tile-level signal.
 * No dependencies on React, stores, or network — pure math + event binding.
 */

import type { Map as MapboxMap, LngLatBounds } from 'mapbox-gl';

/** `z/x/y` — canonical string key for a Mercator tile. */
export type TileId = `${number}/${number}/${number}`;

// ─── Pure tile math ─────────────────────────────────────────────────────────

/**
 * Web Mercator tile column from longitude at integer zoom level.
 * Standard OSM/Mapbox slippy-map formula.
 */
function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}

/**
 * Web Mercator tile row from latitude at integer zoom level.
 * Uses Gudermannian inverse projection (ln(tan + sec)).
 */
function latToTileY(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      Math.pow(2, z),
  );
}

/** Convert a WGS-84 point to the XYZ tile that contains it at zoom `z`. */
export function latLngToTile(lat: number, lng: number, z: number): TileId {
  const x = lngToTileX(lng, z);
  const y = latToTileY(lat, z);
  return `${z}/${x}/${y}`;
}

/**
 * Return the WGS-84 bounding box of a tile.
 * Useful for building the bbox param sent to the placements API.
 */
export function tileToBbox(z: number, x: number, y: number): {
  west: number;
  south: number;
  east: number;
  north: number;
} {
  const n = Math.pow(2, z);
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const northRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const southRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  return {
    west,
    east,
    north: (northRad * 180) / Math.PI,
    south: (southRad * 180) / Math.PI,
  };
}

/** Unified bbox of a set of tile IDs — union of all individual tile bboxes. */
export function tileSetToBbox(tileIds: Set<TileId>): {
  west: number;
  south: number;
  east: number;
  north: number;
} | null {
  if (tileIds.size === 0) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const id of tileIds) {
    const [z, x, y] = id.split('/').map(Number) as [number, number, number];
    const b = tileToBbox(z, x, y);
    if (b.west < west) west = b.west;
    if (b.south < south) south = b.south;
    if (b.east > east) east = b.east;
    if (b.north > north) north = b.north;
  }
  return { west, south, east, north };
}

/**
 * All tile IDs fully or partially within `bounds` at integer zoom `z`.
 * Tiles are fetched at the game zoom (18) but snapped to an integer for
 * XYZ indexing. A small padding of 1 tile is added on each side so models
 * pop in slightly before the player reaches the edge.
 */
export function getBoundsTiles(bounds: LngLatBounds, z: number): Set<TileId> {
  const tiles = new Set<TileId>();
  const iz = Math.floor(z);

  // 1-tile padding so objects pre-load just before they enter the viewport
  const xMin = lngToTileX(bounds.getWest(), iz) - 1;
  const xMax = lngToTileX(bounds.getEast(), iz) + 1;
  const yMin = latToTileY(bounds.getNorth(), iz) - 1;
  const yMax = latToTileY(bounds.getSouth(), iz) + 1;

  const maxTile = Math.pow(2, iz) - 1;
  for (let x = Math.max(0, xMin); x <= Math.min(maxTile, xMax); x++) {
    for (let y = Math.max(0, yMin); y <= Math.min(maxTile, yMax); y++) {
      tiles.add(`${iz}/${x}/${y}`);
    }
  }
  return tiles;
}

/** Return all tiles visible in the current Mapbox viewport at integer `zoom`. */
export function getViewportTiles(map: MapboxMap, zoom?: number): Set<TileId> {
  try {
    const bounds = map.getBounds();
    if (!bounds) return new Set();
    const z = zoom ?? Math.floor(map.getZoom());
    return getBoundsTiles(bounds, z);
  } catch {
    return new Set();
  }
}

// ─── Viewport subscription ────────────────────────────────────────────────────

export type TileChangeCallback = (
  added: Set<TileId>,
  removed: Set<TileId>,
  current: Set<TileId>,
) => void;

/**
 * Subscribe to viewport tile changes.
 *
 * Fires immediately with the current viewport tiles (all as "added"),
 * then on every `moveend` with the diff against the previous set.
 * Uses `moveend` (not `move`) so the diff fires once per camera gesture,
 * not on every animation frame.
 *
 * @param map     Mapbox map instance
 * @param zoom    Integer tile zoom to use (default: current map zoom floored)
 * @param onChange  Callback with added, removed, and current tile sets
 * @returns Unsubscribe function
 */
export function subscribeViewportTiles(
  map: MapboxMap,
  zoom: number,
  onChange: TileChangeCallback,
): () => void {
  let current = new Set<TileId>();

  function handleChange() {
    const next = getViewportTiles(map, zoom);
    const added = new Set<TileId>();
    const removed = new Set<TileId>();

    for (const id of next) {
      if (!current.has(id)) added.add(id);
    }
    for (const id of current) {
      if (!next.has(id)) removed.add(id);
    }

    current = next;

    if (added.size > 0 || removed.size > 0) {
      onChange(added, removed, current);
    }
  }

  // Fire immediately with all current tiles as "added"
  const initial = getViewportTiles(map, zoom);
  current = initial;
  if (initial.size > 0) {
    onChange(initial, new Set(), initial);
  }

  map.on('moveend', handleChange);

  return () => {
    map.off('moveend', handleChange);
  };
}
