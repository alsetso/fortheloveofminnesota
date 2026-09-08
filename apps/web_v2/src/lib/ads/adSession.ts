const SESSION_STORAGE_KEY = 'loveofmn.ad.session';

/** Stable anonymous session id for ad attribution (per browser tab session). */
export function getAdSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
