/**
 * What's nearby — session store (toggle + cached hits + selection).
 * Map visibility is driven by `on`; GeoJSON stays warm so re-toggle is instant.
 */

import { useSyncExternalStore } from 'react';
import type { NearbyPlaceHit } from '@/lib/geo/nearby/nearbyPlacesTypes';
import {
  clearNearbyPlacesOverlay,
  setNearbyPlacesOverlay,
} from '@/lib/geo/nearby/nearbyPlacesOverlayStore';

export type NearbyPlacesSnapshot = {
  on: boolean;
  /** Query point for the current `places` cache. */
  coords: { lat: number; lng: number } | null;
  places: NearbyPlaceHit[];
  loading: boolean;
  error: string | null;
  /** Place currently focused — drives map callout + listing card. */
  selectedPlaceId: string | null;
};

const INITIAL: NearbyPlacesSnapshot = {
  on: false,
  coords: null,
  places: [],
  loading: false,
  error: null,
  selectedPlaceId: null,
};

let snapshot: NearbyPlacesSnapshot = INITIAL;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function syncMapOverlay(): void {
  // Keep GeoJSON warm while this session has places; MapAppShell hides the
  // layer via `visible={nearby.on}` so toggle-off stays instant.
  if (snapshot.places.length === 0) {
    clearNearbyPlacesOverlay();
    return;
  }
  setNearbyPlacesOverlay(snapshot.places, snapshot.selectedPlaceId);
}

export function getNearbyPlacesSnapshot(): NearbyPlacesSnapshot {
  return snapshot;
}

export function subscribeNearbyPlaces(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setNearbyPlacesOn(on: boolean): void {
  if (snapshot.on === on) return;
  snapshot = on
    ? { ...snapshot, on: true }
    : { ...snapshot, on: false, selectedPlaceId: null };
  syncMapOverlay();
  emit();
}

/** Controller-only: publish fetch progress / results while the layer may be on. */
export function setNearbyPlacesResult(
  next: Omit<NearbyPlacesSnapshot, 'on' | 'selectedPlaceId'>,
): void {
  const stillValid =
    snapshot.selectedPlaceId != null &&
    next.places.some((p) => p.id === snapshot.selectedPlaceId);
  snapshot = {
    ...next,
    on: snapshot.on,
    selectedPlaceId: stillValid ? snapshot.selectedPlaceId : null,
  };
  syncMapOverlay();
  emit();
}

export function getNearbyPlaceById(id: string): NearbyPlaceHit | null {
  return snapshot.places.find((p) => p.id === id) ?? null;
}

/** Focus a place — drives the map callout + listing dock card. `null` clears. */
export function selectNearbyPlace(place: NearbyPlaceHit | null): void {
  const nextId = place?.id ?? null;
  if (snapshot.selectedPlaceId === nextId) return;
  snapshot = { ...snapshot, selectedPlaceId: nextId };
  syncMapOverlay();
  emit();
}

export function clearNearbyPlacesSession(): void {
  snapshot = INITIAL;
  clearNearbyPlacesOverlay();
  emit();
}

export function useNearbyPlaces(): NearbyPlacesSnapshot {
  return useSyncExternalStore(
    subscribeNearbyPlaces,
    getNearbyPlacesSnapshot,
    () => INITIAL,
  );
}
