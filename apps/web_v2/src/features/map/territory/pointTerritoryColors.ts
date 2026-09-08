import type { SelectionKind } from '@/features/map/territory/territorySelection';

/**
 * Distinct fills for point-jurisdiction overlays (toggle switch + map paint).
 * Indexed by list order so every row at a point gets a unique color.
 */
export const POINT_TERRITORY_PALETTE = [
  '#2a6f97', // lake blue — cities
  '#2f6f5e', // county green
  '#c45c26', // terracotta — school districts
  '#6b3fa0', // purple — congressional
  '#b83d5a', // rose — house
  '#1a7a6d', // teal — senate
  '#8b5a2b', // brown
  '#3d7ea6', // sky
  '#5a7d4a', // moss
  '#a65d3a', // rust
] as const;

/** Stable fallback when kind is known but index is unavailable. */
const COLOR_BY_KIND: Partial<Record<SelectionKind, string>> = {
  ctu: POINT_TERRITORY_PALETTE[0],
  county: POINT_TERRITORY_PALETTE[1],
  school_district: POINT_TERRITORY_PALETTE[2],
  district: POINT_TERRITORY_PALETTE[3],
  house_district: POINT_TERRITORY_PALETTE[4],
  senate_district: POINT_TERRITORY_PALETTE[5],
  school: POINT_TERRITORY_PALETTE[7],
  district_part: POINT_TERRITORY_PALETTE[8],
};

export function pointTerritoryColorAt(index: number): string {
  return POINT_TERRITORY_PALETTE[index % POINT_TERRITORY_PALETTE.length]!;
}

export function pointTerritoryColorForKind(kind: SelectionKind): string {
  return COLOR_BY_KIND[kind] ?? POINT_TERRITORY_PALETTE[0]!;
}
