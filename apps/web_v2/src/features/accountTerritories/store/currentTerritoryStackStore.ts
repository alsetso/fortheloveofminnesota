'use client';

/**
 * Live territory stack at the user's current location.
 * Seeded during splash boot; kept fresh while Find Me / location watch runs.
 */

import { useSyncExternalStore } from 'react';
import type { TerritoryAtPointItem } from '@/lib/territory/territoryAtPointTypes';

export type CurrentTerritoryStackSnapshot = {
  coords: { lat: number; lng: number } | null;
  jurisdictions: TerritoryAtPointItem[];
  /** Fingerprint of the last resolved stack (kind:id sorted). */
  stackKey: string | null;
  loading: boolean;
  error: string | null;
  /** Last successful resolve / presence post (ms). */
  updatedAt: number | null;
  /** True once splash (or first sync) has finished an attempt. */
  ready: boolean;
};

const INITIAL: CurrentTerritoryStackSnapshot = {
  coords: null,
  jurisdictions: [],
  stackKey: null,
  loading: false,
  error: null,
  updatedAt: null,
  ready: false,
};

let snapshot: CurrentTerritoryStackSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getCurrentTerritoryStackSnapshot(): CurrentTerritoryStackSnapshot {
  return snapshot;
}

export function subscribeCurrentTerritoryStack(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function stackKeyFromJurisdictions(items: TerritoryAtPointItem[]): string {
  return items
    .map((j) => `${j.kind}:${j.id}`)
    .sort()
    .join('|');
}

export function setCurrentTerritoryStackLoading(loading: boolean): void {
  if (snapshot.loading === loading) return;
  snapshot = { ...snapshot, loading };
  emit();
}

export function setCurrentTerritoryStackResult(next: {
  coords: { lat: number; lng: number };
  jurisdictions: TerritoryAtPointItem[];
  error?: string | null;
}): void {
  const stackKey = stackKeyFromJurisdictions(next.jurisdictions);
  snapshot = {
    coords: next.coords,
    jurisdictions: next.jurisdictions,
    stackKey,
    loading: false,
    error: next.error ?? null,
    updatedAt: Date.now(),
    ready: true,
  };
  emit();
}

export function markCurrentTerritoryStackReady(error?: string | null): void {
  snapshot = {
    ...snapshot,
    loading: false,
    error: error ?? snapshot.error,
    ready: true,
    updatedAt: snapshot.updatedAt ?? Date.now(),
  };
  emit();
}

export function clearCurrentTerritoryStack(): void {
  snapshot = INITIAL;
  emit();
}

export function useCurrentTerritoryStack(): CurrentTerritoryStackSnapshot {
  return useSyncExternalStore(
    subscribeCurrentTerritoryStack,
    getCurrentTerritoryStackSnapshot,
    () => INITIAL,
  );
}
