/**
 * Explore record fetch: single source of truth for /explore/[table]/[id].
 * Uses liveBoundaryCache when data is cached; otherwise fetches by id.
 * One fetch per record, cached by (table, id).
 */

import {
  getStateBoundary,
  getCountyBoundaries,
  getCTUBoundaries,
  getCongressionalDistricts,
} from './liveBoundaryCache';

export type ExploreLayerType = 'state' | 'county' | 'ctu' | 'district';

export type ExploreRecordResult = {
  record: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
  centroid: [number, number];
  layerType: ExploreLayerType;
};

/** Map explore table slug → layer type */
const TABLE_TO_LAYER: Record<string, ExploreLayerType> = {
  state: 'state',
  counties: 'county',
  'cities-and-towns': 'ctu',
  'congressional-districts': 'district',
};

/** In-memory cache for single-record fetches (when not in boundary cache) */
const recordCache = new Map<string, ExploreRecordResult>();

function cacheKey(table: string, id: string): string {
  return `${table}:${id}`;
}

function centroidFromGeometry(geometry: GeoJSON.Geometry | null | undefined): [number, number] {
  if (!geometry || (geometry as { type?: string }).type === 'Point') return [-93.265, 44.9778];
  const geom = geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  const coords = geom.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return [-93.265, 44.9778];
  const ring = Array.isArray(coords[0]?.[0]) && typeof coords[0][0][0] === 'number' ? coords[0][0] : coords[0];
  const pt = ring?.[0];
  if (!Array.isArray(pt) || pt.length < 2) return [-93.265, 44.9778];
  return [Number(pt[0]), Number(pt[1])];
}

function extractGeometry(data: unknown): GeoJSON.Geometry | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as {
    geometry?: { type?: string; coordinates?: unknown; features?: { geometry?: GeoJSON.Geometry }[] };
    coordinates?: unknown;
  };
  const geom = d.geometry;
  if (!geom) return d.coordinates ? { type: 'Polygon', coordinates: d.coordinates as GeoJSON.Polygon['coordinates'] } : null;
  if (geom.type === 'FeatureCollection' && Array.isArray(geom.features) && geom.features[0]?.geometry) {
    return geom.features[0].geometry;
  }
  if (geom.type && geom.coordinates) return geom as GeoJSON.Geometry;
  return null;
}

/**
 * Fetch a single explore record by table slug and id.
 * Uses cache when the full dataset is loaded; otherwise fetches by id.
 */
export async function fetchExploreRecord(
  table: string,
  id: string
): Promise<ExploreRecordResult | null> {
  const layerType = TABLE_TO_LAYER[table];
  if (!layerType || !id) return null;

  const key = cacheKey(table, id);
  const cached = recordCache.get(key);
  if (cached) return cached;

  try {
    if (table === 'state') {
      const data = await getStateBoundary();
      const stateId = (data as { id?: string }).id ?? 'mn';
      if (stateId !== id && id !== 'mn') return null;
      const geometry = extractGeometry(data) ?? (data as { geometry?: GeoJSON.Geometry }).geometry ?? null;
      const geomForCentroid = geometry ?? (data as { geometry?: { coordinates?: unknown } }).geometry;
      const coords = (geomForCentroid as { coordinates?: unknown[] })?.coordinates;
      const ring = Array.isArray(coords?.[0]?.[0]) ? coords![0][0] : coords?.[0];
      const pt = Array.isArray(ring?.[0]) ? ring[0] : null;
      const centroid: [number, number] = pt && pt.length >= 2 ? [Number(pt[0]), Number(pt[1])] : [-93.265, 44.9778];
      const result: ExploreRecordResult = {
        record: { ...(data as object), geometry: undefined } as Record<string, unknown>,
        geometry,
        centroid,
        layerType: 'state',
      };
      recordCache.set(key, result);
      return result;
    }

    if (table === 'counties') {
      const list = await getCountyBoundaries();
      let record = list.find((c) => c.id === id);
      if (!record) {
        const res = await fetch(`/api/civic/county-boundaries?id=${id}`);
        if (!res.ok) return null;
        const data = await res.json();
        record = Array.isArray(data) ? data[0] : data;
      }
      if (!record) return null;
      const geometry = extractGeometry(record);
      const cen = centroidFromGeometry(geometry);
      const result: ExploreRecordResult = {
        record: { ...(record as object), geometry: undefined } as Record<string, unknown>,
        geometry,
        centroid: [cen[0], cen[1]],
        layerType: 'county',
      };
      recordCache.set(key, result);
      return result;
    }

    if (table === 'cities-and-towns') {
      const list = await getCTUBoundaries();
      let record = list.find((c) => c.id === id);
      if (!record) {
        const res = await fetch(`/api/civic/ctu-boundaries?id=${id}`);
        if (!res.ok) return null;
        const data = await res.json();
        record = Array.isArray(data) ? data[0] : data;
      }
      if (!record) return null;
      const geometry = extractGeometry(record);
      const cen = centroidFromGeometry(geometry);
      const result: ExploreRecordResult = {
        record: { ...(record as object), geometry: undefined } as Record<string, unknown>,
        geometry,
        centroid: [cen[0], cen[1]],
        layerType: 'ctu',
      };
      recordCache.set(key, result);
      return result;
    }

    if (table === 'congressional-districts') {
      const list = await getCongressionalDistricts();
      const record = list.find(
        (d) =>
          (d as { id?: string }).id === id ||
          String((d as { district_number?: number }).district_number) === id
      );
      if (!record) return null;
      const geometry = extractGeometry(record);
      const cen = centroidFromGeometry(geometry);
      const result: ExploreRecordResult = {
        record: { ...(record as object), geometry: undefined } as Record<string, unknown>,
        geometry,
        centroid: [cen[0], cen[1]],
        layerType: 'district',
      };
      recordCache.set(key, result);
      return result;
    }
  } catch (err) {
    console.error('[exploreRecordService] fetchExploreRecord error:', err);
  }
  return null;
}
