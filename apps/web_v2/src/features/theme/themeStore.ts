/**
 * App theme preference store — light | dark.
 * Persisted to localStorage; defaults to system preference on first visit.
 * Consumed via useSyncExternalStore throughout the app.
 */

export type AppTheme = 'light' | 'dark';

const STORAGE_KEY = 'ftlomn-app-theme';

// Module-level singleton — safe because this only ever runs client-side after hydration.
let _theme: AppTheme = 'light'; // SSR / pre-hydration default
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((fn) => fn());
}

/** useSyncExternalStore subscriber */
export function subscribeTheme(cb: () => void): () => void {
  _listeners.add(cb);
  return () => void _listeners.delete(cb);
}

/** useSyncExternalStore client snapshot */
export function getTheme(): AppTheme {
  return _theme;
}

/** useSyncExternalStore server snapshot — always light to avoid hydration mismatch */
export function getThemeServer(): AppTheme {
  return 'light';
}

/** Persist + broadcast a new theme choice */
export function setTheme(next: AppTheme) {
  _theme = next;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, next);
  }
  _notify();
}

export function toggleTheme() {
  setTheme(_theme === 'dark' ? 'light' : 'dark');
}

/**
 * Read localStorage + system preference on first client render.
 * Call once inside a useEffect — never during SSR.
 */
export function hydrateTheme() {
  if (typeof window === 'undefined') return;
  const stored = localStorage.getItem(STORAGE_KEY);
  const resolved: AppTheme =
    stored === 'dark'
      ? 'dark'
      : stored === 'light'
        ? 'light'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
  if (resolved !== _theme) {
    _theme = resolved;
    _notify();
  }
}
