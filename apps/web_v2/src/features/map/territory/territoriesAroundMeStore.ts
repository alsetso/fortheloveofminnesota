'use client';

/**
 * Territories around me — global session store.
 * Persists like the Find Me blue dot: the layer stays on when the
 * Where I'm at card closes, until toggled off (card, Controls) or map reset.
 */

import { useSyncExternalStore } from 'react';
import type { TerritoryAtPointItem } from '@/lib/territory/territoryAtPointTypes';

export type TerritoriesAroundMeSnapshot = {
  on: boolean;
  /** Live position the current jurisdictions were resolved against. */
  coords: { lat: number; lng: number } | null;
  /** Saveable jurisdictions at the live position (home-eligible kinds). */
  jurisdictions: TerritoryAtPointItem[];
  loading: boolean;
  error: string | null;
};

const INITIAL: TerritoriesAroundMeSnapshot = {
  on: false,
  coords: null,
  jurisdictions: [],
  loading: false,
  error: null,
};

let snapshot: TerritoriesAroundMeSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getTerritoriesAroundMeSnapshot(): TerritoriesAroundMeSnapshot {
  return snapshot;
}

export function subscribeTerritoriesAroundMe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTerritoriesAroundMeOn(on: boolean): void {
  if (snapshot.on === on) return;
  snapshot = on ? { ...snapshot, on: true } : INITIAL;
  emit();
}

/** Controller-only: publish the latest live resolution while the layer is on. */
export function setTerritoriesAroundMeResult(
  next: Omit<TerritoriesAroundMeSnapshot, 'on'>,
): void {
  if (!snapshot.on) return;
  snapshot = { ...next, on: true };
  emit();
}

export function useTerritoriesAroundMe(): TerritoriesAroundMeSnapshot {
  return useSyncExternalStore(
    subscribeTerritoriesAroundMe,
    getTerritoriesAroundMeSnapshot,
    () => INITIAL,
  );
}
