import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  getHomeStatus,
  setHomeTerritories,
  type HomeJurisdiction,
} from '@/features/accountTerritories/db/setHomeTerritories';

/**
 * GET /api/account-territories/home — current home status + unit ids.
 * POST — set/reset home from at-point jurisdictions (confirm:true required).
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getHomeStatus(session.accountId);
    return NextResponse.json(status);
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('GET /api/account-territories/home', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as {
      lat?: unknown;
      lng?: unknown;
      confirm?: unknown;
      jurisdictions?: unknown;
    } | null;

    const lat = typeof body?.lat === 'number' ? body.lat : Number(body?.lat);
    const lng = typeof body?.lng === 'number' ? body.lng : Number(body?.lng);
    const confirm = body?.confirm === true;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'Invalid lat/lng' }, { status: 400 });
    }

    const jurisdictions: HomeJurisdiction[] = Array.isArray(body?.jurisdictions)
      ? body.jurisdictions.flatMap((j) => {
          if (!j || typeof j !== 'object') return [];
          const row = j as Record<string, unknown>;
          const id = typeof row.id === 'string' ? row.id : '';
          const kind = typeof row.kind === 'string' ? row.kind : '';
          const name = typeof row.name === 'string' ? row.name : '';
          if (!id || !kind || !name) return [];
          const next: HomeJurisdiction = {
            id,
            kind,
            name,
          };
          if (typeof row.kindLabel === 'string') {
            next.kindLabel = row.kindLabel;
          }
          return [next];
        })
      : [];

    const result = await setHomeTerritories({
      accountId: session.accountId,
      lat,
      lng,
      jurisdictions,
      confirm,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          resetAvailableAt: result.resetAvailableAt ?? null,
        },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('POST /api/account-territories/home', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
