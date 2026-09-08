/**
 * Cached point-at-location lookup — shared by Selected point pane + dock pill title.
 */

import type { TerritoryAtPointItem } from '@/lib/territory/territoryAtPointTypes';

export type PointAtLocationCacheEntry = {
  key: string;
  address: string | null;
  jurisdictions: TerritoryAtPointItem[];
  error: string | null;
};

type Listener = () => void;

let entry: PointAtLocationCacheEntry | null = null;
let snapshot: PointAtLocationCacheEntry | null = null;
const listeners = new Set<Listener>();

function emit() {
  snapshot = entry;
  for (const listener of listeners) listener();
}

export function pointAtLocationCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function getPointAtLocationCache(key: string): PointAtLocationCacheEntry | null {
  if (!entry || entry.key !== key) return null;
  return entry;
}

export function getPointAtLocationCacheSnapshot(): PointAtLocationCacheEntry | null {
  return snapshot;
}

export function subscribePointAtLocationCache(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPointAtLocationCache(next: PointAtLocationCacheEntry): void {
  entry = next;
  emit();
}

export function clearPointAtLocationCache(): void {
  if (entry == null && snapshot == null) return;
  entry = null;
  emit();
}

