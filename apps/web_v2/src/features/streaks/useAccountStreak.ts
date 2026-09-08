'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { subscribeStandingInvalidation } from '@/lib/standing/invalidateStanding';
import {
  getPendingXpSnapshot,
  subscribePendingXp,
} from '@/features/xp/store/pendingXpStore';
import type { AccountStreakState, StreakDay } from '@/features/streaks/types';

export type { AccountStreakState, StreakDay };

const EMPTY_PENDING = { total: 0, count: 0 };

export function useAccountStreak(accountId: string | null | undefined) {
  const [streak, setStreak] = useState<AccountStreakState | null>(null);
  const [loading, setLoading] = useState(false);
  const pendingXp = useSyncExternalStore(
    subscribePendingXp,
    getPendingXpSnapshot,
    () => EMPTY_PENDING as ReturnType<typeof getPendingXpSnapshot>,
  );
  const lastPendingKey = useRef<string>('');

  const refresh = useCallback(() => {
    if (!accountId) {
      setStreak(null);
      return;
    }
    setLoading(true);
    void fetch('/api/account/streak', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!body?.ok) return;
        const days = Array.isArray(body.days) ? (body.days as StreakDay[]) : [];
        setStreak({
          timezone: String(body.timezone ?? 'America/Chicago'),
          today: String(body.today ?? ''),
          year: Number(body.year) || new Date().getFullYear(),
          yearStart: String(body.yearStart ?? ''),
          yearEnd: String(body.yearEnd ?? ''),
          activeDaysThisYear:
            Number(body.activeDaysThisYear)
            || days.filter((d) => d.active && !d.isFuture).length,
          currentStreak: Number(body.currentStreak) || 0,
          longestStreak: Number(body.longestStreak) || 0,
          dailyXp: Number(body.dailyXp) || 250,
          pendingToday: Boolean(body.pendingToday),
          days,
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!accountId) return;
    return subscribeStandingInvalidation(refresh);
  }, [accountId, refresh]);

  // Re-fetch when pending XP changes (daily streak grant or claim).
  useEffect(() => {
    if (!accountId) return;
    const key = `${pendingXp.count}:${pendingXp.total}`;
    if (lastPendingKey.current === key) return;
    const first = lastPendingKey.current === '';
    lastPendingKey.current = key;
    if (!first) refresh();
  }, [accountId, pendingXp.count, pendingXp.total, refresh]);

  return { streak, loading, refresh };
}
