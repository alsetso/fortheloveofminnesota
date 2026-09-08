'use client';

/** Passport progress: unlocked-vs-total per jurisdiction kind + level state. */

import { useEffect, useState } from 'react';
import { subscribeStandingInvalidation } from '@/lib/standing/invalidateStanding';
import { primeLevelState } from '@/features/xp/store/levelUpStore';

export type PassportKindProgress = {
  unitKind: string;
  label: string;
  unlocked: number;
  total: number;
};

export type PassportUnlock = {
  unitKind: string;
  unitId: string;
  name: string;
  firstSeenAt: string;
  /** Real per-unlock XP amount from the ledger (falls back to the current rate). */
  xpAmount: number;
};

export type PassportState = {
  kinds: PassportKindProgress[];
  unlocked: PassportUnlock[];
  recentlyUnlocked: PassportUnlock[];
  unlockedTotal: number;
  level: { totalXp: number; level: number };
  xpCeiling?: number;
  xpCurveExponent?: number;
};

export function usePassport(accountId: string | null | undefined): {
  passport: PassportState | null;
  loading: boolean;
  refresh: () => void;
} {
  const [passport, setPassport] = useState<PassportState | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => subscribeStandingInvalidation(() => setNonce((n) => n + 1)), []);

  useEffect(() => {
    if (!accountId) {
      setPassport(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/account/passport', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as PassportState;
        setPassport({
          ...body,
          unlocked: Array.isArray(body.unlocked) ? body.unlocked : [],
          recentlyUnlocked: Array.isArray(body.recentlyUnlocked) ? body.recentlyUnlocked : [],
          unlockedTotal:
            typeof body.unlockedTotal === 'number'
              ? body.unlockedTotal
              : Array.isArray(body.unlocked)
                ? body.unlocked.length
                : 0,
        });
        primeLevelState({
          level: body.level.level,
          totalXp: body.level.totalXp,
          xpCeiling: body.xpCeiling,
          xpCurveExponent: body.xpCurveExponent,
        });
      } catch {
        // keep prior state
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accountId, nonce]);

  return { passport, loading, refresh: () => setNonce((n) => n + 1) };
}
