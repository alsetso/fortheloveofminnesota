import { MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';

export type TerritorySlug =
  | 'counties'
  | 'cities-and-towns'
  | 'school-districts'
  | 'districts'
  | 'senate-districts'
  | 'house-districts';

export type TerritoryLayerConfig = {
  slug: TerritorySlug;
  table: string;
  label: string;
  subtitle: string;
  /** Column used for list labels + A–Z order */
  nameColumn: string;
  /** Columns for records API (no geometry) */
  selectColumns: string;
  /** Boundary select with geometry_simplified aliased as geometry */
  boundarySelect: string;
  sourceId: Exclude<
    (typeof MAP_SOURCE_IDS)[keyof typeof MAP_SOURCE_IDS],
    typeof MAP_SOURCE_IDS.selection
  >;
  entityKind: DockEntity['kind'];
  /** Optional secondary property for list subtitle */
  subtitleColumn?: string;
};

/**
 * SSOT for ios-2 territory layers — drives Controls toggles, records list, and map sources.
 */
export const TERRITORY_LAYERS: TerritoryLayerConfig[] = [
  {
    slug: 'counties',
    table: 'counties',
    label: 'Counties',
    subtitle: '87 Minnesota counties',
    nameColumn: 'county_name',
    selectColumns: 'id, county_name, slug',
    boundarySelect:
      'id, county_name, slug, geometry:geometry_simplified',
    sourceId: MAP_SOURCE_IDS.counties,
    entityKind: 'county',
  },
  {
    slug: 'cities-and-towns',
    table: 'cities_and_towns',
    label: 'Cities & towns',
    subtitle: 'CTU boundaries',
    nameColumn: 'feature_name',
    selectColumns: 'id, feature_name, county_name, ctu_class, slug',
    boundarySelect:
      'id, feature_name, county_name, ctu_class, slug, geometry:geometry_simplified',
    sourceId: MAP_SOURCE_IDS.ctus,
    entityKind: 'ctu',
    subtitleColumn: 'county_name',
  },
  {
    slug: 'school-districts',
    table: 'school_districts',
    label: 'Schools',
    subtitle: 'School district boundaries',
    nameColumn: 'name',
    selectColumns: 'id, name, sd_number, slug',
    boundarySelect: 'id, name, sd_number, slug, geometry:geometry_simplified',
    sourceId: MAP_SOURCE_IDS.schoolDistricts,
    entityKind: 'school_district',
    subtitleColumn: 'sd_number',
  },
  {
    slug: 'districts',
    table: 'districts',
    label: 'Congressional Districts',
    subtitle: '8 congressional districts · precincts on select',
    nameColumn: 'name',
    selectColumns: 'id, name, district_number, slug',
    // Precomputed dissolved outline (precinct FC stays in geometry; parts load on select).
    boundarySelect: 'id, name, district_number, slug, geometry:geometry_simplified',
    sourceId: MAP_SOURCE_IDS.districts,
    entityKind: 'district',
    subtitleColumn: 'district_number',
  },
  {
    slug: 'senate-districts',
    table: 'senate_districts',
    label: 'Senate Districts',
    subtitle: '67 state senate districts (2022)',
    nameColumn: 'name',
    selectColumns: 'id, name, district_number, district_code, slug',
    boundarySelect:
      'id, name, district_number, district_code, slug, geometry:geometry_simplified',
    sourceId: MAP_SOURCE_IDS.senateDistricts,
    entityKind: 'senate_district',
    subtitleColumn: 'district_code',
  },
  {
    slug: 'house-districts',
    table: 'house_districts',
    label: 'House Districts',
    subtitle: '134 house districts (2022)',
    nameColumn: 'name',
    selectColumns: 'id, name, district_number, district_code, seat, slug',
    boundarySelect:
      'id, name, district_number, district_code, seat, slug, geometry:geometry_simplified',
    sourceId: MAP_SOURCE_IDS.houseDistricts,
    entityKind: 'house_district',
    subtitleColumn: 'district_code',
  },
];

export function getTerritoryLayer(slug: string): TerritoryLayerConfig | undefined {
  return TERRITORY_LAYERS.find((l) => l.slug === slug);
}

/**
 * Primary boundary datasets painted in the explore list and browse controls.
 * Legislative layers (districts / senate-districts / house-districts) are
 * intentionally excluded for first launch — data and paint code remain intact.
 */
export const EXPLORE_LAYER_SLUGS: TerritorySlug[] = [
  'counties',
  'cities-and-towns',
  'school-districts',
];

/** Dock entity kind → Explore list page slug (null if the list page doesn't exist). */
export function exploreLayerForEntityKind(unitKind: string): TerritorySlug | null {
  return TERRITORY_LAYERS.find((l) => l.entityKind === unitKind)?.slug ?? null;
}

const CTU_CLASS_LABEL: Record<string, string> = {
  CITY: 'City',
  TOWNSHIP: 'Township',
  TOWN: 'Town',
  'UNORGANIZED TERRITORY': 'Unorganized territory',
};

/** Human-readable label for territory `cities_and_towns.ctu_class`. */
export function formatCtuClassLabel(ctuClass: string | null | undefined): string | null {
  if (!ctuClass) return null;
  const key = ctuClass.trim().toUpperCase();
  return CTU_CLASS_LABEL[key] ?? ctuClass.trim();
}

function normalizeCtuClass(ctuClass: string | null | undefined): string {
  return (ctuClass ?? '').trim().toUpperCase();
}

/** Incorporated cities (`ctu_class = CITY`). */
export function isCtuCityClass(ctuClass: string | null | undefined): boolean {
  return normalizeCtuClass(ctuClass) === 'CITY';
}

/** Townships / towns / unorganized territories (non-city CTUs). */
export function isCtuTownClass(ctuClass: string | null | undefined): boolean {
  const key = normalizeCtuClass(ctuClass);
  return key === 'TOWNSHIP' || key === 'TOWN' || key === 'UNORGANIZED TERRITORY';
}

export function rowLabel(config: TerritoryLayerConfig, row: Record<string, unknown>): string {
  return String(row[config.nameColumn] ?? row.id ?? '');
}

export function rowSubtitle(
  config: TerritoryLayerConfig,
  row: Record<string, unknown>,
): string | undefined {
  if (!config.subtitleColumn) return undefined;
  const v = row[config.subtitleColumn];
  if (v == null || v === '') return undefined;
  if (config.subtitleColumn === 'sd_number') return `ISD ${v}`;
  if (config.subtitleColumn === 'district_number') return `CD ${v}`;
  if (config.subtitleColumn === 'district_code') {
    if (config.entityKind === 'senate_district') return `SD ${v}`;
    if (config.entityKind === 'house_district') return `HD ${v}`;
  }
  return String(v);
}

/** Details eyebrow for a territory row (City / Township instead of “ctu”). */
export function rowKindLabel(
  config: TerritoryLayerConfig,
  row: Record<string, unknown>,
): string | undefined {
  if (config.entityKind === 'ctu') {
    return formatCtuClassLabel(
      typeof row.ctu_class === 'string' ? row.ctu_class : null,
    ) ?? 'City / town';
  }
  if (config.entityKind === 'county') return 'County';
  if (config.entityKind === 'school_district') return 'School district';
  if (config.entityKind === 'district') return 'Congressional district';
  if (config.entityKind === 'senate_district') return 'Senate district';
  if (config.entityKind === 'house_district') return 'House district';
  return undefined;
}
