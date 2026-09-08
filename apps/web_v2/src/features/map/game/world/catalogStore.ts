/** Runtime world model catalog — hydrated from /api/world/models. */

import {
  FALLBACK_WORLD_MODELS,
  type WorldModelSlug,
  type WorldModelSpec,
} from '@/features/map/game/world/catalog';

type Listener = () => void;

let models: WorldModelSpec[] = FALLBACK_WORLD_MODELS;
let bySlug = new Map(models.map((m) => [m.slug, m] as const));
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function index(next: WorldModelSpec[]) {
  models = next;
  bySlug = new Map(next.map((m) => [m.slug, m] as const));
  emit();
}

export function getWorldCatalog(): WorldModelSpec[] {
  return models;
}

export function getWorldCatalogSlugs(): WorldModelSlug[] {
  return models.map((m) => m.slug);
}

export function getWorldModel(slug: WorldModelSlug): WorldModelSpec | null {
  return bySlug.get(slug) ?? null;
}

export function subscribeWorldCatalog(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setWorldCatalog(next: WorldModelSpec[]): void {
  if (next.length === 0) return;
  index(next);
}

/**
 * Player-placeable catalog: active + GLB available + admin-confirmed player_placeable.
 * Used by the Drop Catalog toolbar, place mode cycling, and the place tool rail.
 */
export function getPlaceableWorldCatalog(): WorldModelSpec[] {
  return models.filter((m) => m.active && m.available && m.playerPlaceable === true);
}
