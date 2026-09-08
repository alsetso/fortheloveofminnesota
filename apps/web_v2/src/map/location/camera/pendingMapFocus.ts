/** One-shot map frame when leaving Feed (or any non-map surface) for a place hit. */

const STORAGE_KEY = 'ftlom.pendingMapFocus';

export type PendingMapFocus = {
  lat: number;
  lng: number;
  label?: string;
};

export function queuePendingMapFocus(focus: PendingMapFocus): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(focus));
  } catch {
    /* private mode */
  }
}

export function takePendingMapFocus(): PendingMapFocus | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as PendingMapFocus;
    if (
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.lng)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
