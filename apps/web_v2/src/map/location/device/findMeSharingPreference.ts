/**
 * Persist Find Me / location sharing across reloads.
 * Follow Me auto-starts on map ready regardless; this flag still records
 * that the user successfully shared (and is cleared on explicit stop).
 */

export const FIND_ME_SHARING_STORAGE_KEY = 'ftlomn_find_me_sharing';

export function isFindMeSharingPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(FIND_ME_SHARING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setFindMeSharingPreferred(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) localStorage.setItem(FIND_ME_SHARING_STORAGE_KEY, '1');
    else localStorage.removeItem(FIND_ME_SHARING_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}
