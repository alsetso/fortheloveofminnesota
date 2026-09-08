import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { matchSavedTerritories } from '@/features/accountTerritories/db/upsertSavedTerritory';

/**
 * POST /api/account-territories/match
 * Body: { unitIds: string[] }
 * Returns saved/home state per unit — used to avoid re-saving.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      unitIds?: unknown;
    } | null;

    const unitIds = Array.isArray(body?.unitIds)
      ? body.unitIds
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 100)
      : [];

    const matches = await matchSavedTerritories({
      accountId: session.accountId,
      unitIds,
    });

    return NextResponse.json({ matches });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/account-territories/match', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
