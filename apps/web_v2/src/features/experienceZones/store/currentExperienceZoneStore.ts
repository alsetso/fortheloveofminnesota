'use client';

/**
 * Live experience zone(s) at the user's current location.
 * Kept fresh by CurrentExperienceZoneController on the Find Me grid.
 *
 * `primaryZone` — parent zone (or sole zone). Drives all data/control.
 * `subZone`     — the specific nested zone the user is standing in, if any.
 *                 Used only as a positional badge and inner boundary ring.
 */

import { useSyncExternalStore } from 'react';
import type { ExperienceZoneAtPointItem } from '@/lib/experienceZones/experienceZoneTypes';
import { resolveZoneHierarchy } from '@/lib/experienceZones/experienceZoneTypes';

export type CurrentExperienceZoneSnapshot = {
  coords: { lat: number; lng: number } | null;
  zones: ExperienceZoneAtPointItem[];
  /** Fingerprint of the last resolved zone set (id sorted). */
  zoneKey: string | null;
  /**
   * The parent/primary zone — drives placement stream, camera lock, and
   * banner headline. Never the sub-zone when an explicit parent_zone_id exists.
   */
  primaryZone: ExperienceZoneAtPointItem | null;
  /**
   * The specific sub-zone the user is physically inside, if any.
   * Used for the inner boundary ring and positional badge only.
   */
  subZone: ExperienceZoneAtPointItem | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  ready: boolean;
};

const INITIAL: CurrentExperienceZoneSnapshot = {
  coords: null,
  zones: [],
  zoneKey: null,
  primaryZone: null,
  subZone: null,
  loading: false,
  error: null,
  updatedAt: null,
  ready: false,
};

let snapshot: CurrentExperienceZoneSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getCurrentExperienceZoneSnapshot(): CurrentExperienceZoneSnapshot {
  return snapshot;
}

export function subscribeCurrentExperienceZone(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function zoneKeyFromZones(zones: ExperienceZoneAtPointItem[]): string {
  return zones
    .map((z) => z.id)
    .sort()
    .join('|');
}

export function setCurrentExperienceZoneLoading(loading: boolean): void {
  if (snapshot.loading === loading) return;
  snapshot = { ...snapshot, loading };
  emit();
}

export function setCurrentExperienceZoneResult(next: {
  coords: { lat: number; lng: number };
  zones: ExperienceZoneAtPointItem[];
  error?: string | null;
}): void {
  const zoneKey = zoneKeyFromZones(next.zones);
  const hierarchy = resolveZoneHierarchy(next.zones);
  snapshot = {
    coords: next.coords,
    zones: next.zones,
    zoneKey,
    primaryZone: hierarchy?.primaryZone ?? null,
    subZone: hierarchy?.subZone ?? null,
    loading: false,
    error: next.error ?? null,
    updatedAt: Date.now(),
    ready: true,
  };
  emit();
}

export function useCurrentExperienceZone(): CurrentExperienceZoneSnapshot {
  return useSyncExternalStore(
    subscribeCurrentExperienceZone,
    getCurrentExperienceZoneSnapshot,
    getCurrentExperienceZoneSnapshot,
  );
}
