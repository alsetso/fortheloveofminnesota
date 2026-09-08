/**
 * Queue of territory-unlock celebrations — fed by presence sync (splash + live).
 * Bundles multi-jurisdiction unlocks into one modal with total XP collected.
 */

import { isPrimaryTerritoryKind } from '@/features/accountTerritories/store/constants';

export type UnlockedTerritoryItem = {
  unitKind: string;
  unitId: string;
  name: string;
  /** Real per-unit XP for this unlock (kind-aware, from public.territory_unlock_xp). */
  xpAmount: number;
};

export type TerritoryUnlockEvent = {
  id: string;
  territories: UnlockedTerritoryItem[];
  /** XP granted for this unlock batch (sum of each territory's real xpAmount). */
  xpCollected: number;
  /** True when every territory in this batch carries the same XP amount. */
  uniformXp: boolean;
};

type Listener = () => void;

/** Defensive fallback only — real amounts always come from the server. */
export const TERRITORY_UNLOCK_XP_FALLBACK = 10;

const queue: TerritoryUnlockEvent[] = [];
const listeners = new Set<Listener>();
let seq = 0;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTerritoryUnlockQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTerritoryUnlockQueueSnapshot(): TerritoryUnlockEvent[] {
  return queue;
}

/** Enqueue a passport unlock celebration (no-op if empty / non-primary kinds). */
export function enqueueTerritoryUnlocks(territories: UnlockedTerritoryItem[]): void {
  const visible = territories.filter((t) => isPrimaryTerritoryKind(t.unitKind));
  if (!visible.length) return;
  seq += 1;
  const amounts = visible.map((t) => t.xpAmount ?? TERRITORY_UNLOCK_XP_FALLBACK);
  queue.push({
    id: `unlock-${seq}-${Date.now()}`,
    territories: visible,
    xpCollected: amounts.reduce((sum, a) => sum + a, 0),
    uniformXp: amounts.every((a) => a === amounts[0]),
  });
  emit();
}

export function dequeueTerritoryUnlock(): TerritoryUnlockEvent | null {
  const next = queue.shift() ?? null;
  if (next) emit();
  return next;
}
