/**
 * Global "unclaimed XP" rollup — the single source of truth behind both the
 * contextual territory-claim modal and the persistent XP overlay button.
 * Territory-unlock XP is written unclaimed by report_territory_presence();
 * this store fetches /api/account/xp/unclaimed and lets any surface trigger
 * a refresh (unlock detected, tab focus, standing invalidated) without
 * duplicating fetch logic.
 */

import { invalidateStanding } from '@/lib/standing/invalidateStanding';
import { prepareLevelUpFromGrant } from '@/features/xp/store/levelUpStore';

export type PendingXpItem = {
  id: string;
  amount: number;
  sourceType: string;
  sourceLabel: string;
  referenceType: string | null;
  referenceId: string | null;
  name: string;
  createdAt: string;
};

export type PendingXpState = {
  total: number;
  count: number;
  items: PendingXpItem[];
  loading: boolean;
};

type Listener = () => void;

let state: PendingXpState = { total: 0, count: 0, items: [], loading: false };
const listeners = new Set<Listener>();
let inflight: Promise<void> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: Partial<PendingXpState>) {
  state = { ...state, ...next };
  emit();
}

export function subscribePendingXp(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingXpSnapshot(): PendingXpState {
  return state;
}

/** Fetches the current unclaimed rollup. Safe to call redundantly — callers
 * racing to refresh (unlock + focus + standing invalidation) share one request. */
export function refreshPendingXp(): Promise<void> {
  if (inflight) return inflight;
  setState({ loading: true });
  inflight = fetch('/api/account/xp/unclaimed', { credentials: 'include' })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: { total?: number; count?: number; items?: PendingXpItem[] } | null) => {
      if (!body) return;
      setState({
        total: body.total ?? 0,
        count: body.count ?? 0,
        items: Array.isArray(body.items) ? body.items : [],
      });
    })
    .catch(() => undefined)
    .finally(() => {
      setState({ loading: false });
      inflight = null;
    });
  return inflight;
}

/** Optimistically clears the rollup right after a successful claim, ahead of
 * the next refresh — keeps the overlay from flashing stale totals. */
export function clearPendingXp(): void {
  setState({ total: 0, count: 0, items: [] });
}

export type ClaimXpResult = {
  claimedCount: number;
  claimedAmount: number;
  totalXp: number;
  level: number;
  highestLevelReached: number;
  /** True when this claim crossed a level — success UI should release the sequence on dismiss. */
  levelUpPrepared: boolean;
};

/** Claims every pending XP transaction for the account. Used by both the
 * contextual unlock modal and the global overlay's "Claim all" button so the
 * two surfaces can never disagree about what's owed.
 * If the claimed XP pushes over a level, prepares (holds) the global
 * LevelUpSequence — caller shows Claimed! first, then releaseLevelUpSequence(). */
export async function claimAllXp(): Promise<ClaimXpResult | null> {
  try {
    const res = await fetch('/api/account/xp/claim', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Omit<ClaimXpResult, 'levelUpPrepared'> & { ok?: boolean };
    clearPendingXp();
    invalidateStanding();
    const prepared = prepareLevelUpFromGrant({
      level: body.highestLevelReached,
      totalXp: body.totalXp,
      xpGained: body.claimedAmount,
      source: 'claim',
    });
    return { ...body, levelUpPrepared: prepared.prepared };
  } catch {
    return null;
  }
}
