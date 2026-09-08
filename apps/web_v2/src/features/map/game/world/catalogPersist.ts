/** Load world.world_models via /api/world/models. */

import { setWorldCatalog } from '@/features/map/game/world/catalogStore';
import type { WorldModelSpec } from '@/features/map/game/world/catalog';

function normalizeModel(row: WorldModelSpec): WorldModelSpec {
  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
  };
}

// Load-once promise guard: the catalog is static for the session. Storing the
// promise means subsequent calls (e.g. on every style.load re-trigger) never
// fire a second request — they all await the same already-resolved promise.
let _loadPromise: Promise<number> | null = null;

async function _doFetch(): Promise<number> {
  try {
    const res = await fetch('/api/world/models');
    if (!res.ok) {
      console.error('loadWorldCatalog', res.status);
      return 0;
    }
    const json = (await res.json()) as { models?: WorldModelSpec[] };
    const list = (json.models ?? []).map(normalizeModel);
    if (list.length > 0) setWorldCatalog(list);
    return list.length;
  } catch (err) {
    console.error('loadWorldCatalog', err);
    return 0;
  }
}

/**
 * Fetches and caches the world model catalog.
 *
 * The first call fires the network request and stores the promise. All
 * subsequent calls (e.g. on Mapbox style.load) return the same promise —
 * guaranteed single network hit per session.
 *
 * Pass `force = true` to bypass the guard (e.g. after admin catalog changes).
 */
export function loadWorldCatalog(force = false): Promise<number> {
  if (!force && _loadPromise) return _loadPromise;
  _loadPromise = _doFetch();
  return _loadPromise;
}
