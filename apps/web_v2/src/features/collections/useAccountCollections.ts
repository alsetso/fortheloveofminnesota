'use client';

/** Account collections: recent finds + per-model map progress (collected / total). */

import { useEffect, useState } from 'react';
import { subscribeStandingInvalidation } from '@/lib/standing/invalidateStanding';

export type CollectionsByModel = {
  slug: string;
  name: string;
  filePath: string;
  /** Rare finds appear here only after the account has claimed ≥1. */
  rare: boolean;
  /** Personal collection count for this model. */
  count: number;
  /** Visible collectible placements of this model on the map. */
  availableTotal: number;
  remaining: number;
  /** XP granted per collect from world_models.reward. */
  xp: number;
};

export type HeartsProgress = {
  collected: number;
  available: number;
  remaining: number;
};

/** Hearts scoped to cities & towns the account has unlocked. */
export type HeartsInUnlockedCtus = {
  /** Visible heart placements in unlocked CTUs (still on the map). */
  available: number;
  /** Hearts this account collected in those CTUs (incl. already-hidden). */
  collected: number;
  /** Visible hearts in unlocked CTUs not yet claimed — claimable without leaving. */
  remaining: number;
  /** Visible hearts outside unlocked CTUs — unlock new cities to reach. */
  remainingOutside: number;
  unlockedCtuCount: number;
};

export type RecentCollection = {
  id: string;
  placementId: string;
  reward: { type: string; amount?: number; key?: string; item?: string; xp?: number } | null;
  collectedAt: string;
  /** Claim type: collect | find | check_in | redeem. Defaults to 'collect' for legacy rows. */
  kind: string;
  model: { slug: string; name: string } | null;
};

export type CollectionsState = {
  total: number;
  /** Finds collected in the trailing 24 hours. */
  findsLast24h: number;
  /** Sum of visible collectible placements across models. */
  availableTotal: number;
  /** Heart placements collected vs on the map (statewide). */
  hearts: HeartsProgress;
  /** Hearts available / collected inside unlocked city & town territories. */
  heartsInUnlockedCtus: HeartsInUnlockedCtus;
  byModel: CollectionsByModel[];
  recent: RecentCollection[];
};

const EMPTY_HEARTS: HeartsProgress = { collected: 0, available: 0, remaining: 0 };
const EMPTY_HEARTS_IN_CTUS: HeartsInUnlockedCtus = {
  available: 0,
  collected: 0,
  remaining: 0,
  remainingOutside: 0,
  unlockedCtuCount: 0,
};

type HeartBumpListener = (amount: number) => void;
const heartBumpListeners = new Set<HeartBumpListener>();

/**
 * Optimistic +1 (or more) to hearts collected across live HUD / Today hooks.
 * Call after a successful heart collect; standing invalidation reconciles from API.
 */
export function bumpHeartsCollected(amount = 1): void {
  const n = Math.max(0, Math.floor(amount));
  if (n <= 0) return;
  for (const listener of heartBumpListeners) {
    try {
      listener(n);
    } catch {
      /* ignore */
    }
  }
}

function subscribeHeartsCollectedBump(listener: HeartBumpListener): () => void {
  heartBumpListeners.add(listener);
  return () => {
    heartBumpListeners.delete(listener);
  };
}

function normalize(json: CollectionsState): CollectionsState {
  const byModel = (Array.isArray(json.byModel) ? json.byModel : []).map((m) => ({
    ...m,
    rare: Boolean(m.rare),
    count: Number(m.count) || 0,
    availableTotal: Number(m.availableTotal) || 0,
    remaining:
      typeof m.remaining === 'number'
        ? m.remaining
        : Math.max(0, (Number(m.availableTotal) || 0) - (Number(m.count) || 0)),
    xp: Number(m.xp) || 0,
  }));
  const hearts = json.hearts ?? EMPTY_HEARTS;
  const heartsInUnlockedCtus = json.heartsInUnlockedCtus ?? EMPTY_HEARTS_IN_CTUS;
  return {
    total: Number(json.total) || 0,
    findsLast24h: Number(json.findsLast24h) || 0,
    availableTotal:
      Number(json.availableTotal) ||
      byModel.reduce((sum, m) => sum + m.availableTotal, 0),
    hearts: {
      collected: Number(hearts.collected) || 0,
      available: Number(hearts.available) || 0,
      remaining: Number(hearts.remaining) || 0,
    },
    heartsInUnlockedCtus: {
      available: Number(heartsInUnlockedCtus.available) || 0,
      collected: Number(heartsInUnlockedCtus.collected) || 0,
      remaining:
        typeof heartsInUnlockedCtus.remaining === 'number'
          ? Math.max(0, Number(heartsInUnlockedCtus.remaining) || 0)
          : // Older payloads: don't subtract collected (includes off-map claims).
            Math.max(0, Number(heartsInUnlockedCtus.available) || 0),
      remainingOutside: Math.max(0, Number(heartsInUnlockedCtus.remainingOutside) || 0),
      unlockedCtuCount: Number(heartsInUnlockedCtus.unlockedCtuCount) || 0,
    },
    byModel,
    recent: Array.isArray(json.recent)
      ? json.recent.map((r) => ({ ...r, kind: typeof r.kind === 'string' ? r.kind : 'collect' }))
      : [],
  };
}

export function useAccountCollections(accountId: string | null | undefined): {
  collections: CollectionsState | null;
  loading: boolean;
  refresh: () => void;
} {
  const [collections, setCollections] = useState<CollectionsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => subscribeStandingInvalidation(() => setNonce((n) => n + 1)), []);

  useEffect(
    () =>
      subscribeHeartsCollectedBump((amount) => {
        setCollections((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            total: prev.total + amount,
            findsLast24h: prev.findsLast24h + amount,
            hearts: {
              ...prev.hearts,
              collected: prev.hearts.collected + amount,
              remaining: Math.max(0, prev.hearts.remaining - amount),
            },
            heartsInUnlockedCtus: {
              ...prev.heartsInUnlockedCtus,
              collected: prev.heartsInUnlockedCtus.collected + amount,
              remaining: Math.max(0, prev.heartsInUnlockedCtus.remaining - amount),
            },
          };
        });
      }),
    [],
  );

  useEffect(() => {
    if (!accountId) {
      setCollections(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch('/api/account/collections', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) {
          // Settle to empty so UI doesn't pulse forever on error.
          setCollections((prev) => prev ?? normalize({} as CollectionsState));
          return;
        }
        const json = (await res.json()) as CollectionsState;
        setCollections(normalize(json));
      } catch (err) {
        if ((err as { name?: string } | null)?.name === 'AbortError') return;
        setCollections((prev) => prev ?? normalize({} as CollectionsState));
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accountId, nonce]);

  return { collections, loading, refresh: () => setNonce((n) => n + 1) };
}
