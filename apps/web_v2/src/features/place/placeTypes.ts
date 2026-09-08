import type { Geometry } from 'geojson';
import { passportKindBarLabel } from '@/features/accountTerritories/store/passportKinds';
import { territoryKindLabel } from '@/features/xp/logic/xpSources';

/**
 * Map `territory.units.kind` (+ subtype) → dock / presence kind used in
 * account_territory_presence and map selection.
 */
export function unitKindToDockKind(
  unitKind: string,
  subtype?: string | null,
): string {
  if (unitKind === 'congressional') return 'district';
  if (unitKind === 'legislative') {
    if (subtype === 'house') return 'house_district';
    return 'senate_district';
  }
  return unitKind;
}

export function placeKindLabel(
  dockKind: string,
  unitKind: string,
): string {
  return passportKindBarLabel(dockKind) || territoryKindLabel(unitKind);
}

export type PlaceRecord = {
  id: string;
  name: string;
  slug: string | null;
  /** `territory.units.kind` */
  unitKind: string;
  subtype: string | null;
  /** Dock / presence kind (ctu, district, senate_district, …). */
  dockKind: string;
  kindLabel: string;
  geometry: Geometry | null;
  viewer: {
    visited: boolean;
    firstSeenAt: string | null;
    xpAmount: number | null;
  };
};
