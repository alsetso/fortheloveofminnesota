/**
 * Live map boundary data cache: one fetch per boundary type per session.
 * Data is cached in memory; we do not call the API again for the same boundary type
 * after the first successful load. Deduplicates in-flight requests so concurrent
 * callers share the same promise. Used by Explore map layers (state, county, CTU,
 * congressional districts, water, school-districts).
 */

export type StateBoundaryData = { geometry: GeoJSON.FeatureCollection; [key: string]: unknown };
export type CountyBoundaryRecord = { id: string; geometry: GeoJSON.FeatureCollection; [key: string]: unknown };
export type CTUBoundaryRecord = { id: string; geometry: GeoJSON.FeatureCollection; [key: string]: unknown };
export type DistrictBoundaryRecord = { district_number: number; geometry: GeoJSON.FeatureCollection; [key: string]: unknown };
export type WaterBoundaryRecord = { id: string; name?: string | null; gnis_name?: string | null; nhd_feature_id?: string | null; geometry?: GeoJSON.Geometry | null; [key: string]: unknown };
export type SchoolDistrictBoundaryRecord = { id: string; name?: string | null; short_name?: string | null; geometry?: GeoJSON.Geometry | null; [key: string]: unknown };

let stateCache: StateBoundaryData | null = null;
let statePromise: Promise<StateBoundaryData> | null = null;

let countyCache: CountyBoundaryRecord[] | null = null;
let countyPromise: Promise<CountyBoundaryRecord[]> | null = null;

let ctuCache: CTUBoundaryRecord[] | null = null;
let ctuPromise: Promise<CTUBoundaryRecord[]> | null = null;

let districtCache: DistrictBoundaryRecord[] | null = null;
let districtPromise: Promise<DistrictBoundaryRecord[]> | null = null;

const WATER_MAP_LIMIT = 2000;
let waterCache: WaterBoundaryRecord[] | null = null;
let waterPromise: Promise<WaterBoundaryRecord[]> | null = null;

const SCHOOL_DISTRICTS_LIMIT = 500;
let schoolDistrictsCache: SchoolDistrictBoundaryRecord[] | null = null;
let schoolDistrictsPromise: Promise<SchoolDistrictBoundaryRecord[]> | null = null;

function fetchState(): Promise<StateBoundaryData> {
  if (stateCache) return Promise.resolve(stateCache);
  if (statePromise) return statePromise;
  statePromise = fetch('/api/civic/state-boundary')
    .then((r) => {
      if (!r.ok) throw new Error('Failed to fetch state boundary');
      return r.json();
    })
    .then((data) => {
      stateCache = data;
      statePromise = null;
      return data;
    })
    .catch((err) => {
      statePromise = null;
      throw err;
    });
  return statePromise;
}

function fetchDistricts(): Promise<DistrictBoundaryRecord[]> {
  if (districtCache) return Promise.resolve(districtCache);
  if (districtPromise) return districtPromise;
  districtPromise = fetch('/api/civic/congressional-districts')
    .then((r) => {
      if (!r.ok) throw new Error('Failed to fetch congressional districts');
      return r.json();
    })
    .then((data) => {
      districtCache = data;
      districtPromise = null;
      return data;
    })
    .catch((err) => {
      districtPromise = null;
      throw err;
    });
  return districtPromise;
}

function fetchCounty(): Promise<CountyBoundaryRecord[]> {
  if (countyCache) return Promise.resolve(countyCache);
  if (countyPromise) return countyPromise;
  countyPromise = fetch('/api/civic/county-boundaries')
    .then((r) => {
      if (!r.ok) throw new Error('Failed to fetch county boundaries');
      return r.json();
    })
    .then((data) => {
      countyCache = data;
      countyPromise = null;
      return data;
    })
    .catch((err) => {
      countyPromise = null;
      throw err;
    });
  return countyPromise;
}

function fetchCTU(): Promise<CTUBoundaryRecord[]> {
  if (ctuCache) return Promise.resolve(ctuCache);
  if (ctuPromise) return ctuPromise;
  ctuPromise = fetch('/api/civic/ctu-boundaries')
    .then((r) => {
      if (!r.ok) throw new Error('Failed to fetch CTU boundaries');
      return r.json();
    })
    .then((data) => {
      ctuCache = data;
      ctuPromise = null;
      return data;
    })
    .catch((err) => {
      ctuPromise = null;
      throw err;
    });
  return ctuPromise;
}

function fetchWater(): Promise<WaterBoundaryRecord[]> {
  if (waterCache) return Promise.resolve(waterCache);
  if (waterPromise) return waterPromise;
  waterPromise = fetch(`/api/civic/water?limit=${WATER_MAP_LIMIT}`)
    .then((r) => {
      if (!r.ok) throw new Error('Failed to fetch water');
      return r.json();
    })
    .then((raw) => {
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: WaterBoundaryRecord[] })?.data)
          ? ((raw as { data: WaterBoundaryRecord[] }).data)
          : [];
      waterCache = data;
      waterPromise = null;
      return data;
    })
    .catch((err) => {
      waterPromise = null;
      throw err;
    });
  return waterPromise;
}

function fetchSchoolDistricts(): Promise<SchoolDistrictBoundaryRecord[]> {
  if (schoolDistrictsCache) return Promise.resolve(schoolDistrictsCache);
  if (schoolDistrictsPromise) return schoolDistrictsPromise;
  schoolDistrictsPromise = fetch(`/api/civic/school-districts?limit=${SCHOOL_DISTRICTS_LIMIT}`)
    .then((r) => {
      if (!r.ok) throw new Error('Failed to fetch school districts');
      return r.json();
    })
    .then((raw) => {
      const data = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { data?: SchoolDistrictBoundaryRecord[] })?.data)
          ? ((raw as { data: SchoolDistrictBoundaryRecord[] }).data)
          : [];
      schoolDistrictsCache = data;
      schoolDistrictsPromise = null;
      return data;
    })
    .catch((err) => {
      schoolDistrictsPromise = null;
      throw err;
    });
  return schoolDistrictsPromise;
}

/** True if data is already in memory (no fetch needed). */
export function hasStateCached(): boolean {
  return stateCache !== null;
}
export function hasCountyCached(): boolean {
  return countyCache !== null;
}
export function hasCTUCached(): boolean {
  return ctuCache !== null;
}
export function hasDistrictsCached(): boolean {
  return districtCache !== null;
}
export function hasWaterCached(): boolean {
  return waterCache !== null;
}
export function hasSchoolDistrictsCached(): boolean {
  return schoolDistrictsCache !== null;
}

/** Get state boundary; returns cached or fetches once. */
export function getStateBoundary(): Promise<StateBoundaryData> {
  return fetchState();
}

/** Get county boundaries; returns cached or fetches once. */
export function getCountyBoundaries(): Promise<CountyBoundaryRecord[]> {
  return fetchCounty();
}

/** Get CTU boundaries; returns cached or fetches once. */
export function getCTUBoundaries(): Promise<CTUBoundaryRecord[]> {
  return fetchCTU();
}

/** Get congressional districts; returns cached or fetches once. */
export function getCongressionalDistricts(): Promise<DistrictBoundaryRecord[]> {
  return fetchDistricts();
}

/** Get water bodies; returns cached or fetches once. */
export function getWater(): Promise<WaterBoundaryRecord[]> {
  return fetchWater();
}

/** Get school districts; returns cached or fetches once. */
export function getSchoolDistricts(): Promise<SchoolDistrictBoundaryRecord[]> {
  return fetchSchoolDistricts();
}

/**
 * Preload all boundary data in the background. Call when live map mounts
 * so zoom transitions never wait on network. One API call per type per session.
 */
export function preloadAll(): void {
  getStateBoundary().catch(() => {});
  getCountyBoundaries().catch(() => {});
  getCTUBoundaries().catch(() => {});
  getCongressionalDistricts().catch(() => {});
  getWater().catch(() => {});
  getSchoolDistricts().catch(() => {});
}

/** Rough centroid from GeoJSON Polygon/MultiPolygon (first ring, first point). */
function centroidFromGeometry(geometry: GeoJSON.Geometry | null | undefined): [number, number] | null {
  if (!geometry || geometry.type === 'Point') return null;
  const coords = (geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const ring = Array.isArray(coords[0]?.[0]) && typeof coords[0][0][0] === 'number' ? coords[0][0] : coords[0];
  const first = Array.isArray(ring?.[0]) && typeof ring[0] === 'number' ? ring : null;
  if (!first || first.length < 2) return null;
  return [Number(first[0]), Number(first[1])];
}

export type ResolvedBoundaryLocation = {
  lat: number;
  lng: number;
  address: null;
  mapMeta: {
    boundaryLayer: 'state' | 'county' | 'district' | 'ctu';
    boundaryName: string;
    boundaryEntityId: string;
    feature: { name: string };
    boundaryDetails: Record<string, unknown> | null;
  };
};

/**
 * Resolve boundary entity by layer + id for URL-driven footer (e.g. /live?layer=county&id=xxx).
 * Returns MapInfoLocation shape or null if not found / invalid.
 */
export async function resolveBoundaryByLayerId(
  layer: string,
  id: string
): Promise<ResolvedBoundaryLocation | null> {
  const layerNorm = layer as 'state' | 'county' | 'district' | 'ctu';
  if (!['state', 'county', 'district', 'ctu'].includes(layerNorm) || !id || typeof id !== 'string') return null;
  try {
    if (layerNorm === 'state') {
      const data = await getStateBoundary();
      const stateId = (data as { id?: string }).id ?? 'mn';
      if (stateId !== id && id !== 'mn') return null;
      const geom = data.geometry?.features?.[0]?.geometry ?? (data as unknown as { geometry?: GeoJSON.Geometry }).geometry;
      const cen = centroidFromGeometry(geom) ?? [-93.265, 44.9778];
      const name = (data as { name?: string }).name ?? 'Minnesota';
      const details = data && typeof data === 'object' ? ({ ...data, geometry: undefined } as Record<string, unknown>) : null;
      return {
        lat: cen[1],
        lng: cen[0],
        address: null,
        mapMeta: {
          boundaryLayer: 'state',
          boundaryName: name,
          boundaryEntityId: stateId,
          feature: { name },
          boundaryDetails: details,
        },
      };
    }
    if (layerNorm === 'county') {
      const list = await getCountyBoundaries();
      const record = list.find((c) => c.id === id);
      if (!record) return null;
      const geom = record.geometry?.features?.[0]?.geometry ?? (record as unknown as { geometry?: GeoJSON.Geometry }).geometry;
      const cen = centroidFromGeometry(geom) ?? [-93.265, 44.9778];
      const name = (record as { county_name?: string }).county_name ?? 'County';
      const details = record && typeof record === 'object' ? ({ ...record, geometry: undefined } as Record<string, unknown>) : null;
      return {
        lat: cen[1],
        lng: cen[0],
        address: null,
        mapMeta: {
          boundaryLayer: 'county',
          boundaryName: name,
          boundaryEntityId: id,
          feature: { name },
          boundaryDetails: details,
        },
      };
    }
    if (layerNorm === 'ctu') {
      const list = await getCTUBoundaries();
      const record = list.find((c) => c.id === id);
      if (!record) return null;
      const geom = record.geometry?.features?.[0]?.geometry ?? (record as unknown as { geometry?: GeoJSON.Geometry }).geometry;
      const cen = centroidFromGeometry(geom) ?? [-93.265, 44.9778];
      const name = (record as { feature_name?: string }).feature_name ?? 'CTU';
      const details = record && typeof record === 'object' ? ({ ...record, geometry: undefined } as Record<string, unknown>) : null;
      return {
        lat: cen[1],
        lng: cen[0],
        address: null,
        mapMeta: {
          boundaryLayer: 'ctu',
          boundaryName: name,
          boundaryEntityId: id,
          feature: { name },
          boundaryDetails: details,
        },
      };
    }
    if (layerNorm === 'district') {
      const list = await getCongressionalDistricts();
      const record = list.find(
        (d) =>
          (d as { id?: string }).id === id || String((d as { district_number?: number }).district_number) === id
      );
      if (!record) return null;
      const geom = record.geometry?.features?.[0]?.geometry ?? (record as unknown as { geometry?: GeoJSON.Geometry }).geometry;
      const cen = centroidFromGeometry(geom) ?? [-93.265, 44.9778];
      const num = (record as { district_number?: number }).district_number;
      const name =
        (record as { name?: string }).name ?? (num != null ? `Congressional District ${num}` : 'District');
      const details = record && typeof record === 'object' ? ({ ...record, geometry: undefined } as Record<string, unknown>) : null;
      const entityId = (record as { id?: string }).id ?? String(num ?? id);
      return {
        lat: cen[1],
        lng: cen[0],
        address: null,
        mapMeta: {
          boundaryLayer: 'district',
          boundaryName: name,
          boundaryEntityId: entityId,
          feature: { name },
          boundaryDetails: details,
        },
      };
    }
  } catch {
    return null;
  }
  return null;
}
