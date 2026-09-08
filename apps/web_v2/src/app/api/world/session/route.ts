import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { chicagoDateKey } from '@/features/streaks/streakCalendar';

export const dynamic = 'force-dynamic';

const KNOWN_TRIGGERS = new Set(['boot', 'map_mount']);

/**
 * POST /api/world/session
 * Fire-and-forget log of one "world load" — cold boot release or a Map tab
 * mount — so we can see exactly how many times the world/map is loading per
 * account. Also idempotently grants unclaimed daily-streak XP for the
 * America/Chicago calendar day.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { trigger?: unknown } | null;
    const trigger = typeof body?.trigger === 'string' && KNOWN_TRIGGERS.has(body.trigger)
      ? body.trigger
      : 'boot';

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('account_world_sessions')
      .insert({ account_id: session.accountId, trigger });

    if (error && process.env.NODE_ENV === 'development') {
      console.error('[world/session]', error);
    }

    let streakGranted = false;
    let streakAmount = 0;
    let streakDay: string | null = null;

    const { data: grantRows, error: grantError } = await supabase.rpc(
      'grant_daily_streak_xp',
      { p_account_id: session.accountId },
    );

    if (grantError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[world/session] streak grant', grantError);
      }
    } else {
      const row = Array.isArray(grantRows) ? grantRows[0] : grantRows;
      if (row && typeof row === 'object') {
        const granted = Boolean(
          (row as { out_granted?: boolean }).out_granted
            ?? (row as { granted?: boolean }).granted,
        );
        const amount = Number(
          (row as { out_amount?: number }).out_amount
            ?? (row as { amount?: number }).amount
            ?? 0,
        );
        const dayRaw =
          (row as { out_streak_day?: string }).out_streak_day
          ?? (row as { streak_day?: string }).streak_day
          ?? null;
        streakGranted = granted;
        streakAmount = amount;
        streakDay = dayRaw ? String(dayRaw).slice(0, 10) : chicagoDateKey();
      }
    }

    return NextResponse.json({
      ok: true,
      streakGranted,
      streakAmount,
      streakDay,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[world/session]', err);
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * GET /api/world/session
 * Count of world loads for the signed-in account today (America/Chicago) —
 * surfaced quietly on Today so loads are visible without digging into Supabase.
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const todayKey = chicagoDateKey();
    // Bound the query with a UTC window wide enough to cover Chicago midnight.
    const startUtc = new Date(Date.now() - 36 * 60 * 60 * 1000);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('account_world_sessions')
      .select('created_at')
      .eq('account_id', session.accountId)
      .gte('created_at', startUtc.toISOString());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const todayCount = (data ?? []).filter(
      (row) => chicagoDateKey(new Date(row.created_at as string)) === todayKey,
    ).length;

    return NextResponse.json({ ok: true, todayCount, today: todayKey });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[world/session]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
