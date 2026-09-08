/**
 * Local avatar cache — two-layer persistence for the player's 3D avatar.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Layer 1 — localStorage (sync)                                          │
 * │    Stores avatar metadata (slug, URL, name, modelId).                   │
 * │    Read on every boot to seed avatarStore before /api/avatar/me         │
 * │    returns — eliminates the male-base-model fallback flash on repeat    │
 * │    sessions.                                                             │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  Layer 2 — Cache API (async)                                            │
 * │    Stores the raw GLB binary under the 'ftlomn-avatar-v1' cache.        │
 * │    Primed on Find Me tap + boot prefetch. Survives HTTP-cache eviction  │
 * │    and gives true offline resilience. Served back via a per-session     │
 * │    blob URL that Mapbox addModel() consumes directly — zero network     │
 * │    round-trip after first load.                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Key invariant: modelUrl stored in localStorage is always the original
 * network URL (never a blob URL), so it can be re-fetched after a page
 * reload. Blob URLs are per-session only and live in blobUrlRegistry.
 */

const META_KEY = 'ftlomn.avatar.meta';
const GLB_CACHE_NAME = 'ftlomn-avatar-v1';

export type AvatarCacheMeta = {
  modelId: string;
  modelUrl: string;
  modelSlug: string;
  modelName: string;
};

// ─── Layer 1: metadata ───────────────────────────────────────────────────────

/** Synchronously read cached avatar metadata. Returns null if missing or malformed. */
export function readAvatarCacheMeta(): AvatarCacheMeta | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AvatarCacheMeta>;
    if (!p.modelId || !p.modelUrl || !p.modelSlug || !p.modelName) return null;
    return p as AvatarCacheMeta;
  } catch {
    return null;
  }
}

/** Persist avatar metadata so the next boot can skip the API round-trip. */
export function writeAvatarCacheMeta(entry: AvatarCacheMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(entry));
  } catch {
    /* storage quota — non-fatal */
  }
}

/** Remove cached metadata (call on avatar switch or sign-out). */
export function clearAvatarCacheMeta(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {}
}

// ─── Layer 2: GLB binary ─────────────────────────────────────────────────────

/**
 * Per-session registry of network URL → object URL.
 * Blob URLs are created once and reused; never serialised.
 */
const blobUrlRegistry = new Map<string, string>();

/**
 * In-flight prime promises — prevents duplicate fetches when Find Me is
 * tapped rapidly or prefetchPlayerAvatar() and onLocate both fire at once.
 */
const primeInFlight = new Map<string, Promise<void>>();

/**
 * Synchronously return the resolved blob URL for a model (from this session's
 * registry), or the original network URL as a passthrough.
 *
 * Safe to call inside getPlayerAvatarModelUrl() — never async, never throws.
 */
export function getAvatarBlobUrlSync(modelUrl: string): string {
  return blobUrlRegistry.get(modelUrl) ?? modelUrl;
}

/**
 * Fetch the GLB into the Cache API (if not already stored) and register
 * a blob URL in the in-memory registry so Mapbox addModel() can load it
 * without touching the network.
 *
 * Idempotent — returns the same promise if already in flight, returns
 * immediately if the blob URL for this URL is already registered.
 *
 * Fails silently: private-mode browsers may restrict caches; network errors
 * are swallowed so the caller degrades to the normal HTTP path.
 */
export async function primeAvatarGlbCache(modelUrl: string): Promise<void> {
  if (!modelUrl || typeof caches === 'undefined') return;

  // Already primed this session — nothing to do.
  if (blobUrlRegistry.has(modelUrl)) return;

  // Coalesce concurrent calls for the same URL.
  const existing = primeInFlight.get(modelUrl);
  if (existing) return existing;

  const prime = (async () => {
    try {
      const cache = await caches.open(GLB_CACHE_NAME);
      let resp = await cache.match(modelUrl);

      if (!resp) {
        // Not in Cache API yet — fetch (HTTP cache used if warm) then persist.
        const fetched = await fetch(modelUrl, { cache: 'force-cache' });
        if (fetched.ok) {
          await cache.put(modelUrl, fetched.clone());
          resp = fetched;
        }
      }

      if (resp?.ok) {
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRegistry.set(modelUrl, blobUrl);
      }
    } catch {
      /* Private-mode caches restriction or network failure — degrade gracefully. */
    } finally {
      primeInFlight.delete(modelUrl);
    }
  })();

  primeInFlight.set(modelUrl, prime);
  return prime;
}

/**
 * Revoke the in-session blob URL and evict the GLB from the Cache API.
 * Call this when the user switches avatars to free memory and storage.
 */
export async function evictAvatarGlbCache(modelUrl: string): Promise<void> {
  const blobUrl = blobUrlRegistry.get(modelUrl);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrlRegistry.delete(modelUrl);
  }
  try {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(GLB_CACHE_NAME);
    await cache.delete(modelUrl);
  } catch {}
}

/**
 * Full cache wipe — localStorage + in-memory blob URLs + Cache API bucket.
 * Call on sign-out or account reset.
 */
export async function clearAvatarCache(): Promise<void> {
  clearAvatarCacheMeta();
  for (const blobUrl of blobUrlRegistry.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrlRegistry.clear();
  primeInFlight.clear();
  try {
    if (typeof caches !== 'undefined') {
      await caches.delete(GLB_CACHE_NAME);
    }
  } catch {}
}
