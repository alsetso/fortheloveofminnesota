'use client';

/**
 * Singleton account-level store.
 *
 * All consumers share one network request and one cache — no per-instance
 * fetches regardless of how many components call useAccountLevel().
 * standing invalidation is subscribed once at the module level so a collect
 * or unlock triggers exactly one refetch, not N parallel ones.
 */

import { useSyncExternalStore, useEffect } from 'react';
import { subscribeStandingInvalidation } from '@/lib/standing/invalidateStanding';
import { primeLevelState } from '@/features/xp/store/levelUpStore';

export type LevelXpBreakdown = {
  sourceType: string;
  label: string;
  xp: number;
};

export type LevelXpActivity = {
  id: string;
  amount: number;
  sourceType: string;
  label: string;
  /** Human name for the source (territory name, "Collecting", etc.). */
  name?: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  claimedAt?: string | null;
};

export type AccountLevelState = {
  totalXp: number;
  /** Claimed XP in the trailing 24 hours. */
  xpLast24h: number;
  level: number;
  highestLevelReached: number;
  xpCeiling: number;
  xpCurveExponent: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressPct: number;
  breakdown: LevelXpBreakdown[];
  breakdownLast24h: LevelXpBreakdown[];
  recentActivity: LevelXpActivity[];
};

// ─── Module-level singleton ───────────────────────────────────────────────────

type Snapshot = { level: AccountLevelState | null; loading: boolean };

let _snap: Snapshot = { level: null, loading: false };
let _accountId: string | null = null;
let _inflight: AbortController | null = null;

const _listeners = new Set<() => void>();

function _emit(): void {
  for (const fn of _listeners) fn();
}

function _getSnapshot(): Snapshot {
  return _snap;
}

function _subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _normalize(json: AccountLevelState): AccountLevelState {
  return {
    ...json,
    xpLast24h: Number(json.xpLast24h) || 0,
    breakdown: Array.isArray(json.breakdown) ? json.breakdown : [],
    breakdownLast24h: Array.isArray(json.breakdownLast24h) ? json.breakdownLast24h : [],
    recentActivity: Array.isArray(json.recentActivity) ? json.recentActivity : [],
  };
}

async function _fetch(accountId: string): Promise<void> {
  _inflight?.abort();
  const controller = new AbortController();
  _inflight = controller;

  _snap = { ..._snap, loading: true };
  _emit();

  try {
    const res = await fetch('/api/account/level', {
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) {
      _snap = { ..._snap, loading: false };
      _emit();
      return;
    }
    const json = (await res.json()) as AccountLevelState;
    primeLevelState({
      level: json.highestLevelReached ?? json.level,
      totalXp: json.totalXp,
      xpCeiling: json.xpCeiling,
      xpCurveExponent: json.xpCurveExponent,
    });
    _snap = { level: _normalize(json), loading: false };
    _emit();
  } catch {
    if (controller.signal.aborted) return;
    _snap = { ..._snap, loading: false };
    _emit();
  }
}

// One global invalidation listener — fires a single refetch when XP events land.
subscribeStandingInvalidation(() => {
  if (_accountId) void _fetch(_accountId);
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAccountLevel(accountId: string | null | undefined): {
  level: AccountLevelState | null;
  loading: boolean;
  refresh: () => void;
} {
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);

  useEffect(() => {
    const id = accountId ?? null;

    if (!id) {
      if (_accountId !== null) {
        _accountId = null;
        _snap = { level: null, loading: false };
        _emit();
      }
      return;
    }

    // Already fetched or in-flight for this account — subscribers share the result.
    if (_accountId === id && (_snap.level !== null || _snap.loading)) return;

    _accountId = id;
    void _fetch(id);
  }, [accountId]);

  return {
    level: snap.level,
    loading: snap.loading,
    refresh: () => { if (_accountId) void _fetch(_accountId); },
  };
}
