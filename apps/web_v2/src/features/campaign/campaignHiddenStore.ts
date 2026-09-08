'use client';

/**
 * Persists whether the user has explicitly hidden the campaign card.
 * Stored in localStorage so it survives page reload.
 * Resets when a new chapter becomes available (new content = re-surface).
 */

const KEY = 'ftlomn:campaign:hidden';
const UNLOCKED_KEY = 'ftlomn:campaign:last-unlocked';

export function getCampaignHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function setCampaignHidden(hidden: boolean) {
  try {
    if (hidden) {
      localStorage.setItem(KEY, 'true');
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {}
}

/** Track the last unlocked chapter num so we can re-surface on new content. */
export function getLastUnlockedChapterNum(): number {
  try {
    return parseInt(localStorage.getItem(UNLOCKED_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function setLastUnlockedChapterNum(num: number) {
  try {
    localStorage.setItem(UNLOCKED_KEY, String(num));
  } catch {}
}
