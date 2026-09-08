/**
 * Account ↔ city relationship tags on `account_places`.
 *
 * Product tags (only these): Live / Work / Follow.
 * Retired affinity tags (no longer offered): grew_up_here, went_to_school,
 * going_to_school, family_here, owns_business — leftover rows may still exist
 * in DB until a cleanup migration; UI and upserts no longer create them.
 *
 * Home stack (`account_home_units`) is legacy iOS — web_v2 Home is
 * `account_places.is_home` on a live_here CTU. Prefer Places Home going forward.
 */

export const ACCOUNT_TERRITORY_KIND_OPTIONS = [
  { id: 'live_here', label: 'Live here' },
  { id: 'work_here', label: 'Work here' },
  { id: 'interested_in', label: 'Following' },
] as const;

export type AccountTerritoryKindId =
  (typeof ACCOUNT_TERRITORY_KIND_OPTIONS)[number]['id'];

/** All product tags — shown on territory details / Play gov. */
export const ACCOUNT_TERRITORY_PRIMARY_KINDS: AccountTerritoryKindId[] = [
  'live_here',
  'work_here',
  'interested_in',
];

/** Retired affinity kind ids — not creatable; leftover rows can still be removed in UI. */
export const ACCOUNT_TERRITORY_RETIRED_KINDS: string[] = [
  'grew_up_here',
  'went_to_school',
  'going_to_school',
  'family_here',
  'owns_business',
];

export const HOME_RESET_COOLDOWN_DAYS = 30;

export function accountTerritoryKindLabel(kind: string): string {
  return (
    ACCOUNT_TERRITORY_KIND_OPTIONS.find((o) => o.id === kind)?.label ??
    kind.replace(/_/g, ' ')
  );
}

export function isAccountTerritoryKind(kind: string): kind is AccountTerritoryKindId {
  return ACCOUNT_TERRITORY_KIND_OPTIONS.some((o) => o.id === kind);
}

/**
 * Territory kinds kept in backend geo / presence / XP, but hidden from all
 * product UI (passport bars, unlock celebrations, Find Me stack, save, Explore).
 *
 * We track all 7 kinds in account_territory_presence for data completeness,
 * but only surface Cities & Towns (ctu) in the product.  County, school
 * district, legislative, congressional, and zipcode are all tracked silently.
 *
 * Precincts (district_part) are never written to account_territory_presence
 * and are excluded at the presence / RPC layer entirely.
 */
export const HIDDEN_TERRITORY_KINDS = new Set<string>([
  'county',
  'school_district',
  'district',
  'senate_district',
  'house_district',
  'zipcode',
]);

export function isHiddenTerritoryKind(kind: string | null | undefined): boolean {
  return Boolean(kind && HIDDEN_TERRITORY_KINDS.has(kind));
}

/** True when this kind should appear in passport / activity / recently-unlocked. */
export function isProductTerritoryKind(kind: string | null | undefined): boolean {
  return Boolean(kind) && !isHiddenTerritoryKind(kind);
}

/**
 * The primary "game score" territory kind — Cities & Towns (CTU).
 *   ctu  →  max 2,693 unlockable places
 */
export const PRIMARY_TERRITORY_KINDS = new Set<string>(['ctu']);

export function isPrimaryTerritoryKind(kind: string | null | undefined): boolean {
  return Boolean(kind) && PRIMARY_TERRITORY_KINDS.has(kind as string);
}

/**
 * Map dock entity kinds → territory.units.kind values used in the projection.
 * at-point returns `district` for congressional; units store `congressional`.
 */
export function dockKindToUnitKind(dockKind: string): string {
  switch (dockKind) {
    case 'district':
      return 'congressional';
    case 'senate_district':
      return 'legislative';
    case 'house_district':
      return 'legislative';
    default:
      return dockKind;
  }
}

/** Dock kinds that map to territory.units (not schools, pins, pages, precincts). */
export function isSaveableTerritoryDockKind(kind: string): boolean {
  if (!isProductTerritoryKind(kind)) return false;
  return kind === 'ctu';
}
