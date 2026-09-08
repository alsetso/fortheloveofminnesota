import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

export const dynamic = 'force-dynamic';

type PresenceRpcRow = {
  out_unit_kind: string;
  out_unit_id: string;
  out_name: string;
  out_newly_unlocked: boolean;
  out_xp_amount: number;
};

/**
 * POST /api/account-territories/presence
 * Reports a Find Me fix for the signed-in account. Upserts passport presence
 * for every jurisdiction containing the point and grants XP for any that are
 * brand new — this is the "unlock a territory by visiting it" flow.
 *
 * Server enforces a velocity gate (~70 m/s / 252 km/h vs last accepted fix).
 * Teleport spoofs raise location_implausible (400). The client sync path
 * treats that as a soft no-op so GPS glitches never spam UI.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { lat?: unknown; lng?: unknown }
      | null;
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json({ error: 'Invalid lat/lng' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('report_territory_presence', {
      p_lat: lat,
      p_lng: lng,
      // Multi-account safe: without this the RPC fell back to an arbitrary
      // account owned by the user, so unlock XP could land on the wrong one.
      p_account_id: session.accountId,
    });

    if (error) {
      const known: Record<string, number> = {
        location_implausible: 400,
        'Invalid lat/lng': 400,
        'Not authenticated': 401,
        'No account for user': 403,
        'Account does not belong to caller': 403,
      };
      const status = known[error.message] ?? 500;
      if (status === 500 && process.env.NODE_ENV === 'development') {
        console.error('[account-territories/presence]', error);
      }
      return NextResponse.json({ error: error.message }, { status });
    }

    const rows = (data ?? []) as PresenceRpcRow[];
    const unlocked = rows
      .filter((row) => row.out_newly_unlocked)
      .map((row) => ({
        unitKind: row.out_unit_kind,
        unitId: row.out_unit_id,
        name: row.out_name,
        xpAmount: row.out_xp_amount,
      }));

    // XP for a fresh unlock lands unclaimed (see report_territory_presence) —
    // level won't move until the account claims it, so no level read here.

    return NextResponse.json({
      ok: true,
      jurisdictions: rows.map((row) => ({
        unitKind: row.out_unit_kind,
        unitId: row.out_unit_id,
        name: row.out_name,
        newlyUnlocked: row.out_newly_unlocked,
      })),
      newlyUnlocked: unlocked,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[account-territories/presence]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
