/**
 * Rail place tool mode — off or a catalog slug.
 * When active, empty-ground clicks place that 3D model.
 */

import { getPlaceableWorldCatalog } from '@/features/map/game/world/catalogStore';
import type { WorldModelSlug } from '@/features/map/game/world/catalog';

export type WorldPlaceMode = 'off' | WorldModelSlug;

type Listener = () => void;

let mode: WorldPlaceMode = 'off';
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function cycleList(): WorldPlaceMode[] {
  return ['off', ...getPlaceableWorldCatalog().map((m) => m.slug)];
}

export function getWorldPlaceMode(): WorldPlaceMode {
  return mode;
}

export function isWorldPlaceModeActive(): boolean {
  return mode !== 'off';
}

export function subscribeWorldPlaceMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setWorldPlaceMode(next: WorldPlaceMode): void {
  if (mode === next) return;
  mode = next;
  emit();
}

export function cycleWorldPlaceMode(): WorldPlaceMode {
  const cycle = cycleList();
  const i = cycle.indexOf(mode);
  mode = cycle[(i < 0 ? 0 : i + 1) % cycle.length]!;
  emit();
  return mode;
}

export function peekNextWorldPlaceMode(
  current: WorldPlaceMode = mode,
): WorldPlaceMode {
  const cycle = cycleList();
  const i = cycle.indexOf(current);
  return cycle[(i < 0 ? 0 : i + 1) % cycle.length]!;
}
