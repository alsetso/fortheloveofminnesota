'use client';

import type { FeatureCollection, Point } from 'geojson';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';

export type SavedAddressPin = {
  id: string;
  label: string;
  tag: string | null;
  lat: number;
  lng: number;
};

const EMPTY: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

let pins: SavedAddressPin[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Postgres / JSON may return numeric coords as strings. */
function toCoord(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toFeatureCollection(rows: SavedAddressPin[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: rows.map((row) => ({
      type: 'Feature',
      id: row.id,
      properties: {
        id: row.id,
        label: row.label,
        tag: row.tag,
        lat: row.lat,
        lng: row.lng,
      },
      geometry: {
        type: 'Point',
        coordinates: [row.lng, row.lat],
      },
    })),
  };
}

function pushToMap() {
  mapDataStore.set(MAP_SOURCE_IDS.savedAddresses, toFeatureCollection(pins));
}

export function getSavedAddressPins(): SavedAddressPin[] {
  return pins;
}

export function subscribeSavedAddressPins(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSavedAddressPins(next: SavedAddressPin[]): void {
  pins = next;
  pushToMap();
  emit();
}

export async function refreshSavedAddressPins(
  signal?: AbortSignal,
): Promise<SavedAddressPin[]> {
  try {
    const res = await fetch('/api/contacts?kind=addresses', {
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
    if (!res.ok) {
      setSavedAddressPins([]);
      return [];
    }
    const json = (await res.json()) as {
      addresses?: Array<{
        id: string;
        label: string | null;
        tag: string | null;
        lat: unknown;
        lng: unknown;
      }>;
    };
    const next: SavedAddressPin[] = [];
    for (const a of json.addresses ?? []) {
      if (!a.id) continue;
      const lat = toCoord(a.lat);
      const lng = toCoord(a.lng);
      if (lat == null || lng == null) continue;
      next.push({
        id: a.id,
        label: (a.label ?? 'Saved address').trim() || 'Saved address',
        tag: a.tag?.trim() || null,
        lat,
        lng,
      });
    }
    setSavedAddressPins(next);
    return next;
  } catch {
    if (signal?.aborted) return pins;
    setSavedAddressPins([]);
    return [];
  }
}

export function clearSavedAddressPins(): void {
  pins = [];
  mapDataStore.set(MAP_SOURCE_IDS.savedAddresses, EMPTY);
  emit();
}

/** Instant pin removal after unsave — avoids waiting on a full refresh. */
export function removeSavedAddressPin(id: string): void {
  const next = pins.filter((p) => p.id !== id);
  if (next.length === pins.length) return;
  pins = next;
  pushToMap();
  emit();
}

/** Instant tag/label update on the pin after PATCH. */
export function updateSavedAddressPin(
  id: string,
  patch: Partial<Pick<SavedAddressPin, 'label' | 'tag'>>,
): void {
  let changed = false;
  const next = pins.map((p) => {
    if (p.id !== id) return p;
    changed = true;
    return {
      ...p,
      ...(patch.label !== undefined ? { label: patch.label } : null),
      ...(patch.tag !== undefined ? { tag: patch.tag } : null),
    };
  });
  if (!changed) return;
  pins = next;
  pushToMap();
  emit();
}
