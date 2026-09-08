/** Load world.element_types via /api/world/element-types. */

import { setElementTypes } from '@/features/map/game/world/elementTypesStore';
import type { ElementType } from '@/features/map/game/world/elementTypes';

// Load-once promise guard: element types change rarely. Storing the promise
// means all subsequent calls (e.g. on every style.load re-trigger in WorldModelsLayer)
// return the already-resolved promise without firing a second request.
let _loadPromise: Promise<number> | null = null;

async function _doFetch(): Promise<number> {
  try {
    const res = await fetch('/api/world/element-types');
    if (!res.ok) {
      console.error('loadElementTypes', res.status);
      return 0;
    }
    const json = (await res.json()) as { types?: ElementType[] };
    const list = (json.types ?? []).filter(
      (t) => t && typeof t.slug === 'string' && typeof t.color === 'string',
    );
    if (list.length > 0) setElementTypes(list);
    return list.length;
  } catch (err) {
    console.error('loadElementTypes', err);
    return 0;
  }
}

/**
 * Fetches and caches element types.
 *
 * The first call fires the network request and stores the promise. All
 * subsequent calls return the same promise — guaranteed single network hit
 * per session.
 *
 * Pass `force = true` to bypass the guard (e.g. after admin color changes).
 */
export function loadElementTypes(force = false): Promise<number> {
  if (!force && _loadPromise) return _loadPromise;
  _loadPromise = _doFetch();
  return _loadPromise;
}
