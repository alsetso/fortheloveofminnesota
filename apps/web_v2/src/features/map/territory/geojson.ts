import type { Feature, FeatureCollection, Geometry, MultiPolygon, Point, Polygon } from 'geojson';
import type { TerritoryLayerConfig } from '@/features/map/territory/territoryLayers';

type GeomInput = Geometry | FeatureCollection | Feature | null | undefined;

function pushPolygonCoords(
  out: Polygon['coordinates'][],
  geom: Polygon | MultiPolygon,
): void {
  if (geom.type === 'Polygon') out.push(geom.coordinates);
  else out.push(...geom.coordinates);
}

function fromGeometryCollection(
  geom: { type: 'GeometryCollection'; geometries: Geometry[] },
): Polygon | MultiPolygon | null {
  const parts: Polygon['coordinates'][] = [];
  for (const child of geom.geometries ?? []) {
    if (child.type === 'Polygon' || child.type === 'MultiPolygon') {
      pushPolygonCoords(parts, child);
    }
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return { type: 'Polygon', coordinates: parts[0]! };
  return { type: 'MultiPolygon', coordinates: parts };
}

/**
 * Coerce stored territory geometry (Polygon, MultiPolygon, Feature,
 * GeometryCollection, or multi-part FeatureCollection) into a single Polygon / MultiPolygon.
 */
export function normalizePolygonGeometry(geom: GeomInput): Polygon | MultiPolygon | null {
  if (!geom || typeof geom !== 'object') return null;

  if (geom.type === 'FeatureCollection' && Array.isArray(geom.features)) {
    const parts: Polygon['coordinates'][] = [];
    for (const feature of geom.features) {
      if (!feature?.geometry) continue;
      const normalized = normalizePolygonGeometry(feature.geometry);
      if (normalized) pushPolygonCoords(parts, normalized);
    }
    if (parts.length === 0) return null;
    if (parts.length === 1) return { type: 'Polygon', coordinates: parts[0]! };
    return { type: 'MultiPolygon', coordinates: parts };
  }

  if (geom.type === 'Feature' && geom.geometry) {
    return normalizePolygonGeometry(geom.geometry);
  }
  if (geom.type === 'GeometryCollection') {
    return fromGeometryCollection(geom as { type: 'GeometryCollection'; geometries: Geometry[] });
  }
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    return geom as Polygon | MultiPolygon;
  }
  return null;
}

export function rowsToFeatureCollection(
  config: TerritoryLayerConfig,
  rows: Record<string, unknown>[],
): FeatureCollection {
  const features: Feature[] = [];
  for (const row of rows) {
    const geometry = normalizePolygonGeometry(row.geometry as GeomInput);
    if (!geometry) continue;
    const id = String(row.id ?? '');
    if (!id) continue;
    const name = String(row[config.nameColumn] ?? '');
    const officeholderName =
      row.officeholder_name != null && String(row.officeholder_name).trim() !== ''
        ? String(row.officeholder_name).trim()
        : null;
    features.push({
      type: 'Feature',
      id,
      properties: {
        id,
        name,
        slug: row.slug != null ? String(row.slug) : null,
        kind: config.entityKind,
        ...(config.subtitleColumn && row[config.subtitleColumn] != null
          ? { [config.subtitleColumn]: row[config.subtitleColumn] }
          : {}),
        ...(row.ctu_class != null ? { ctu_class: String(row.ctu_class) } : {}),
        ...(officeholderName ? { officeholder_name: officeholderName } : {}),
      },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Dissolved district outlines from `territory.get_district_outlines()`. */
export function districtOutlinesToFeatureCollection(
  rows: Record<string, unknown>[],
): FeatureCollection {
  const features: Feature[] = [];
  for (const row of rows) {
    const geometry = normalizePolygonGeometry(row.geometry as GeomInput);
    if (!geometry) continue;
    const id = String(row.id ?? '');
    if (!id) continue;
    const districtNumber =
      typeof row.district_number === 'number'
        ? row.district_number
        : Number(row.district_number);
    features.push({
      type: 'Feature',
      id,
      properties: {
        id,
        name: String(row.name ?? `Congressional District ${districtNumber}`),
        slug: row.slug != null ? String(row.slug) : null,
        kind: 'district',
        district_number: Number.isFinite(districtNumber) ? districtNumber : null,
      },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Expand a district row's nested FeatureCollection into individually selectable
 * precinct / sub-features (unique ids for Mapbox feature-state).
 */
export function districtPartsToFeatureCollection(
  row: Record<string, unknown>,
): FeatureCollection {
  const districtId = String(row.id ?? '');
  const districtNumber =
    typeof row.district_number === 'number'
      ? row.district_number
      : Number(row.district_number);
  const districtName = String(row.name ?? '');
  const raw = row.geometry as FeatureCollection | null | undefined;
  if (!raw || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    return { type: 'FeatureCollection', features: [] };
  }

  const features: Feature[] = [];
  raw.features.forEach((feat, index) => {
    const geometry = normalizePolygonGeometry(feat.geometry ?? null);
    if (!geometry) return;

    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const precinctId =
      props.PrecinctID != null
        ? String(props.PrecinctID)
        : props.precinct_id != null
          ? String(props.precinct_id)
          : null;
    const id = precinctId ? `${districtId}:${precinctId}` : `${districtId}:part-${index}`;
    const precinctName =
      props.Precinct != null
        ? String(props.Precinct)
        : props.precinct != null
          ? String(props.precinct)
          : `Area ${index + 1}`;
    const countyName =
      props.County != null
        ? String(props.County)
        : props.county != null
          ? String(props.county)
          : null;

    features.push({
      type: 'Feature',
      id,
      properties: {
        id,
        name: precinctName,
        kind: 'district_part',
        district_id: districtId,
        district_number: Number.isFinite(districtNumber) ? districtNumber : null,
        district_name: districtName,
        county: countyName,
        precinct: precinctName,
        mn_leg_dist: props.MNLegDist != null ? String(props.MNLegDist) : null,
        mn_sen_dist: props.MNSenDist != null ? String(props.MNSenDist) : null,
        cty_com_dist: props.CtyComDist != null ? String(props.CtyComDist) : null,
      },
      geometry,
    });
  });

  return { type: 'FeatureCollection', features };
}

/** School map features — prefer building polygons; fall back to lat/lng points. */
export function schoolRowsToMapFeatureCollection(
  rows: Record<string, unknown>[],
): FeatureCollection {
  const features: Feature[] = [];
  for (const row of rows) {
    const id = String(row.id ?? '');
    if (!id) continue;

    const lat = typeof row.lat === 'number' ? row.lat : Number(row.lat);
    const lng = typeof row.lng === 'number' ? row.lng : Number(row.lng);
    const polygon = normalizePolygonGeometry(row.geometry as GeomInput);

    let geometry: Polygon | MultiPolygon | Point | null = polygon;
    if (!geometry) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      geometry = { type: 'Point', coordinates: [lng, lat] };
    }

    features.push({
      type: 'Feature',
      id,
      properties: {
        id,
        name: String(row.name ?? ''),
        slug: row.slug != null ? String(row.slug) : null,
        kind: 'school',
        school_type: row.school_type != null ? String(row.school_type) : null,
        school_district_id:
          row.school_district_id != null ? String(row.school_district_id) : null,
        ...(Number.isFinite(lat) ? { lat } : {}),
        ...(Number.isFinite(lng) ? { lng } : {}),
      },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features };
}

/** @deprecated Prefer schoolRowsToMapFeatureCollection */
export const schoolRowsToPointFeatureCollection = schoolRowsToMapFeatureCollection;

