'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  deleteMediaDrafts,
  ensureLocalCdnBridge,
  getRecentsManifest,
  isReadyLocalCdnUrl,
  patchRecentMediaEntry,
  queryLocalCdn,
  recentThumbnailUrl,
  subscribeLocalCdn,
  subscribeRecentsManifest,
  type RecentMediaEntry,
} from '@/lib/despia/media';

function subscribe(onStoreChange: () => void): () => void {
  ensureLocalCdnBridge();
  const unsubManifest = subscribeRecentsManifest(onStoreChange);
  // Local CDN completions patch the manifest (and emit); also nudge on raw events
  // so UI can react even before a patch lands.
  const unsubCdn = subscribeLocalCdn(() => onStoreChange());
  return () => {
    unsubManifest();
    unsubCdn();
  };
}

function getSnapshot(): RecentMediaEntry[] {
  return getRecentsManifest();
}

/** Stable empty — React 19 requires getServerSnapshot to be referentially equal. */
const EMPTY_RECENTS: RecentMediaEntry[] = [];

function getServerSnapshot(): RecentMediaEntry[] {
  return EMPTY_RECENTS;
}

export type UseRecentsReturn = {
  /** Newest-first app-owned recents (metadata only). */
  recents: RecentMediaEntry[];
  /** Most recent entry, or null when empty. */
  mostRecent: RecentMediaEntry | null;
  /**
   * Best thumbnail URL for the Instagram-style corner button.
   * Uses R2 remote immediately; upgrades to Local CDN only when native cache is ready.
   */
  mostRecentThumbnailUrl: string | null;
  /** Manual delete — media_drafts + Local CDN + manifest. No auto-expiry. */
  deleteRecent: (id: string) => void;
  /** Batch delete for Select mode. */
  deleteRecents: (ids: string[]) => Promise<void>;
  /**
   * Optional reconcile against `localcdn://query` — patches missing localCdnUrl
   * values from native cache. Safe no-op outside Despia.
   */
  refreshFromLocalCdn: () => Promise<void>;
};

/**
 * App-owned recents index for camera / picker media.
 * Not the iOS Photos library — Despia cannot expose PHPhotoLibrary "last photo".
 */
export function useRecents(): UseRecentsReturn {
  const recents = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const mostRecent = recents[0] ?? null;
  const mostRecentThumbnailUrl = useMemo(
    () => recentThumbnailUrl(mostRecent),
    [mostRecent],
  );

  const deleteRecents = useCallback(async (ids: string[]) => {
    await deleteMediaDrafts(ids);
  }, []);

  const deleteRecent = useCallback((id: string) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    void deleteMediaDrafts([trimmed]);
  }, []);

  const refreshFromLocalCdn = useCallback(async () => {
    const items = await queryLocalCdn();
    if (items.length === 0) return;
    for (const item of items) {
      if (!item.index || !isReadyLocalCdnUrl(item.local_cdn)) continue;
      patchRecentMediaEntry(item.index, { localCdnUrl: item.local_cdn! });
    }
  }, []);

  return {
    recents,
    mostRecent,
    mostRecentThumbnailUrl,
    deleteRecent,
    deleteRecents,
    refreshFromLocalCdn,
  };
}
