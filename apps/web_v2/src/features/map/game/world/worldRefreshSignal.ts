/**
 * Module-level signal for triggering a forced world placement refresh.
 *
 * Used by the cube refresh button in GameMinimapRail to tell WorldModelsLayer
 * to re-fetch all currently-cached tiles without a position-change event.
 *
 * Intentionally tiny — no Zustand, no React. Just a counter + listener set
 * so it works cleanly with useSyncExternalStore.
 */

let _count = 0;
const _listeners = new Set<() => void>();

export function triggerWorldRefresh(): void {
  _count++;
  _listeners.forEach((l) => l());
}

export function subscribeWorldRefresh(cb: () => void): () => void {
  _listeners.add(cb);
  return () => {
    _listeners.delete(cb);
  };
}

export function getWorldRefreshCount(): number {
  return _count;
}
