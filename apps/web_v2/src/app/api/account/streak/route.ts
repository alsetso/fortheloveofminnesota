import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  DAILY_STREAK_XP,
  STREAK_TIMEZONE,
  calendarYearBounds,
  chicagoDateKey,
  computeCurrentStreak,
  computeLongestStreak,
  yearDateKeys,
} from '@/features/streaks/streakCalendar';
import type { StreakDay } from '@/features/streaks/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/streak
 * Full calendar-year login grid (Jan 1 → Dec 31, America/Chicago): past days
 * show activity through today; remaining days of the year are future placeholders.
 * dailyXp comes from the published economy (source_xp_by_type).
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayKey = chicagoDateKey();
    const { year, startKey, endKey } = calendarYearBounds(todayKey);
    // Buffer before Jan 1 so Chicago-midnight sessions aren't clipped by UTC.
    const historyStartIso = new Date(`${year - 1}-12-30T00:00:00.000Z`).toISOString();

    const supabase = await createSupabaseServerClient();
    const [sessionsRes, xpRes, dailyXpRes] = await Promise.all([
      supabase
        .from('account_world_sessions')
        .select('created_at')
        .eq('account_id', session.accountId)
        .gte('created_at', historyStartIso),
      supabase
        .from('account_xp_transactions')
        .select('amount, claimed_at, idempotency_key, created_at')
        .eq('account_id', session.accountId)
        .eq('source_type', 'daily_streak')
        .gte('created_at', historyStartIso),
      supabase.rpc('daily_streak_xp' as never),
    ]);

    if (sessionsRes.error) {
      return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
    }
    if (xpRes.error) {
      return NextResponse.json({ error: xpRes.error.message }, { status: 500 });
    }

    const publishedDailyXp = Number(dailyXpRes.data);
    const dailyXp =
      Number.isFinite(publishedDailyXp) && publishedDailyXp > 0
        ? publishedDailyXp
        : DAILY_STREAK_XP;

    const loadCountByDay = new Map<string, number>();
    for (const row of sessionsRes.data ?? []) {
      const key = chicagoDateKey(new Date(row.created_at as string));
      if (key < startKey || key > endKey) continue;
      loadCountByDay.set(key, (loadCountByDay.get(key) ?? 0) + 1);
    }

    const xpByDay = new Map<string, { amount: number; claimed: boolean }>();
    const prefix = `xp:daily_streak:${session.accountId}:`;
    for (const row of xpRes.data ?? []) {
      const key = String(row.idempotency_key ?? '');
      const day =
        key.startsWith(prefix) ? key.slice(prefix.length) : chicagoDateKey(new Date(row.created_at as string));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      if (day < startKey || day > endKey) continue;
      xpByDay.set(day, {
        amount: Number(row.amount) || dailyXp,
        claimed: row.claimed_at != null,
      });
    }

    const activeDays = new Set<string>();
    for (const [date, count] of loadCountByDay) {
      if (count > 0 && date <= todayKey) activeDays.add(date);
    }
    for (const date of xpByDay.keys()) {
      if (date <= todayKey) activeDays.add(date);
    }

    const sortedActive = Array.from(activeDays).sort();
    const currentStreak = computeCurrentStreak(activeDays, todayKey);
    const longestStreak = Math.max(
      computeLongestStreak(sortedActive),
      currentStreak,
    );

    const dateKeys = yearDateKeys(year);
    const days: StreakDay[] = dateKeys.map((date) => {
      const isFuture = date > todayKey;
      const xp = xpByDay.get(date);
      const loadCount = loadCountByDay.get(date) ?? 0;
      const active = !isFuture && (loadCount > 0 || Boolean(xp));
      return {
        date,
        active,
        loadCount: isFuture ? 0 : loadCount,
        xpGranted: !isFuture && Boolean(xp),
        xpClaimed: !isFuture && Boolean(xp?.claimed),
        xpAmount: xp?.amount ?? (active && date === todayKey ? dailyXp : 0),
        isToday: date === todayKey,
        isFuture,
      };
    });

    const today = days.find((d) => d.isToday) ?? null;
    const pendingToday = Boolean(today && today.xpGranted && !today.xpClaimed);
    const activeDaysThisYear = days.filter((d) => d.active && !d.isFuture).length;

    return NextResponse.json({
      ok: true,
      timezone: STREAK_TIMEZONE,
      today: todayKey,
      year,
      yearStart: startKey,
      yearEnd: endKey,
      activeDaysThisYear,
      currentStreak,
      longestStreak,
      dailyXp,
      pendingToday,
      days,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[account/streak]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
