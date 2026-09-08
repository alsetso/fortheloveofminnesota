'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuthSafe } from '@/features/auth';

export type HomeStackJurisdiction = {
  id: string;
  kind: string;
  name: string;
  kindLabel?: string;
};

export type HomeStatus = {
  homeSetAt: string | null;
  homeResetAvailableAt: string | null;
  canReset: boolean;
  unitIds: string[];
  /** Snapshotted jurisdictions from the confirmed home stack. */
  jurisdictions: HomeStackJurisdiction[];
};

export function formatHomeResetDate(iso: string | null | undefined): string {
  if (!iso) return 'soon';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'soon';
  }
}

type HomeSnap = {
  status: HomeStatus | null;
  loading: boolean;
  accountId: string | null;
};

let _snap: HomeSnap = { status: null, loading: false, accountId: null };
let _loadPromise: Promise<void> | null = null;
const _listeners = new Set<() => void>();

function _emit(): void {
  for (const fn of _listeners) fn();
}

function _getSnapshot(): HomeSnap {
  return _snap;
}

function _subscribe(fn: () => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

async function _fetchHome(accountId: string): Promise<void> {
  _snap = { ..._snap, loading: true, accountId };
  _emit();
  try {
    const res = await fetch('/api/account-territories/home', {
      credentials: 'include',
    });
    if (!res.ok) {
      _snap = { ..._snap, loading: false };
      _emit();
      return;
    }
    const status = (await res.json()) as HomeStatus;
    // Ignore stale responses after account switch / sign-out.
    if (_snap.accountId !== accountId) return;
    _snap = { status, loading: false, accountId };
    _emit();
  } catch {
    if (_snap.accountId !== accountId) return;
    _snap = { ..._snap, loading: false };
    _emit();
  }
}

function ensureHomeStatus(accountId: string | null | undefined): void {
  if (!accountId) {
    if (_snap.status != null || _snap.accountId != null) {
      _snap = { status: null, loading: false, accountId: null };
      _loadPromise = null;
      _emit();
    }
    return;
  }
  if (_snap.accountId === accountId && (_snap.status != null || _loadPromise)) {
    return;
  }
  if (_loadPromise && _snap.accountId === accountId) return;
  _loadPromise = _fetchHome(accountId).finally(() => {
    _loadPromise = null;
  });
}

/** Account home-base status — drives the 30-day set/reset gate. Shared singleton. */
export function useHomeStatus(): {
  status: HomeStatus | null;
  reload: () => Promise<void>;
} {
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);

  useEffect(() => {
    ensureHomeStatus(accountId);
  }, [accountId]);

  const reload = useCallback(async () => {
    if (!accountId) {
      ensureHomeStatus(null);
      return;
    }
    const p = _fetchHome(accountId);
    _loadPromise = p.finally(() => {
      _loadPromise = null;
    });
    await p;
  }, [accountId]);

  return {
    status: snap.accountId === accountId ? snap.status : null,
    reload,
  };
}
