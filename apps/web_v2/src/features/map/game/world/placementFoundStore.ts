/** Open state for the “you found …” placement modal. */

import type { WorldModelSlug } from '@/features/map/game/world/catalog';

export type WorldPlacementFoundState = {
  kind: WorldModelSlug;
  featureId: string | number;
} | null;

type Listener = () => void;

let state: WorldPlacementFoundState = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function getWorldPlacementFoundState(): WorldPlacementFoundState {
  return state;
}

export function subscribeWorldPlacementFound(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openWorldPlacementFound(
  kind: WorldModelSlug,
  featureId: string | number,
): void {
  state = { kind, featureId };
  emit();
}

export function closeWorldPlacementFound(): void {
  if (state == null) return;
  state = null;
  emit();
}
