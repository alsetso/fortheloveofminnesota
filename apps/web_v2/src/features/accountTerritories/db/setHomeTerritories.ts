import { HOME_RESET_COOLDOWN_DAYS } from '@/features/accountTerritories/store/constants';
import { getAccountPlacesDb } from '@/features/accountTerritories/db/accountTerritoriesDb';
import { upsertSavedTerritory } from '@/features/accountTerritories/db/upsertSavedTerritory';

export type HomeJurisdiction = {
  id: string;
  kind: string;
  name: string;
  kindLabel?: string;
};

export type SetHomeResult =
  | {
      ok: true;
      stackId: string;
      unitIds: string[];
      homeSetAt: string;
      homeResetAvailableAt: string;
      action: 'created' | 'reset';
    }
  | { ok: false; error: string; status: number; resetAvailableAt?: string };

export async function getHomeStatus(accountId: string): Promise<{
  homeSetAt: string | null;
  homeResetAvailableAt: string | null;
  canReset: boolean;
  stackId: string | null;
  unitIds: string[];
  /** Snapshotted jurisdictions from the current home stack payload. */
  jurisdictions: HomeJurisdiction[];
}> {
  const db = getAccountPlacesDb();
  const { data: acct } = await db
    .from('accounts')
    .select('home_set_at, home_reset_available_at, home_territory_stack_id')
    .eq('id', accountId)
    .maybeSingle();

  const { data: units } = await db
    .from('account_home_units')
    .select('territory_unit_id')
    .eq('account_id', accountId);

  const stackId = (acct?.home_territory_stack_id as string | null) ?? null;
  let jurisdictions: HomeJurisdiction[] = [];
  if (stackId) {
    const { data: stack } = await db
      .schema('territory')
      .from('stacks')
      .select('payload')
      .eq('id', stackId)
      .maybeSingle();
    const payload = stack?.payload as { jurisdictions?: HomeJurisdiction[] } | null;
    if (Array.isArray(payload?.jurisdictions)) {
      jurisdictions = payload.jurisdictions.filter(
        (j) => j && typeof j.id === 'string' && typeof j.name === 'string',
      );
    }
  }

  const resetAt = acct?.home_reset_available_at
    ? new Date(acct.home_reset_available_at as string)
    : null;
  const canReset = !resetAt || resetAt.getTime() <= Date.now() || !acct?.home_set_at;

  return {
    homeSetAt: (acct?.home_set_at as string | null) ?? null,
    homeResetAvailableAt: (acct?.home_reset_available_at as string | null) ?? null,
    canReset,
    stackId,
    unitIds: (units ?? [])
      .map((u) => u.territory_unit_id as string)
      .filter(Boolean),
    jurisdictions,
  };
}

/**
 * Commit home territories from an at-point jurisdiction list.
 * Mirrors live_here affinities; enforces 30-day reset cooldown when replacing.
 */
export async function setHomeTerritories(opts: {
  accountId: string;
  lat: number;
  lng: number;
  jurisdictions: HomeJurisdiction[];
  confirm: boolean;
}): Promise<SetHomeResult> {
  if (!opts.confirm) {
    return { ok: false, error: 'Confirmation required', status: 400 };
  }

  const unitIds = [
    ...new Set(opts.jurisdictions.map((j) => j.id).filter(Boolean)),
  ];
  if (unitIds.length === 0) {
    return { ok: false, error: 'No areas to set as home', status: 400 };
  }

  const db = getAccountPlacesDb();
  const status = await getHomeStatus(opts.accountId);

  if (status.homeSetAt && !status.canReset) {
    return {
      ok: false,
      error: 'Home can only be reset once every 30 days',
      status: 429,
      resetAvailableAt: status.homeResetAvailableAt ?? undefined,
    };
  }

  // Validate units exist
  const { data: units, error: unitsErr } = await db
    .schema('territory')
    .from('units')
    .select('id')
    .in('id', unitIds);

  if (unitsErr) {
    return { ok: false, error: unitsErr.message, status: 500 };
  }
  const validIds = new Set((units ?? []).map((u) => u.id as string));
  const finalIds = unitIds.filter((id) => validIds.has(id));
  if (finalIds.length === 0) {
    return { ok: false, error: 'No matching territory units', status: 400 };
  }

  const payload = {
    jurisdictions: opts.jurisdictions.filter((j) => finalIds.includes(j.id)),
  };

  const { data: stack, error: stackErr } = await db
    .schema('territory')
    .from('stacks')
    .insert({
      account_id: opts.accountId,
      lat: opts.lat,
      lng: opts.lng,
      payload,
    })
    .select('id')
    .single();

  if (stackErr || !stack?.id) {
    return {
      ok: false,
      error: stackErr?.message ?? 'Could not create home stack',
      status: 500,
    };
  }

  const now = new Date();
  const resetAt = new Date(
    now.getTime() + HOME_RESET_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.from('account_home_units').delete().eq('account_id', opts.accountId);

  const homeRows = finalIds.map((territory_unit_id) => ({
    account_id: opts.accountId,
    territory_unit_id,
    stack_id: stack.id as string,
    set_at: now.toISOString(),
  }));

  const { error: homeErr } = await db.from('account_home_units').insert(homeRows);
  if (homeErr) {
    return { ok: false, error: homeErr.message, status: 500 };
  }

  const { error: acctErr } = await db
    .from('accounts')
    .update({
      home_territory_stack_id: stack.id,
      home_set_at: now.toISOString(),
      home_reset_available_at: resetAt.toISOString(),
    })
    .eq('id', opts.accountId);

  if (acctErr) {
    return { ok: false, error: acctErr.message, status: 500 };
  }

  // Mirror live_here affinities for home units (best-effort).
  for (const unitId of finalIds) {
    await upsertSavedTerritory({
      accountId: opts.accountId,
      territoryUnitId: unitId,
      kind: 'live_here',
      isCurrent: true,
      isPublic: true,
    });
  }

  return {
    ok: true,
    stackId: stack.id as string,
    unitIds: finalIds,
    homeSetAt: now.toISOString(),
    homeResetAvailableAt: resetAt.toISOString(),
    action: status.homeSetAt ? 'reset' : 'created',
  };
}
