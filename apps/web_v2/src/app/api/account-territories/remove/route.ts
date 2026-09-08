import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  ACCOUNT_TERRITORY_RETIRED_KINDS,
  isAccountTerritoryKind,
} from '@/features/accountTerritories/store/constants';
import { removeSavedTerritory } from '@/features/accountTerritories/db/removeSavedTerritory';

/**
 * POST /api/account-territories/remove
 * Body: { territoryUnitId, kind? } — omit kind to clear every removable affinity.
 * `kind` may be a product tag or a retired affinity being cleaned up.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      territoryUnitId?: unknown;
      kind?: unknown;
    } | null;

    const territoryUnitId =
      typeof body?.territoryUnitId === 'string' ? body.territoryUnitId.trim() : '';
    const kindRaw = typeof body?.kind === 'string' ? body.kind.trim() : '';

    if (!territoryUnitId) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const kindOk =
      !kindRaw ||
      isAccountTerritoryKind(kindRaw) ||
      (ACCOUNT_TERRITORY_RETIRED_KINDS as readonly string[]).includes(kindRaw);
    if (!kindOk) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    const result = await removeSavedTerritory({
      accountId: session.accountId,
      territoryUnitId,
      ...(kindRaw ? { kind: kindRaw } : {}),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          homeLocked: result.homeLocked ?? false,
          homeResetAvailableAt: result.homeResetAvailableAt ?? null,
        },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      removedKinds: result.removedKinds,
      remainingKinds: result.remainingKinds,
      homeLocked: result.homeLocked,
      homeResetAvailableAt: result.homeResetAvailableAt,
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/account-territories/remove', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
