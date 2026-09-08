import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  isAccountTerritoryKind,
  type AccountTerritoryKindId,
} from '@/features/accountTerritories/store/constants';
import { upsertSavedTerritory } from '@/features/accountTerritories/db/upsertSavedTerritory';
import { removeSavedTerritory } from '@/features/accountTerritories/db/removeSavedTerritory';
import { getAccountPlacesDb } from '@/features/accountTerritories/db/accountTerritoriesDb';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MyRelationshipResponse = {
  kinds: AccountTerritoryKindId[];
  homeLocked: boolean;
  homeResetAvailableAt: string | null;
};

async function fetchKinds(
  accountId: string,
  unitId: string,
): Promise<{ kinds: AccountTerritoryKindId[]; homeLocked: boolean; homeResetAvailableAt: string | null }> {
  const db = getAccountPlacesDb();

  const [{ data: places }, { data: home }, { data: acct }] = await Promise.all([
    db
      .from('account_places')
      .select('kind')
      .eq('account_id', accountId)
      .eq('territory_unit_id', unitId),
    db
      .from('account_home_units')
      .select('territory_unit_id')
      .eq('account_id', accountId)
      .eq('territory_unit_id', unitId)
      .maybeSingle(),
    db
      .from('accounts')
      .select('home_set_at, home_reset_available_at')
      .eq('id', accountId)
      .maybeSingle(),
  ]);

  const isHome = Boolean(home);
  const resetAt = (acct?.home_reset_available_at as string | null) ?? null;
  const homeLocked =
    isHome &&
    Boolean(acct?.home_set_at) &&
    Boolean(resetAt) &&
    new Date(resetAt!).getTime() > Date.now();

  const kinds = (places ?? [])
    .map((r) => r.kind as string)
    .filter(isAccountTerritoryKind) as AccountTerritoryKindId[];

  return { kinds, homeLocked, homeResetAvailableAt: resetAt };
}

/**
 * GET /api/territory/units/[id]/my-relationship
 * Returns the signed-in user's account_places kinds for this territory unit.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const result = await fetchKinds(session.accountId, id);
    return NextResponse.json(result satisfies MyRelationshipResponse);
  } catch (e) {
    console.error('[my-relationship GET]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/territory/units/[id]/my-relationship
 * Body: { kind: AccountTerritoryKindId, action: 'add' | 'remove' }
 * Returns updated { kinds, homeLocked, homeResetAvailableAt }.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as {
      kind?: unknown;
      action?: unknown;
    } | null;

    const kindRaw = typeof body?.kind === 'string' ? body.kind.trim() : '';
    const action = body?.action === 'add' || body?.action === 'remove' ? body.action : null;

    if (!kindRaw || !isAccountTerritoryKind(kindRaw) || !action) {
      return NextResponse.json(
        { error: 'Body must include a valid kind and action ("add" | "remove")' },
        { status: 400 },
      );
    }

    const kind = kindRaw as AccountTerritoryKindId;

    if (action === 'add') {
      const result = await upsertSavedTerritory({
        accountId: session.accountId,
        territoryUnitId: id,
        kind,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
      }
    } else {
      const result = await removeSavedTerritory({
        accountId: session.accountId,
        territoryUnitId: id,
        kind,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, homeLocked: result.homeLocked, homeResetAvailableAt: result.homeResetAvailableAt },
          { status: result.status ?? 400 },
        );
      }
    }

    const updated = await fetchKinds(session.accountId, id);
    return NextResponse.json(updated satisfies MyRelationshipResponse);
  } catch (e) {
    console.error('[my-relationship POST]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
