import { createClient } from '@/lib/supabase/client';
import {
  getAccountPlaces,
  removeAccountPlace,
  setAccountPlaces,
  upsertAccountPlace,
} from '@/lib/accountPlaces/store';
import {
  ACCOUNT_PLACE_KINDS,
  ACCOUNT_PLACE_SELECT,
  isAccountPlaceKind,
  isHomeLocked,
  type AccountPlace,
  type AccountPlaceKind,
  type AccountPlacePatch,
} from '@/lib/accountPlaces/types';

export type {
  AccountPlace,
  AccountPlaceKind,
  AccountPlacePatch,
} from '@/lib/accountPlaces/types';
export {
  ACCOUNT_PLACE_KINDS,
  PLACE_KIND_LABEL,
  PLACE_KIND_OPTIONS,
  homeLockDate,
  homeLockLabel,
  isHomeLocked,
  kindLabel,
  placeDisplayName,
} from '@/lib/accountPlaces/types';

type UnitLabel = { name: string; kind: string };

function asPlace(row: unknown, labels?: Map<string, UnitLabel>): AccountPlace {
  const item = row as AccountPlace;
  const kind = isAccountPlaceKind(item.kind) ? item.kind : 'interested_in';
  const unitId = item.territory_unit_id;
  const fromLabel = unitId ? labels?.get(unitId) : undefined;
  const prev = getAccountPlaces().find((place) => place.id === item.id);
  return {
    ...item,
    kind,
    unit_name: fromLabel?.name ?? item.unit_name ?? prev?.unit_name ?? null,
    unit_kind: fromLabel?.kind ?? item.unit_kind ?? prev?.unit_kind ?? null,
  };
}

async function loadUnitLabels(
  ids: Array<string | null | undefined>,
): Promise<Map<string, UnitLabel>> {
  const unique = [
    ...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ];
  if (unique.length === 0) return new Map();

  const supabase = createClient();
  const { data, error } = await supabase.rpc('territory_unit_labels', { p_ids: unique });
  if (!error && data) {
    const next = new Map<string, UnitLabel>();
    for (const row of data as Array<{ id?: unknown; name?: unknown; kind?: unknown }>) {
      if (typeof row.id !== 'string' || typeof row.name !== 'string') continue;
      next.set(row.id, {
        name: row.name,
        kind: typeof row.kind === 'string' ? row.kind : 'ctu',
      });
    }
    if (next.size > 0) return next;
  }

  const { data: units } = await supabase
    .schema('territory')
    .from('units')
    .select('id, kind, name')
    .in('id', unique);
  const next = new Map<string, UnitLabel>();
  for (const unit of units ?? []) {
    next.set(unit.id as string, {
      name: unit.name as string,
      kind: (unit.kind as string) ?? 'ctu',
    });
  }
  return next;
}

function dbMessage(error: { message?: string } | null, fallback: string): string {
  const raw = error?.message ?? '';
  if (/Home is locked/i.test(raw)) return raw.replace(/^.*Home is locked/, 'Home is locked');
  if (/Home has to be/i.test(raw)) return 'Home has to be a city you live in.';
  return raw || fallback;
}

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

/** Product Places only — live / work / follow (CTU alerts graph). */
export async function listAccountPlaces(accountId: string): Promise<AccountPlace[]> {
  await requireUserId();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('account_places')
    .select(ACCOUNT_PLACE_SELECT)
    .eq('account_id', accountId)
    .in('kind', [...ACCOUNT_PLACE_KINDS])
    .order('is_home', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message || 'Could not load places.');
  const labels = await loadUnitLabels(
    (data ?? []).map((row) => (row as AccountPlace).territory_unit_id),
  );
  const rows = (data ?? [])
    .map((row) => asPlace(row, labels))
    .filter((row) => !row.unit_kind || row.unit_kind === 'ctu');
  setAccountPlaces(accountId, rows);
  return rows;
}

export async function updateAccountPlace(
  accountId: string,
  id: string,
  patch: AccountPlacePatch,
): Promise<AccountPlace> {
  await requireUserId();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('account_places')
    .update(patch)
    .eq('id', id)
    .eq('account_id', accountId)
    .select(ACCOUNT_PLACE_SELECT)
    .single();
  if (error || !data) throw new Error(dbMessage(error, 'Could not save.'));
  const labels = await loadUnitLabels([(data as AccountPlace).territory_unit_id]);
  const row = asPlace(data, labels);
  upsertAccountPlace(row);
  return row;
}

export async function deleteAccountPlace(accountId: string, id: string): Promise<void> {
  await requireUserId();
  const current = getAccountPlaces().find((row) => row.id === id);
  if (current && isHomeLocked(current)) {
    throw new Error('Home is locked — wait out the cooldown before removing it.');
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('account_places')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId);
  if (error) throw new Error(dbMessage(error, 'Could not remove place.'));
  removeAccountPlace(id);
}

export type CitySearchHit = {
  id: string;
  name: string;
};

/** Search Minnesota cities (CTUs) by name. */
export async function searchCities(query: string, limit = 8): Promise<CitySearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .schema('territory')
    .from('units')
    .select('id, name')
    .eq('kind', 'ctu')
    .ilike('name', `${q}%`)
    .order('name', { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message || 'Could not search cities.');
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

/**
 * Ensure a city has a given tag (live / work / follow).
 * Idempotent when the same unit+kind already exists.
 */
export async function ensureCityKind(
  accountId: string,
  unitId: string,
  kind: AccountPlaceKind,
  unitName?: string,
): Promise<AccountPlace> {
  await requireUserId();
  const supabase = createClient();
  const labels = await loadUnitLabels([unitId]);
  const name = unitName ?? labels.get(unitId)?.name ?? null;

  const { data: existing } = await supabase
    .from('account_places')
    .select(ACCOUNT_PLACE_SELECT)
    .eq('account_id', accountId)
    .eq('kind', kind)
    .eq('territory_unit_id', unitId)
    .maybeSingle();

  if (existing?.id) {
    const row = asPlace(existing, labels);
    upsertAccountPlace(row);
    return row;
  }

  // Inherit notify from another tag on the same city when present.
  const sibling = getAccountPlaces().find(
    (row) => row.territory_unit_id === unitId && row.notify,
  );

  const { data, error } = await supabase
    .from('account_places')
    .insert({
      account_id: accountId,
      kind,
      territory_unit_id: unitId,
      name,
      notify: sibling?.notify ?? true,
      is_public: kind !== 'live_here',
      is_current: true,
    })
    .select(ACCOUNT_PLACE_SELECT)
    .single();
  if (error || !data) throw new Error(dbMessage(error, 'Could not save that tag.'));
  const row = asPlace(data, labels);
  upsertAccountPlace(row);
  return row;
}

/** Follow a city (interested_in + notify on). */
export async function followCity(
  accountId: string,
  unitId: string,
  unitName?: string,
): Promise<AccountPlace> {
  const row = await ensureCityKind(accountId, unitId, 'interested_in', unitName);
  if (!row.notify) {
    return updateAccountPlace(accountId, row.id, { notify: true });
  }
  return row;
}

/** Drop one tag for a city. */
export async function removeCityKind(
  accountId: string,
  unitId: string,
  kind: AccountPlaceKind,
): Promise<void> {
  const row = getAccountPlaces().find(
    (place) => place.territory_unit_id === unitId && place.kind === kind,
  );
  if (!row) return;
  if (kind === 'live_here' && isHomeLocked(row)) {
    throw new Error('Home is locked — wait out the cooldown before removing Live.');
  }
  await deleteAccountPlace(accountId, row.id);
}

/** Remove every product tag for a city. */
export async function removeCity(accountId: string, unitId: string): Promise<void> {
  const rows = getAccountPlaces().filter((place) => place.territory_unit_id === unitId);
  for (const row of rows) {
    if (isHomeLocked(row)) {
      throw new Error('Home is locked — wait out the cooldown before removing this city.');
    }
  }
  for (const row of rows) {
    await deleteAccountPlace(accountId, row.id);
  }
}

/** Set notify on every product tag for a city. */
export async function setCityNotify(
  accountId: string,
  unitId: string,
  notify: boolean,
): Promise<void> {
  const rows = getAccountPlaces().filter((place) => place.territory_unit_id === unitId);
  await Promise.all(rows.map((row) => updateAccountPlace(accountId, row.id, { notify })));
}

/** Elect Home — must be a live_here city. */
export async function electHome(accountId: string, id: string): Promise<AccountPlace[]> {
  await requireUserId();
  const supabase = createClient();
  let current = getAccountPlaces().find((row) => row.id === id);
  if (!current) {
    const { data, error } = await supabase
      .from('account_places')
      .select(ACCOUNT_PLACE_SELECT)
      .eq('id', id)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error || !data) throw new Error(dbMessage(error, 'Could not set home.'));
    current = asPlace(data);
  }
  if (current.kind !== 'live_here') {
    throw new Error('Home has to be a city you live in.');
  }
  if (current.is_home) return listAccountPlaces(accountId);

  const locked = getAccountPlaces().find((row) => row.is_home && isHomeLocked(row));
  if (locked) {
    throw new Error(
      locked.home_locked_until
        ? `Home is locked until ${new Date(locked.home_locked_until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`
        : 'Home is locked.',
    );
  }

  const { error: clearError } = await supabase
    .from('account_places')
    .update({ is_home: false })
    .eq('account_id', accountId)
    .eq('is_home', true);
  if (clearError) throw new Error(dbMessage(clearError, 'Could not update home.'));

  const { error: electError } = await supabase
    .from('account_places')
    .update({ is_home: true, kind: 'live_here' })
    .eq('id', id)
    .eq('account_id', accountId)
    .eq('kind', 'live_here');
  if (electError) throw new Error(dbMessage(electError, 'Could not set home.'));

  return listAccountPlaces(accountId);
}
