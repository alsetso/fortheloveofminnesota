/**
 * Snapshot of user-toggled boundary paint (Controls / Layers rail).
 * Point-jurisdiction overlays from a drop are NOT included — those are
 * consequences of compose, not explore ownership.
 *
 * Cities/towns prefs without a focused county do not paint and must not
 * own `explore` (empty-explore trap).
 */
import type { TerritorySlug } from '@/features/map/territory/territoryLayers';

export type BoundaryPaintSnapshot = {
  activeSlugs: ReadonlySet<TerritorySlug>;
  /** Focused county for nested CTU / county-SD overlays. */
  countyId: string | null;
  citiesOn: boolean;
  townsOn: boolean;
  countySchoolDistrictsOn: boolean;
  schoolsOn: boolean;
  districtPartsOn: boolean;
};

/** True when any Controls boundary layer is actually painted (or paintable). */
export function hasActiveBoundaryPaint(s: BoundaryPaintSnapshot): boolean {
  if (s.activeSlugs.size > 0) return true;
  if (s.schoolsOn || s.districtPartsOn) return true;
  if (s.countyId == null) return false;
  return s.citiesOn || s.townsOn || s.countySchoolDistrictsOn;
}
