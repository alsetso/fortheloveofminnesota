/**
 * Web Mercator (XYZ / Slippy Map) tile math.
 *
 * All tiles are 256×256 px. The projection is EPSG:3857 (Web Mercator).
 * Latitude is clamped to ±85.05113° — the standard cutoff that keeps the
 * world map square (so the quadtree stays a perfect power-of-two grid).
 *
 * Key formula at Minneapolis latitude (~44.98°N), zoom 18.5:
 *   meters/tile ≈ 0.306 m/px × 256 px ≈ 78.3 m per tile side
 *   Each tile is effectively square on the ground (Mercator is conformal).
 */

/** Earth radius used by Web Mercator (WGS 84 semi-major axis, meters). */
const EARTH_RADIUS_M = 6_378_137;

/** Ground resolution (meters/pixel) at the equator, zoom 0. */
const MPP_ZOOM0_EQUATOR = (2 * Math.PI * EARTH_RADIUS_M) / 256;

export type TileCoord = { z: number; x: number; y: number };

export type TileBounds = {
  /** Top-left corner (NW). */
  nw: { lng: number; lat: number };
  /** Bottom-right corner (SE). */
  se: { lng: number; lat: number };
  /** Center of the tile. */
  center: { lng: number; lat: number };
  /** Side length in meters (approximately square — Mercator is conformal). */
  sideMeters: number;
};

// ---------------------------------------------------------------------------
// Core conversions
// ---------------------------------------------------------------------------

/** Clamp latitude to the Web Mercator valid range. */
export function clampLat(lat: number): number {
  return Math.max(-85.05113, Math.min(85.05113, lat));
}

/** Convert lat/lng + zoom to the containing tile coordinate. */
export function lngLatToTile(lng: number, lat: number, zoom: number): TileCoord {
  const z = Math.floor(zoom);
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (clampLat(lat) * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { z, x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/** Convert a tile coordinate back to its NW corner lng/lat. */
export function tileToNWLngLat(tile: TileCoord): { lng: number; lat: number } {
  const n = Math.pow(2, tile.z);
  const lng = (tile.x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n)));
  return { lng, lat: (latRad * 180) / Math.PI };
}

/** Full bounds + center + metric size for a tile. */
export function tileBounds(tile: TileCoord): TileBounds {
  const nw = tileToNWLngLat(tile);
  const se = tileToNWLngLat({ z: tile.z, x: tile.x + 1, y: tile.y + 1 });
  const centerLat = (nw.lat + se.lat) / 2;
  const centerLng = (nw.lng + se.lng) / 2;
  const mpp = metersPerPixel(tile.z, centerLat);
  return {
    nw,
    se,
    center: { lat: centerLat, lng: centerLng },
    sideMeters: mpp * 256,
  };
}

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Ground resolution in meters per pixel at a given zoom and latitude.
 * Multiply by 256 to get tile side length in real-world meters.
 *
 * @example metersPerPixel(18.5, 44.98) ≈ 0.306 m/px
 */
export function metersPerPixel(zoom: number, latDeg: number): number {
  return (MPP_ZOOM0_EQUATOR * Math.cos((latDeg * Math.PI) / 180)) / Math.pow(2, zoom);
}

/**
 * Tile side length in meters at a given zoom and latitude.
 *
 * @example tileSideMeters(18.5, 44.98) ≈ 78.3 m
 */
export function tileSideMeters(zoom: number, latDeg: number): number {
  return metersPerPixel(zoom, latDeg) * 256;
}

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

/**
 * Returns all tile coordinates in a (2*radius+1)² grid centred on the tile
 * containing the given lat/lng. `radius=2` → 5×5 = 25 tiles; `radius=3` → 7×7.
 *
 * Tiles are clamped to valid [0, 2^z) range so edge-of-world requests are safe.
 */
export function surroundingTiles(
  lng: number,
  lat: number,
  zoom: number,
  radius = 2,
): TileCoord[] {
  const center = lngLatToTile(lng, lat, zoom);
  const n = Math.pow(2, center.z);
  const tiles: TileCoord[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = (center.x + dx + n) % n; // wrap longitude
      const y = center.y + dy;
      if (y < 0 || y >= n) continue; // clamp latitude (poles don't wrap)
      tiles.push({ z: center.z, x, y });
    }
  }
  return tiles;
}

/**
 * Build a GeoJSON FeatureCollection of tile-boundary polygons for a set of tiles.
 * Useful for rendering a tile grid overlay on the Mapbox map.
 */
export function tileBoundsGeoJson(tiles: TileCoord[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: 'FeatureCollection',
    features: tiles.map((t) => {
      const { nw, se } = tileBounds(t);
      return {
        type: 'Feature',
        id: `${t.z}/${t.x}/${t.y}`,
        properties: { z: t.z, x: t.x, y: t.y, key: `${t.z}/${t.x}/${t.y}` },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [nw.lng, nw.lat],
            [se.lng, nw.lat],
            [se.lng, se.lat],
            [nw.lng, se.lat],
            [nw.lng, nw.lat],
          ]],
        },
      };
    }),
  };
}

/**
 * Mapbox XYZ tile URL template — swap `{z}/{x}/{y}` at request time.
 * Works with any XYZ-compatible tile server (Mapbox, OSM, custom).
 */
export function tileUrl(
  template: string,
  tile: TileCoord,
): string {
  return template
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
}
