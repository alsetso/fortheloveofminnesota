/**
 * Singleton module-level store for the resolved player avatar.
 *
 * Runtime consumers (playerAvatarRuntime) read from here instead of using
 * hardcoded constants. The store is hydrated on game boot via `setAvatarStore`.
 */

export type AvatarEntry = {
  modelId: string;
  modelUrl: string;
  modelSlug: string;
  modelName: string;
};

let current: AvatarEntry | null = null;
const listeners = new Set<() => void>();

/**
 * True once setAvatarStore has been called at least once (even with null).
 * Used to gate compile() so the avatar model is known before the Mapbox layer
 * is created — prevents baking the male-base fallback on fast style loads.
 */
let attempted = false;
const attemptListeners = new Set<() => void>();

export function getAvatarStore(): AvatarEntry | null {
  return current;
}

export function setAvatarStore(entry: AvatarEntry | null): void {
  current = entry;
  if (!attempted) {
    attempted = true;
    for (const fn of attemptListeners) fn();
    attemptListeners.clear();
  }
  for (const fn of listeners) fn();
}

/**
 * Resolves when the avatar store has been set at least once, or after
 * `timeoutMs` (default 3 s) so a slow/failed fetch never blocks map boot.
 */
export function waitForAvatarStoreAttempted(timeoutMs = 3_000): Promise<void> {
  if (attempted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    attemptListeners.add(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export function subscribeAvatarStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
