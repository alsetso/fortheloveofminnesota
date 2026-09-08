export const ACCOUNT_PLACE_KINDS = ['live_here', 'work_here', 'interested_in'] as const;

export type AccountPlaceKind = (typeof ACCOUNT_PLACE_KINDS)[number];

export type AccountPlace = {
  id: string;
  account_id: string;
  kind: AccountPlaceKind;
  territory_unit_id: string | null;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  name: string | null;
  unit_name: string | null;
  unit_kind: string | null;
  notify: boolean;
  is_home: boolean;
  home_locked_until: string | null;
  is_public: boolean;
  is_current: boolean;
  created_at: string;
};

export type AccountPlacePatch = {
  name?: string | null;
  notify?: boolean;
  kind?: AccountPlaceKind;
  address_line?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_public?: boolean;
};

export const ACCOUNT_PLACE_SELECT =
  'id, account_id, kind, territory_unit_id, address_line, lat, lng, name, notify, is_home, home_locked_until, is_public, is_current, created_at';

export const ACCOUNT_PLACE_NAME_MAX = 48;

/** Product tags for a city — Live / Work / Follow. */
export const PLACE_KIND_LABEL: Record<AccountPlaceKind, string> = {
  live_here: 'Live',
  work_here: 'Work',
  interested_in: 'Follow',
};

export const PLACE_KIND_OPTIONS: Array<{ id: AccountPlaceKind; label: string }> = [
  { id: 'live_here', label: 'Live' },
  { id: 'work_here', label: 'Work' },
  { id: 'interested_in', label: 'Follow' },
];

const GENERIC_PLACE_NAMES = new Set([
  'home',
  'work',
  'follow',
  'following',
  'live',
  'live here',
  'work here',
  'follow a city',
  'place',
]);

export function kindLabel(kind: AccountPlaceKind): string {
  return PLACE_KIND_LABEL[kind];
}

export function sanitizePlaceName(raw: string | null | undefined): string | null {
  const name = raw?.trim() ?? '';
  if (!name) return null;
  if (GENERIC_PLACE_NAMES.has(name.toLowerCase())) return null;
  if (name.length > ACCOUNT_PLACE_NAME_MAX) return name.slice(0, ACCOUNT_PLACE_NAME_MAX);
  return name;
}

export function placeDisplayName(
  row: Pick<AccountPlace, 'name' | 'kind' | 'is_home' | 'unit_name'>,
): string {
  const named = sanitizePlaceName(row.name);
  if (named) return named;
  const city = row.unit_name?.trim();
  if (city) return city;
  if (row.is_home) return 'Home';
  if (row.kind === 'work_here') return 'Work';
  return kindLabel(row.kind);
}

export function isAccountPlaceKind(value: string): value is AccountPlaceKind {
  return (ACCOUNT_PLACE_KINDS as readonly string[]).includes(value);
}

export function isHomeLocked(
  row: Pick<AccountPlace, 'is_home' | 'home_locked_until'>,
): boolean {
  if (!row.is_home || !row.home_locked_until) return false;
  const until = new Date(row.home_locked_until).getTime();
  return Number.isFinite(until) && until > Date.now();
}

export function homeLockDate(untilIso: string): string | null {
  const until = new Date(untilIso);
  if (!Number.isFinite(until.getTime())) return null;
  return until.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function homeLockLabel(untilIso: string): string {
  const date = homeLockDate(untilIso);
  if (!date) return 'Home is locked.';
  return `Home locked until ${date}.`;
}
