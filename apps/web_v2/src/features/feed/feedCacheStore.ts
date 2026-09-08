'use client';

/**
 * Module-level SWR cache for the community feed.
 *
 * Tab remounts and splash warm share one snapshot per scope so Feed paints
 * instantly when data was fetched earlier (boot or a prior visit).
 */

import {
  fetchFeedPage,
  type FeedItem,
  type FeedScope,
} from '@/features/feed/feedApi';
import { fetchFeedAds } from '@/features/ads/adsFeedApi';
import type { FeedAdItem } from '@/features/feed/feedStream';

export const FEED_PAGE_SIZE = 25;

export type FeedCacheEntry = {
  items: FeedItem[];
  ads: FeedAdItem[];
  hasMore: boolean;
  /** First-page offset cursor = items.length after last successful page-0 load. */
  offset: number;
  fetchedAt: number;
};

type Listener = () => void;

const cache = new Map<FeedScope, FeedCacheEntry>();
const inflight = new Map<FeedScope, Promise<FeedCacheEntry>>();
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeFeedCache(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFeedCache(scope: FeedScope): FeedCacheEntry | null {
  return cache.get(scope) ?? null;
}

export function setFeedCache(scope: FeedScope, entry: FeedCacheEntry): void {
  cache.set(scope, entry);
  emit();
}

/** Drop a post from every cached scope (delete / hide). */
export function removeFeedCacheItem(postId: string): void {
  let changed = false;
  for (const [scope, entry] of cache) {
    const nextItems = entry.items.filter((p) => p.id !== postId);
    if (nextItems.length === entry.items.length) continue;
    cache.set(scope, {
      ...entry,
      items: nextItems,
      offset: nextItems.length,
    });
    changed = true;
  }
  if (changed) emit();
}

/** Merge pagination into an existing scope entry. */
export function appendFeedCachePage(
  scope: FeedScope,
  pageItems: FeedItem[],
  hasMore: boolean,
): void {
  const prev = cache.get(scope);
  if (!prev) {
    setFeedCache(scope, {
      items: pageItems,
      ads: [],
      hasMore,
      offset: pageItems.length,
      fetchedAt: Date.now(),
    });
    return;
  }
  const seen = new Set(prev.items.map((p) => p.id));
  const merged = [
    ...prev.items,
    ...pageItems.filter((p) => !seen.has(p.id)),
  ];
  setFeedCache(scope, {
    ...prev,
    items: merged,
    hasMore,
    offset: merged.length,
    fetchedAt: Date.now(),
  });
}

async function fetchFirstPage(
  scope: FeedScope,
  signal?: AbortSignal,
): Promise<FeedCacheEntry> {
  const showAds = scope === 'all';
  const [page, ads] = await Promise.all([
    fetchFeedPage({
      offset: 0,
      limit: FEED_PAGE_SIZE,
      scope,
      signal,
    }),
    showAds
      ? fetchFeedAds({ slot: 'main_feed', limit: 16, signal })
      : Promise.resolve([] as FeedAdItem[]),
  ]);
  return {
    items: page.items,
    ads,
    hasMore: page.hasMore,
    offset: page.items.length,
    fetchedAt: Date.now(),
  };
}

/**
 * Ensure scope has a fresh first page. Dedupes in-flight requests.
 * Writes the cache on success. Does not clear existing cache on failure.
 */
export async function ensureFeedCache(
  scope: FeedScope,
  opts?: { force?: boolean; signal?: AbortSignal },
): Promise<FeedCacheEntry> {
  const existing = cache.get(scope);
  if (!opts?.force && existing && Date.now() - existing.fetchedAt < 15_000) {
    return existing;
  }

  const pending = inflight.get(scope);
  if (pending && !opts?.force) return pending;

  const run = (async () => {
    const entry = await fetchFirstPage(scope, opts?.signal);
    if (opts?.signal?.aborted) return entry;
    setFeedCache(scope, entry);
    return entry;
  })().finally(() => {
    inflight.delete(scope);
  });

  inflight.set(scope, run);
  return run;
}

/**
 * Splash / idle warm — fill All (home) first; Following + Places after.
 * Safe to call multiple times; failures are swallowed.
 */
export async function warmFeedHome(): Promise<void> {
  try {
    await ensureFeedCache('all');
  } catch {
    /* feed still loads on demand */
  }
  // Idle secondary scopes — don't block splash on these.
  void ensureFeedCache('following').catch(() => undefined);
  void ensureFeedCache('places').catch(() => undefined);
}

export function clearFeedCache(): void {
  if (cache.size === 0) return;
  cache.clear();
  emit();
}
