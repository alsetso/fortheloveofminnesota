/**
 * Application geographic feature model.
 *
 * This is the canonical pipeline:
 *   RAW MAPBOX DATA (MapboxGeoJSONFeature[])
 *        ↓
 *   normalizeMapboxFeatures()
 *        ↓
 *   AppGeoFeature[]     ← stored in mapGeoFeaturesStore
 *        ↓
 *   OUR MODEL / INTERACTION SYSTEM
 *
 * Key principle: NO Mapbox properties are discarded.  Every raw property is
 * preserved in `properties`.  The normalized fields (`name`, `category`,
 * `featureClass`) are derived convenience fields — they never replace the
 * source of truth.
 *
 * This module intentionally has no UI imports — it is pure data logic that
 * can be used from any layer: map interaction, server-side enrichment, etc.
 */

import type { MapboxGeoJSONFeature } from 'mapbox-gl';

// ─── Category ─────────────────────────────────────────────────────────────────

export type GeoFeatureCategory =
  | 'water'
  | 'waterway'
  | 'road'
  | 'tunnel'
  | 'bridge'
  | 'building'
  | 'landuse'
  | 'landcover'
  | 'poi'
  | 'transit'
  | 'place'
  | 'natural'
  | 'boundary'
  | 'aeroway'
  /** ftlomn-* application layers */
  | 'own'
  | 'unknown';

// ─── AppGeoFeature ────────────────────────────────────────────────────────────

/**
 * Normalized geographic feature produced from a single MapboxGeoJSONFeature.
 * Designed as the foundation for the FTLOM geographic model catalog.
 */
export type AppGeoFeature = {
  /** Stable dedup key: `${source}/${sourceLayer ?? 'none'}/${mapboxId ?? idx}` */
  uid: string;
  /** Mapbox feature id (numeric or string; null for anonymous features) */
  mapboxId: string | number | null;
  /** Mapbox source id — e.g. 'composite', 'mapbox', 'ftlomn-territory' */
  source: string;
  /** Mapbox source-layer — e.g. 'road', 'water', 'poi_label' */
  sourceLayer: string | null;
  /** Mapbox GL layer id — e.g. 'road-primary-case', 'water-polygon' */
  layerId: string | null;
  /** GeoJSON geometry type */
  geometryType: string;
  /** Normalized feature category */
  category: GeoFeatureCategory;
  /** Best display name extracted from properties; null when anonymous */
  name: string | null;
  /** Mapbox feature class (road class, water class, landuse type, etc.) */
  featureClass: string | null;
  /** ALL raw Mapbox properties — never discarded */
  properties: Record<string, unknown>;
};

// ─── Source-layer sets (mirrors parseMapSurfaceFeatures for consistency) ──────

const WATER_SOURCE_LAYERS = new Set([
  'water', 'water_polygon', 'water_shadow',
]);
const WATERWAY_SOURCE_LAYERS = new Set([
  'waterway', 'waterway_polygon',
]);
// All source-layers present in Mapbox Streets v8 / Outdoors v12 / Satellite Streets v12.
// Reference: https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/

const ROAD_SOURCE_LAYERS = new Set([
  // Vector tile road data (geometry)
  'road', 'roads', 'transportation',
  // Road label / shield overlays (Streets v8: separate source-layer from road geometry)
  'road_label',
  // Motorway junction number labels
  'motorway_junction',
  // Older / alternative naming
  'bridge', 'tunnel',
]);
const STRUCTURE_SOURCE_LAYERS = new Set([
  // Streets v8 `structure` — bridge deck and tunnel cover POLYGONS.
  // Has `type` property: 'bridge' | 'tunnel' | 'ford' | 'causeway'.
  // Geometry: Polygon. Often hit when clicking near a bridge or overpass.
  'structure',
]);
const LANDUSE_SOURCE_LAYERS = new Set([
  'landuse', 'landuse_overlay', 'national_park', 'area',
]);
const LANDCOVER_SOURCE_LAYERS = new Set([
  'landcover', 'land',
]);
const BUILDING_SOURCE_LAYERS = new Set([
  'building', 'building_extrusion', 'buildings',
]);
const POI_SOURCE_LAYERS = new Set([
  'poi_label', 'poi', 'place_of_interest',
  // House number labels (Points on building footprints at high zoom)
  'housenum_label',
]);
const TRANSIT_SOURCE_LAYERS = new Set([
  'transit_stop_label', 'transit_stop', 'transit',
]);
const PLACE_SOURCE_LAYERS = new Set([
  'place_label', 'place',
  // Older style variants
  'country_label', 'state_label', 'settlement_label', 'settlement_subdivision_label',
]);
const NATURAL_SOURCE_LAYERS = new Set([
  'natural_label', 'natural',
]);
const BOUNDARY_SOURCE_LAYERS = new Set([
  'admin', 'admin_label', 'boundary',
]);
const AEROWAY_SOURCE_LAYERS = new Set([
  'aeroway',
]);
// Elevation contours (Outdoors v12)
const CONTOUR_SOURCE_LAYERS = new Set([
  'contour', 'contour_label',
]);

const OWN_SOURCE_PREFIX = 'ftlomn-';

// ─── Categorize ───────────────────────────────────────────────────────────────

function categorize(
  source: string,
  sourceLayer: string | null,
  layerId: string | null,
  props: Record<string, unknown>,
): GeoFeatureCategory {
  if (source.startsWith(OWN_SOURCE_PREFIX)) return 'own';

  const sl = sourceLayer ?? '';
  const lid = (layerId ?? '').toLowerCase();

  if (WATER_SOURCE_LAYERS.has(sl)) return 'water';
  if (WATERWAY_SOURCE_LAYERS.has(sl)) return 'waterway';

  // `structure` — bridge/tunnel structural polygons from Streets v8.
  // Categorize by type property; default to bridge.
  if (STRUCTURE_SOURCE_LAYERS.has(sl)) {
    const t = String(props['type'] ?? '').toLowerCase();
    if (t === 'tunnel') return 'tunnel';
    return 'bridge';
  }

  if (ROAD_SOURCE_LAYERS.has(sl)) {
    if (sl === 'tunnel' || lid.includes('tunnel')) return 'tunnel';
    if (sl === 'bridge' || lid.includes('bridge')) return 'bridge';
    return 'road';
  }

  if (BUILDING_SOURCE_LAYERS.has(sl)) return 'building';
  if (LANDUSE_SOURCE_LAYERS.has(sl)) return 'landuse';
  if (LANDCOVER_SOURCE_LAYERS.has(sl)) return 'landcover';
  if (POI_SOURCE_LAYERS.has(sl)) return 'poi';
  if (TRANSIT_SOURCE_LAYERS.has(sl)) return 'transit';
  if (PLACE_SOURCE_LAYERS.has(sl)) return 'place';
  if (NATURAL_SOURCE_LAYERS.has(sl)) return 'natural';
  if (CONTOUR_SOURCE_LAYERS.has(sl)) return 'natural';
  if (BOUNDARY_SOURCE_LAYERS.has(sl) || lid.includes('boundary') || lid.includes('admin')) return 'boundary';
  if (AEROWAY_SOURCE_LAYERS.has(sl) || lid.includes('aeroway')) return 'aeroway';

  // Layer-ID heuristic fallback — catches style-specific layer naming
  if (lid.includes('water') || lid.includes('lake') || lid.includes('ocean')) return 'water';
  if (lid.includes('road') || lid.includes('street') || lid.includes('highway')) return 'road';
  if (lid.includes('building') || lid.includes('structure')) return 'building';
  if (lid.includes('park') || lid.includes('landuse') || lid.includes('grass')) return 'landuse';
  if (lid.includes('poi') || lid.includes('label')) return 'poi';
  if (lid.includes('transit') || lid.includes('rail') || lid.includes('bus')) return 'transit';
  if (lid.includes('boundary') || lid.includes('admin')) return 'boundary';
  if (lid.includes('aeroway') || lid.includes('airport')) return 'aeroway';

  return 'unknown';
}

// ─── Name extraction ──────────────────────────────────────────────────────────

function extractName(props: Record<string, unknown>): string | null {
  const candidates = [
    props['name'],
    props['name:en'],
    props['name_en'],
    props['ref'],
    props['house_num'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

// ─── Feature class extraction ─────────────────────────────────────────────────

function extractFeatureClass(props: Record<string, unknown>): string | null {
  const candidates = [
    props['class'],
    props['type'],
    props['highway'],
    props['subtype'],
    props['category'],
    props['mode'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

// ─── UID ──────────────────────────────────────────────────────────────────────

function makeUid(
  source: string,
  sourceLayer: string | null,
  mapboxId: string | number | null,
  index: number,
): string {
  const sl = sourceLayer ?? 'none';
  const id = mapboxId != null ? String(mapboxId) : `idx:${index}`;
  return `${source}/${sl}/${id}`;
}

// ─── Main normalizer ──────────────────────────────────────────────────────────

/**
 * Normalize raw `map.queryRenderedFeatures()` output into `AppGeoFeature[]`.
 *
 * All features are preserved (including duplicates by UID if the same tile
 * feature appears in multiple rendered layers — callers can dedup by `uid`).
 * No properties are discarded.
 */
export function normalizeMapboxFeatures(
  features: MapboxGeoJSONFeature[],
): AppGeoFeature[] {
  return features.map((f, i) => {
    const source = typeof f.source === 'string' ? f.source : 'unknown';
    const sourceLayer = f.sourceLayer ?? null;
    const layerId = (f.layer?.id ?? null) as string | null;
    const mapboxId = (f.id != null ? f.id : null) as string | number | null;

    const props: Record<string, unknown> = f.properties ? { ...f.properties } : {};

    return {
      uid: makeUid(source, sourceLayer, mapboxId, i),
      mapboxId,
      source,
      sourceLayer,
      layerId,
      geometryType: f.geometry?.type ?? 'Unknown',
      category: categorize(source, sourceLayer, layerId, props),
      name: extractName(props),
      featureClass: extractFeatureClass(props),
      properties: props,
    };
  });
}

// ─── Dedup helper ─────────────────────────────────────────────────────────────

/**
 * Deduplicate by UID, keeping the first occurrence.
 * Useful when the same tile feature appears in multiple Mapbox GL layers.
 */
export function deduplicateGeoFeatures(features: AppGeoFeature[]): AppGeoFeature[] {
  const seen = new Set<string>();
  return features.filter((f) => {
    if (seen.has(f.uid)) return false;
    seen.add(f.uid);
    return true;
  });
}

// ─── Category labels ──────────────────────────────────────────────────────────

export const GEO_CATEGORY_LABEL: Record<GeoFeatureCategory, string> = {
  water:    'Water',
  waterway: 'Waterway',
  road:     'Road',
  tunnel:   'Tunnel',
  bridge:   'Bridge',
  building: 'Building',
  landuse:  'Land use',
  landcover:'Land cover',
  poi:      'POI',
  transit:  'Transit',
  place:    'Place',
  natural:  'Natural',
  boundary: 'Boundary',
  aeroway:  'Aeroway',
  own:      'App layer',
  unknown:  'Unknown',
};
