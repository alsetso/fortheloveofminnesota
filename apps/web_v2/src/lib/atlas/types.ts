/**
 * Atlas Discover types — mirrors locked atlas.collections / atlas.features model.
 * Territory links: primary_unit_id (CTU cache) + atlas.feature_units membership.
 */

export type AtlasFilterKind =
  | 'park'
  | 'bridge'
  | 'lake'
  | 'trail'
  | 'landmark'
  | 'other';

export type AtlasCollectionVisibility = 'statewide' | 'metro' | 'territory_scoped';

export type AtlasGeomType = 'point' | 'line' | 'polygon';

export type AtlasCollectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  filterKind: AtlasFilterKind;
  geomModes: AtlasGeomType[];
  visibility: AtlasCollectionVisibility;
  sortOrder: number;
  sourceLabel: string | null;
  featureCount: number;
};

export type AtlasFeatureListRow = {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  blurb: string | null;
  geomType: AtlasGeomType;
  lat: number | null;
  lng: number | null;
  tags: string[];
  featured: boolean;
};

/** Local-stack membership kinds mirrored from territory.units.kind. */
export type AtlasFeatureUnitKind = 'ctu' | 'county' | 'school_district';

export type AtlasFeatureUnit = {
  featureId: string;
  unitKind: AtlasFeatureUnitKind;
  unitId: string;
};

export function atlasFeatureLabel(row: {
  name: string;
  displayName?: string | null;
}): string {
  const override = row.displayName?.trim();
  return override || row.name;
}

export function atlasVisibilityLabel(visibility: AtlasCollectionVisibility): string {
  switch (visibility) {
    case 'statewide':
      return 'Statewide';
    case 'metro':
      return 'Twin Cities';
    case 'territory_scoped':
      return 'Local';
    default:
      return 'Atlas';
  }
}
