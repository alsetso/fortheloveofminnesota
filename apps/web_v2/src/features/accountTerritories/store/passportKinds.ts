/**
 * Passport progress kinds — dock `unit_kind` values (match
 * `account_territory_presence` + map territory layers).
 *
 * Cities & towns (ctu) stay the featured / primary score kind;
 * the rest appear as the Discover territory table.
 */

import type { TerritorySlug } from '@/features/map/territory/territoryLayers';

export type PassportTerritoryKindDef = {
  unitKind: string;
  label: string;
  total: number;
  /** URL segment under `/discover/:kind`. */
  slug: TerritorySlug;
  /** Featured card above the table (Cities & towns). */
  featured?: boolean;
};

export const PASSPORT_TERRITORY_KINDS: readonly PassportTerritoryKindDef[] = [
  {
    unitKind: 'ctu',
    label: 'Cities & towns',
    total: 2693,
    slug: 'cities-and-towns',
    featured: true,
  },
  {
    unitKind: 'county',
    label: 'Counties',
    total: 87,
    slug: 'counties',
  },
  {
    unitKind: 'school_district',
    label: 'School districts',
    total: 328,
    slug: 'school-districts',
  },
  {
    unitKind: 'district',
    label: 'Congressional districts',
    total: 8,
    slug: 'districts',
  },
  {
    unitKind: 'senate_district',
    label: 'Senate districts',
    total: 67,
    slug: 'senate-districts',
  },
  {
    unitKind: 'house_district',
    label: 'House districts',
    total: 134,
    slug: 'house-districts',
  },
] as const;

export const PASSPORT_TERRITORY_TOTALS: Record<string, number> =
  Object.fromEntries(PASSPORT_TERRITORY_KINDS.map((k) => [k.unitKind, k.total]));

export function passportKindBarLabel(unitKind: string): string {
  return (
    PASSPORT_TERRITORY_KINDS.find((k) => k.unitKind === unitKind)?.label ??
    unitKind.replace(/_/g, ' ')
  );
}

export function passportKindByUnitKind(
  unitKind: string,
): PassportTerritoryKindDef | undefined {
  return PASSPORT_TERRITORY_KINDS.find((k) => k.unitKind === unitKind);
}

export function passportKindBySlug(
  slug: string,
): PassportTerritoryKindDef | undefined {
  return PASSPORT_TERRITORY_KINDS.find((k) => k.slug === slug);
}

/** Presence / stamp UI is product-facing for CTU only; other kinds stay tracked server-side. */
export const PRESENCE_UI_UNIT_KIND = 'ctu';
export const PRESENCE_UI_SLUG = 'cities-and-towns';

export function territoryPresenceUiEnabledBySlug(slug: string): boolean {
  return slug === PRESENCE_UI_SLUG;
}

export function territoryPresenceUiEnabledByUnitKind(unitKind: string): boolean {
  return unitKind === PRESENCE_UI_UNIT_KIND;
}

export function territoryPresenceUiEnabledByDockKind(dockKind: string): boolean {
  return dockKind === 'ctu';
}

/** Empty progress rows for signed-out / pre-fetch Discover chrome. */
export function emptyPassportKindProgress(): Array<{
  unitKind: string;
  label: string;
  unlocked: number;
  total: number;
}> {
  return PASSPORT_TERRITORY_KINDS.map((k) => ({
    unitKind: k.unitKind,
    label: k.label,
    unlocked: 0,
    total: k.total,
  }));
}
