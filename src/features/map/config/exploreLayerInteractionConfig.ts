/**
 * Unified layer interaction config for Explore map.
 * Maps layerSlug → fill layer IDs and property extractors.
 * Hover: id + name from feature properties only (no API).
 * Click: id + name + lat/lng from feature.
 */

export type ExploreLayerType = 'state' | 'county' | 'ctu' | 'district';

export interface ExploreLayerInteractionConfig {
  layer: ExploreLayerType;
  /** Fill layer ID(s) to query—Congressional uses multiple */
  fillLayerIds: string[];
  /** Extract id from feature (props + optional layer.id for congressional) */
  getId: (props: Record<string, unknown>, layerId?: string) => string;
  /** Extract display name from feature */
  getName: (props: Record<string, unknown>, layerId?: string) => string;
}

const CONFIG: Record<string, ExploreLayerInteractionConfig> = {
  state: {
    layer: 'state',
    fillLayerIds: ['state-boundary-fill'],
    getId: () => 'mn',
    getName: () => 'Minnesota',
  },
  counties: {
    layer: 'county',
    fillLayerIds: ['county-boundaries-fill'],
    getId: (p) => String(p.county_id ?? ''),
    getName: (p) => String(p.county_name ?? 'County'),
  },
  'cities-and-towns': {
    layer: 'ctu',
    fillLayerIds: ['ctu-boundaries-fill'],
    getId: (p) => String(p.ctu_id ?? ''),
    getName: (p) => String(p.feature_name ?? 'CTU'),
  },
  'congressional-districts': {
    layer: 'district',
    fillLayerIds: Array.from({ length: 8 }, (_, i) => `congressional-district-${i + 1}-fill`),
    getId: (p, layerId?: string) => {
      const match = layerId?.match(/^congressional-district-(\d+)-fill$/);
      return match ? match[1] : String(p.district_number ?? '');
    },
    getName: (p, layerId?: string) => {
      const match = layerId?.match(/^congressional-district-(\d+)-fill$/);
      const num = match ? parseInt(match[1], 10) : (p.district_number as number);
      return num ? `District ${num}` : 'District';
    },
  },
};

export function getExploreLayerInteractionConfig(layerSlug: string): ExploreLayerInteractionConfig | null {
  return CONFIG[layerSlug] ?? null;
}

/**
 * Zoom threshold for county → CTU overlay switch.
 * County polygon visible when zoom < cutoff; CTU polygons when zoom >= cutoff.
 */
export const EXPLORE_ZOOM_CTU_CUTOFF = 10;

/** Parent→child hierarchy for Explore. Used to derive sub-records sidebar and map overlay. */
export const EXPLORE_HIERARCHY: Record<
  string,
  { child: string | null; filterBy: string | null }
> = {
  state: { child: 'counties', filterBy: null },
  counties: { child: 'cities-and-towns', filterBy: 'county_name' },
  'cities-and-towns': { child: null, filterBy: null },
  'congressional-districts': { child: null, filterBy: null },
};

export function getExploreChildContext(
  table: string,
  selectedDetails: Record<string, unknown> | undefined
): { hasSubRecords: boolean; childTable: string | null; parentFilterValue: string | null } {
  const h = EXPLORE_HIERARCHY[table];
  if (!h || !h.child) return { hasSubRecords: false, childTable: null, parentFilterValue: null };
  const filterValue = h.filterBy && selectedDetails
    ? String(selectedDetails[h.filterBy] ?? '')
    : null;
  const hasSubRecords = !h.filterBy || Boolean(filterValue);
  return {
    hasSubRecords,
    childTable: h.child,
    parentFilterValue: filterValue || null,
  };
}

/** Resolve config for a feature by its layer id (e.g. ctu-boundaries-fill → cities-and-towns) */
export function getConfigForLayerId(layerId: string | undefined): ExploreLayerInteractionConfig | null {
  if (!layerId) return null;
  if (layerId === 'state-boundary-fill') return CONFIG.state;
  if (layerId === 'county-boundaries-fill') return CONFIG.counties;
  if (layerId === 'ctu-boundaries-fill') return CONFIG['cities-and-towns'];
  const m = layerId.match(/^congressional-district-(\d+)-fill$/);
  return m ? CONFIG['congressional-districts'] : null;
}

export function extractPointFromGeometry(geom: GeoJSON.Geometry | null | undefined): [number, number] | null {
  if (!geom || geom.type === 'Point') return null;
  const coords = (geom as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return null;
  const ring = Array.isArray(coords[0]?.[0]) && typeof coords[0][0][0] === 'number' ? coords[0][0] : coords[0];
  const pt = ring?.[0];
  if (!Array.isArray(pt) || pt.length < 2) return null;
  return [pt[0], pt[1]];
}
