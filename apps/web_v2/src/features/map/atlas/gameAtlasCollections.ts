/**
 * Atlas overlays on the game map (Controls → Atlas in view).
 * Keep Discover's collection_map_geojson preview separate — this list drives
 * viewport bbox streaming only.
 */

export type GameAtlasCollection = {
  slug: string;
  label: string;
  hint: string;
  /** Default on when the Controls panel first loads. */
  defaultOn: boolean;
  color: string;
};

/** Lake-blue family — readable on Mapbox Standard without Discover beige. */
export const GAME_ATLAS_COLOR = '#2A6F8F';
export const GAME_ATLAS_COLOR_FEATURED = '#1a4a62';
export const GAME_ATLAS_STROKE = '#ffffff';

export const GAME_ATLAS_COLLECTIONS: readonly GameAtlasCollection[] = [
  {
    slug: 'metro_parks',
    label: 'Parks',
    hint: 'Metro park polygons in view',
    defaultOn: true,
    color: GAME_ATLAS_COLOR,
  },
  {
    slug: 'mn_schools',
    label: 'Schools',
    hint: 'School building / campus polygons',
    defaultOn: true,
    color: '#7A5C45',
  },
  {
    slug: 'mndot_bridges',
    label: 'Bridges',
    hint: 'MnDOT bridge points statewide',
    defaultOn: false,
    color: '#5C6670',
  },
  {
    slug: 'metro_lakes_rivers',
    label: 'Metro lakes',
    hint: 'Twin Cities lakes & rivers',
    defaultOn: false,
    color: '#2E7D9A',
  },
  {
    slug: 'mn_fish_ibi_lakes',
    label: 'IBI lakes',
    hint: 'Fish Index of Biotic Integrity lake polygons',
    defaultOn: false,
    color: '#1B7A9A',
  },
  {
    slug: 'mn_fin_ponds',
    label: 'FIN ponds',
    hint: 'Fishing in the Neighborhood ponds',
    defaultOn: false,
    color: '#2D7A6A',
  },
  {
    slug: 'mn_public_fishing_sites',
    label: 'Public fishing',
    hint: 'Piers & shore-fishing sites',
    defaultOn: false,
    color: '#4A6B3A',
  },
  {
    slug: 'mn_water_access_sites',
    label: 'Water access',
    hint: 'Boat launches & public access points',
    defaultOn: true,
    color: GAME_ATLAS_COLOR,
  },
  {
    slug: 'metro_transit_routes',
    label: 'Transit',
    hint: 'Metro Transit bus, BRT & rail corridors',
    defaultOn: false,
    color: '#B35A1F',
  },
  {
    slug: 'mn_snowmobile_trails',
    label: 'Snowmobile',
    hint: 'Statewide snowmobile trail corridors',
    defaultOn: false,
    color: '#4A6B82',
  },
  {
    slug: 'mn_feedlots',
    label: 'Feedlots',
    hint: 'Statewide animal feedlot inventory points',
    defaultOn: false,
    color: '#6B5A3E',
  },
  {
    slug: 'metro_park_and_rides',
    label: 'Park & rides',
    hint: 'Metro park-and-ride lots & transit centers',
    defaultOn: false,
    color: '#2F5F8A',
  },
  {
    slug: 'hennepin_county_facilities',
    label: 'Hennepin facilities',
    hint: 'Hennepin County offices, libraries & sites',
    defaultOn: false,
    color: '#4A5560',
  },
  {
    slug: 'mn_campsites',
    label: 'Campsites',
    hint: 'DNR parks & trails camping units',
    defaultOn: false,
    color: '#3D6B4F',
  },
  {
    slug: 'mn_parking',
    label: 'Parking lots',
    hint: 'DNR structure parking lot polygons',
    defaultOn: false,
    color: '#5A6B7A',
  },
  {
    slug: 'mn_wma_facilities',
    label: 'WMA facilities',
    hint: 'Wildlife Management Area public facilities',
    defaultOn: false,
    color: '#5C6B3A',
  },
] as const;

export const GAME_ATLAS_DEFAULT_SLUGS: string[] = GAME_ATLAS_COLLECTIONS.filter(
  (c) => c.defaultOn,
).map((c) => c.slug);

/** Mapbox layer ids used for paint + hit-testing. */
export const GAME_ATLAS_POLYGON_LAYER_IDS = [
  'app-atlas-fill',
  'app-atlas-outline',
  'app-atlas-line',
] as const;

export const GAME_ATLAS_POINT_LAYER_IDS = [
  'app-atlas-points',
  'app-atlas-featured',
] as const;

export function gameAtlasCollectionLabel(slug: string | null | undefined): string {
  if (!slug) return 'Atlas';
  const hit = GAME_ATLAS_COLLECTIONS.find((c) => c.slug === slug);
  return hit?.label ?? slug;
}
