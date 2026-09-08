import {
  isAccountTerritoryKind,
  type AccountTerritoryKindId,
} from '@/features/accountTerritories/store/constants';
import { getAccountPlacesDb } from '@/features/accountTerritories/db/accountTerritoriesDb';

export type UpsertSavedTerritoryInput = {
  accountId: string;
  territoryUnitId: string;
  kind: AccountTerritoryKindId;
  pageId?: string | null;
  isCurrent?: boolean;
  isPublic?: boolean;
};

export type UpsertSavedTerritoryResult =
  | { ok: true; action: 'created' | 'updated' | 'unchanged'; id: string }
  | { ok: false; error: string; status?: number };

type UnitRow = {
  id: string;
  kind: string;
  subtype: string | null;
  source_table: string | null;
};

function legacyGeoFromUnit(unit: UnitRow): {
  city_id: string | null;
  county_id: string | null;
  school_district_id: string | null;
  zipcode_id: string | null;
} {
  const empty = {
    city_id: null as string | null,
    county_id: null as string | null,
    school_district_id: null as string | null,
    zipcode_id: null as string | null,
  };
  switch (unit.kind) {
    case 'ctu':
      return { ...empty, city_id: unit.id };
    case 'county':
      return { ...empty, county_id: unit.id };
    case 'school_district':
      return { ...empty, school_district_id: unit.id };
    case 'zipcode':
      return { ...empty, zipcode_id: unit.id };
    default:
      return empty;
  }
}

/** Kind-scoped upsert into public.account_places for one territory unit. */
export async function upsertSavedTerritory(
  input: UpsertSavedTerritoryInput,
): Promise<UpsertSavedTerritoryResult> {
  if (!isAccountTerritoryKind(input.kind)) {
    return { ok: false, error: 'Invalid kind', status: 400 };
  }

  const db = getAccountPlacesDb();
  const { data: unit, error: unitErr } = await db
    .schema('territory')
    .from('units')
    .select('id, kind, subtype, source_table')
    .eq('id', input.territoryUnitId)
    .maybeSingle();

  if (unitErr || !unit) {
    return { ok: false, error: 'Area not found', status: 404 };
  }

  if ((unit as UnitRow).kind !== 'ctu') {
    return { ok: false, error: 'Places tags are for cities only.', status: 400 };
  }

  const geo = legacyGeoFromUnit(unit as UnitRow);

  const { data: existing } = await db
    .from('account_places')
    .select('id, page_id, is_current, is_public')
    .eq('account_id', input.accountId)
    .eq('kind', input.kind)
    .eq('territory_unit_id', input.territoryUnitId)
    .maybeSingle();

  const next = {
    account_id: input.accountId,
    kind: input.kind,
    territory_unit_id: input.territoryUnitId,
    city_id: geo.city_id,
    county_id: geo.county_id,
    school_district_id: geo.school_district_id,
    zipcode_id: geo.zipcode_id,
    page_id: null as string | null,
    is_current: input.isCurrent ?? true,
    is_public: input.isPublic ?? true,
  };

  if (existing?.id) {
    const same =
      (existing.page_id ?? null) === (next.page_id ?? null) &&
      Boolean(existing.is_current) === next.is_current &&
      Boolean(existing.is_public) === next.is_public;
    if (same) {
      return { ok: true, action: 'unchanged', id: existing.id as string };
    }
    const { error } = await db.from('account_places').update(next).eq('id', existing.id);
    if (error) {
      return { ok: false, error: error.message, status: 500 };
    }
    return { ok: true, action: 'updated', id: existing.id as string };
  }

  const { data: inserted, error } = await db
    .from('account_places')
    .insert(next)
    .select('id')
    .single();

  if (error || !inserted?.id) {
    return { ok: false, error: error?.message ?? 'Insert failed', status: 500 };
  }
  return { ok: true, action: 'created', id: inserted.id as string };
}

export type SavedTerritoryMatchRow = {
  saved: boolean;
  kinds: string[];
  isHome: boolean;
  /** Home unit still inside the 30-day reset cooldown — Live here / place stay locked. */
  homeLocked: boolean;
  homeResetAvailableAt: string | null;
};

/** Batch: which unit ids are already saved (any kind) + kinds + home membership. */
export async function matchSavedTerritories(opts: {
  accountId: string;
  unitIds: string[];
}): Promise<Record<string, SavedTerritoryMatchRow>> {
  const ids = [...new Set(opts.unitIds.filter(Boolean))].slice(0, 100);
  const out: Record<string, SavedTerritoryMatchRow> = {};
  for (const id of ids) {
    out[id] = {
      saved: false,
      kinds: [],
      isHome: false,
      homeLocked: false,
      homeResetAvailableAt: null,
    };
  }
  if (ids.length === 0) return out;

  const db = getAccountPlacesDb();

  const [{ data: places }, { data: home }, { data: acct }] = await Promise.all([
    db
      .from('account_places')
      .select('territory_unit_id, kind')
      .eq('account_id', opts.accountId)
      .in('territory_unit_id', ids),
    db
      .from('account_home_units')
      .select('territory_unit_id')
      .eq('account_id', opts.accountId)
      .in('territory_unit_id', ids),
    db
      .from('accounts')
      .select('home_set_at, home_reset_available_at')
      .eq('id', opts.accountId)
      .maybeSingle(),
  ]);

  const resetAt = acct?.home_reset_available_at
    ? new Date(acct.home_reset_available_at as string)
    : null;
  const canReset =
    !acct?.home_set_at || !resetAt || resetAt.getTime() <= Date.now();
  const resetIso = (acct?.home_reset_available_at as string | null) ?? null;

  for (const row of places ?? []) {
    const uid = row.territory_unit_id as string | null;
    if (!uid || !out[uid]) continue;
    out[uid].saved = true;
    if (typeof row.kind === 'string' && !out[uid].kinds.includes(row.kind)) {
      out[uid].kinds.push(row.kind);
    }
  }
  for (const row of home ?? []) {
    const uid = row.territory_unit_id as string;
    if (!out[uid]) continue;
    out[uid].isHome = true;
    out[uid].homeLocked = !canReset;
    out[uid].homeResetAvailableAt = resetIso;
  }

  return out;
}
