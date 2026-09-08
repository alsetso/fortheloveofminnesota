'use client';

/**
 * Nearby (approaching) primary experience zones — not yet covering Find Me.
 */

import { useSyncExternalStore } from 'react';
import type { ExperienceZoneNearItem } from '@/lib/experienceZones/experienceZoneTypes';

export type NearbyExperienceZoneSnapshot = {
  coords: { lat: number; lng: number } | null;
  zones: ExperienceZoneNearItem[];
  /** Closest approaching zone, if any. */
  nearest: ExperienceZoneNearItem | null;
  zoneKey: string | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
};

const INITIAL: NearbyExperienceZoneSnapshot = {
  coords: null,
  zones: [],
  nearest: null,
  zoneKey: null,
  loading: false,
  error: null,
  updatedAt: null,
};

let snapshot: NearbyExperienceZoneSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getNearbyExperienceZoneSnapshot(): NearbyExperienceZoneSnapshot {
  return snapshot;
}

export function subscribeNearbyExperienceZone(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function nearbyZoneKeyFromZones(zones: ExperienceZoneNearItem[]): string {
  return zones
    .map((z) => z.id)
    .sort()
    .join('|');
}

export function setNearbyExperienceZoneLoading(loading: boolean): void {
  if (snapshot.loading === loading) return;
  snapshot = { ...snapshot, loading };
  emit();
}

export function setNearbyExperienceZoneResult(next: {
  coords: { lat: number; lng: number };
  zones: ExperienceZoneNearItem[];
  error?: string | null;
}): void {
  const zones = [...next.zones].sort((a, b) => a.distance_m - b.distance_m);
  snapshot = {
    coords: next.coords,
    zones,
    nearest: zones[0] ?? null,
    zoneKey: nearbyZoneKeyFromZones(zones),
    loading: false,
    error: next.error ?? null,
    updatedAt: Date.now(),
  };
  emit();
}

export function clearNearbyExperienceZones(): void {
  if (snapshot.zones.length === 0 && !snapshot.nearest) return;
  snapshot = {
    ...INITIAL,
    updatedAt: Date.now(),
  };
  emit();
}

export function useNearbyExperienceZone(): NearbyExperienceZoneSnapshot {
  return useSyncExternalStore(
    subscribeNearbyExperienceZone,
    getNearbyExperienceZoneSnapshot,
    getNearbyExperienceZoneSnapshot,
  );
}
