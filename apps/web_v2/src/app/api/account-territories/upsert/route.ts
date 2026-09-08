import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  isAccountTerritoryKind,
  type AccountTerritoryKindId,
} from '@/features/accountTerritories/store/constants';
import { upsertSavedTerritory } from '@/features/accountTerritories/db/upsertSavedTerritory';

/**
 * POST /api/account-territories/upsert
 * Body: { territoryUnitId, kind, pageId? }
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
      pageId?: unknown;
    } | null;

    const territoryUnitId =
      typeof body?.territoryUnitId === 'string' ? body.territoryUnitId.trim() : '';
    const kindRaw = typeof body?.kind === 'string' ? body.kind.trim() : '';
    const pageId =
      typeof body?.pageId === 'string' && body.pageId.trim()
        ? body.pageId.trim()
        : null;

    if (!territoryUnitId || !isAccountTerritoryKind(kindRaw)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const result = await upsertSavedTerritory({
      accountId: session.accountId,
      territoryUnitId,
      kind: kindRaw as AccountTerritoryKindId,
      pageId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      action: result.action,
      id: result.id,
    });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/account-territories/upsert', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
