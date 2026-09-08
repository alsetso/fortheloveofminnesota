/**
 * World block grid — tile-anchored snap system for buildable 3D blocks.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MAPBOX / WEB MERCATOR TILE MATH (factual, no approximation)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Earth equatorial radius (WGS-84):  R = 6,378,137 m
 *  Full equatorial circumference:     C = 2π × R = 40,075,016.686 m
 *
 *  At Mapbox zoom Z there are 2^Z tiles across 360° longitude.
 *  Tile width in meters at geographic latitude φ:
 *
 *    tileWidthMeters(Z, φ) = C × cos(φ) / 2^Z
 *
 *  Values at Minnesota centroid (φ = 46.4°, cos = 0.6884):
 *
 *    Zoom 14 →  1,685 m / tile
 *    Zoom 15 →    842 m / tile
 *    Zoom 16 →    421 m / tile   ← GRID_ANCHOR_ZOOM
 *    Zoom 17 →    211 m / tile
 *    Zoom 18 →    105 m / tile
 *
 *  Universal block unit = 8 m.
 *    Chosen because 421 / 8 ≈ 52 blocks per zoom-16 tile — a power-of-2-ish
 *    subdivision that keeps blocks visually meaningful at city zoom levels.
 *    8 m also matches the width of a typical single-car garage / one lane of
 *    road, making it intuitive for real-world building placement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GRID COORDINATE SYSTEM
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Block (cellX, cellY) where:
 *    cellX = round( lng × metersPerDegLng / BLOCK_GRID_METERS )
 *    cellY = round( lat × metersPerDegLat / BLOCK_GRID_METERS )
 *
 *  This is an equirectangular grid — accurate to < 0.05 % across all of
 *  Minnesota (lat 43–49°). Cells are stable across sessions.
 *
 *  Cell key: "${cellX}:${cellY}"  — safe for DB keys, URL params, Map lookups.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

export const EARTH_RADIUS_M = 6_378_137;
export const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M; // 40,075,016.686 m

/** Anchor zoom for human-readable tile-size descriptions. */
export const GRID_ANCHOR_ZOOM = 16;
/** Minnesota geographic centroid — used for tile-size documentation. */
export const GRID_ANCHOR_LAT_DEG = 46.4;

/** Tile width in meters at zoom 16 over Minnesota. */
export const TILE_METERS_AT_ANCHOR =
  (EARTH_CIRCUMFERENCE_M * Math.cos((GRID_ANCHOR_LAT_DEG * Math.PI) / 180)) /
  Math.pow(2, GRID_ANCHOR_ZOOM);
// ≈ 421 m

/**
 * Universal block side-length in meters.
 * One block occupies one cell in the world grid.
 */
export const BLOCK_GRID_METERS = 8;

/**
 * Blocks per zoom-16 tile width ≈ 52.6.
 * Informational — not used in snap math.
 */
export const BLOCKS_PER_ANCHOR_TILE = TILE_METERS_AT_ANCHOR / BLOCK_GRID_METERS;

/** Category string that marks a model as a snappable block. */
export const BLOCK_MODEL_CATEGORY = 'block';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GridCell = {
  /** Integer X cell index (positive = east). */
  cellX: number;
  /** Integer Y cell index (positive = north). */
  cellY: number;
};

export type SnappedCoords = GridCell & {
  lat: number;
  lng: number;
};

// ── Core snap ─────────────────────────────────────────────────────────────────

/**
 * Convert degrees-latitude to meters from the equator (non-Mercator, accurate
 * for the small offsets we compute here).
 */
const METERS_PER_DEG_LAT = 110_540; // average — varies 110,574 at equator to 111,694 at poles

function metersPerDegLng(latDeg: number): number {
  return EARTH_CIRCUMFERENCE_M * Math.cos((latDeg * Math.PI) / 180) / 360;
}

/**
 * Snap a lat/lng to the nearest block-grid cell centre.
 * Returns both the cell indices and the snapped geographic coordinates.
 */
export function snapToBlockGrid(lat: number, lng: number): SnappedCoords {
  const mpdLng = metersPerDegLng(lat);

  const cellX = Math.round((lng * mpdLng) / BLOCK_GRID_METERS);
  const cellY = Math.round((lat * METERS_PER_DEG_LAT) / BLOCK_GRID_METERS);

  return {
    cellX,
    cellY,
    lat: (cellY * BLOCK_GRID_METERS) / METERS_PER_DEG_LAT,
    lng: (cellX * BLOCK_GRID_METERS) / mpdLng,
  };
}

/**
 * Snap only if `isBlockCategory` — pass-through for non-block models.
 * Keeps placement code one-liner clean.
 */
export function maybeSnapToGrid(
  lat: number,
  lng: number,
  category: string | null | undefined,
): { lat: number; lng: number } {
  if (category === BLOCK_MODEL_CATEGORY) return snapToBlockGrid(lat, lng);
  return { lat, lng };
}

// ── Cell key helpers ──────────────────────────────────────────────────────────

/** Stable string key for a cell: "${cellX}:${cellY}" */
export function blockCellKey(cell: GridCell): string {
  return `${cell.cellX}:${cell.cellY}`;
}

/** Stable key from a raw lat/lng (snaps internally). */
export function latLngToCellKey(lat: number, lng: number): string {
  return blockCellKey(snapToBlockGrid(lat, lng));
}

/** Parse a cell key back into a GridCell. Returns null if malformed. */
export function parseBlockCellKey(key: string): GridCell | null {
  const [xs, ys] = key.split(':');
  const cellX = Number(xs);
  const cellY = Number(ys);
  if (!Number.isFinite(cellX) || !Number.isFinite(cellY)) return null;
  return { cellX, cellY };
}

/** Cell centre coordinates from a parsed key. */
export function cellKeyToLatLng(
  key: string,
  refLat = GRID_ANCHOR_LAT_DEG,
): { lat: number; lng: number } | null {
  const cell = parseBlockCellKey(key);
  if (!cell) return null;
  // Use ref lat for mpdLng (accurate enough — cells are 8 m wide)
  const mpdLng = metersPerDegLng(refLat);
  return {
    lat: (cell.cellY * BLOCK_GRID_METERS) / METERS_PER_DEG_LAT,
    lng: (cell.cellX * BLOCK_GRID_METERS) / mpdLng,
  };
}

// ── Dev grid layer constants ──────────────────────────────────────────────────

/**
 * Mapbox layer / source IDs for the dev block-grid overlay.
 * Only added when NODE_ENV === 'development'.
 */
export const BLOCK_GRID_DEBUG_SOURCE_ID = 'ftlomn-block-grid-debug';
export const BLOCK_GRID_DEBUG_LAYER_ID = 'ftlomn-block-grid-debug-lines';

/**
 * Build a GeoJSON LineString FeatureCollection of grid lines covering a
 * lat/lng bounding box.  Used by the dev overlay — not called in production.
 */
export function buildBlockGridGeoJSON(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): GeoJSON.FeatureCollection<GeoJSON.MultiLineString> {
  const refLat = (minLat + maxLat) / 2;
  const mpdLng = metersPerDegLng(refLat);

  const startX = Math.floor((minLng * mpdLng) / BLOCK_GRID_METERS);
  const endX   = Math.ceil( (maxLng * mpdLng) / BLOCK_GRID_METERS);
  const startY = Math.floor((minLat * METERS_PER_DEG_LAT) / BLOCK_GRID_METERS);
  const endY   = Math.ceil( (maxLat * METERS_PER_DEG_LAT) / BLOCK_GRID_METERS);

  const lines: [number, number][][] = [];

  // Vertical lines (constant X)
  for (let x = startX; x <= endX; x += 1) {
    const lng = (x * BLOCK_GRID_METERS) / mpdLng;
    lines.push([
      [lng, minLat],
      [lng, maxLat],
    ]);
  }
  // Horizontal lines (constant Y)
  for (let y = startY; y <= endY; y += 1) {
    const lat = (y * BLOCK_GRID_METERS) / METERS_PER_DEG_LAT;
    lines.push([
      [minLng, lat],
      [maxLng, lat],
    ]);
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: lines },
      },
    ],
  };
}
