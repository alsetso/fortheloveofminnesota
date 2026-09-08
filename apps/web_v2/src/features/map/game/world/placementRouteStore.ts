/** Open state for the out-of-range “Route to this object” modal. */

import type { WorldModelSlug } from '@/features/map/game/world/catalog';

export type WorldPlacementRouteState = {
  kind: WorldModelSlug;
  featureId: string | number;
  lat: number;
  lng: number;
  /** Crow-flies meters from player; null when location unknown. */
  distanceM: number | null;
  /** Active Object Radar range when the modal opened. */
  rangeM: number;
} | null;

type Listener = () => void;

let state: WorldPlacementRouteState = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getWorldPlacementRouteState(): WorldPlacementRouteState {
  return state;
}

export function subscribeWorldPlacementRoute(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openWorldPlacementRoute(
  next: NonNullable<WorldPlacementRouteState>,
): void {
  state = next;
  emit();
}

export function closeWorldPlacementRoute(): void {
  if (state == null) return;
  state = null;
  emit();
}
