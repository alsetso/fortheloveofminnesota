'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuthSafe } from '@/features/auth';

export type WalletTransactionType =
  | 'plan_grant'
  | 'admin_grant'
  | 'purchase'
  | 'spend'
  | 'refund'
  | 'adjustment'
  /** Map collectible payout (credit / chest → tool_credits). */
  | 'reward';

export type WalletTransaction = {
  id: string;
  /** Positive = credits in; negative = spend. */
  amount: number;
  type: WalletTransactionType;
  label: string;
  createdAt: string;
  product?: string | null;
  action?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  canOpenResult?: boolean;
};

export type WalletEarnedBreakdown = {
  /** Plan grants, purchases, admin grants. */
  platform: number;
  /** Map collectible payouts (coins / chests). */
  collected: number;
  total: number;
};

export type WalletSummary = {
  /** Null when the plan has unlimited tool credits. */
  balance: number | null;
  isUnlimited: boolean;
  monthlyGrant: number;
  usedThisMonth: number;
  planLabel: string;
  /** Human-readable next reset, e.g. "Aug 1". */
  resetsOn: string;
  /** Lifetime credits earned by source (before spends). */
  earned?: WalletEarnedBreakdown;
  transactions: WalletTransaction[];
};

type WalletStoreSnapshot = {
  accountId: string | null;
  summary: WalletSummary | null;
  loading: boolean;
  error: string | null;
};

const EMPTY: WalletStoreSnapshot = {
  accountId: null,
  summary: null,
  loading: false,
  error: null,
};

let snapshot: WalletStoreSnapshot = EMPTY;
const listeners = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setSnapshot(next: WalletStoreSnapshot) {
  snapshot = next;
  emit();
}

async function fetchWalletSummary(): Promise<WalletSummary> {
  const res = await fetch('/api/wallet/summary', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to load wallet summary');
  }
  return res.json() as Promise<WalletSummary>;
}

async function loadForAccount(accountId: string, force = false): Promise<void> {
  if (!force && snapshot.accountId === accountId && snapshot.summary && !snapshot.error) {
    return;
  }
  if (inFlight) {
    await inFlight;
    if (!force && snapshot.accountId === accountId && snapshot.summary) return;
  }

  setSnapshot({
    accountId,
    summary: snapshot.accountId === accountId ? snapshot.summary : null,
    loading: true,
    error: null,
  });

  inFlight = (async () => {
    try {
      const summary = await fetchWalletSummary();
      setSnapshot({ accountId, summary, loading: false, error: null });
    } catch (err) {
      setSnapshot({
        accountId,
        summary: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load wallet',
      });
    } finally {
      inFlight = null;
    }
  })();

  await inFlight;
}

function clearWallet() {
  setSnapshot(EMPTY);
}

/** Force a refetch of the currently-tracked account's summary (e.g. after a collect payout). */
export function invalidateWalletSummary(): void {
  if (!snapshot.accountId) return;
  void loadForAccount(snapshot.accountId, true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

/**
 * Tool-credits purse for the signed-in account.
 * Module store keeps header pill + Credits pane in sync without react-query.
 */
export function useWalletSummary(): {
  summary: WalletSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const state = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  useEffect(() => {
    if (!accountId) {
      clearWallet();
      return;
    }
    void loadForAccount(accountId);
  }, [accountId]);

  const refresh = useCallback(async () => {
    if (!accountId) {
      clearWallet();
      return;
    }
    await loadForAccount(accountId, true);
  }, [accountId]);

  const forAccount = state.accountId === accountId;
  return {
    summary: forAccount ? state.summary : null,
    loading: Boolean(accountId) && forAccount && state.loading && !state.summary,
    error: forAccount ? state.error : null,
    refresh,
  };
}

export function formatWalletBalance(summary: WalletSummary | null | undefined): string {
  if (!summary) return '—';
  if (summary.isUnlimited) return '∞';
  if (summary.balance == null) return '—';
  return String(summary.balance);
}
