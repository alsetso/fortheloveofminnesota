/**
 * Selected map / search point — independent from Find Me GPS coords.
 * Map click + universal search place hits write; Selected point pane reads.
 */

import type { UserCoords } from '@/map/location/device/geolocation';

export type SelectedPointCoordsSnapshot = {
  coords: UserCoords | null;
};

type Listener = () => void;

let coords: UserCoords | null = null;
let snapshot: SelectedPointCoordsSnapshot = { coords: null };
const listeners = new Set<Listener>();

function emit() {
  snapshot = { coords };
  for (const listener of listeners) listener();
}

export function getSelectedPointCoordsSnapshot(): SelectedPointCoordsSnapshot {
  return snapshot;
}

export function subscribeSelectedPointCoords(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSelectedPointCoords(next: UserCoords | null): void {
  if (next == null && coords == null) return;
  if (next && coords && next.lat === coords.lat && next.lng === coords.lng) return;
  coords = next;
  emit();
}

export function clearSelectedPointCoords(): void {
  if (coords == null) return;
  coords = null;
  emit();
}
