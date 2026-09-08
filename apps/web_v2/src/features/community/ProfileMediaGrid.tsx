'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchFeedPage, type FeedItem } from '@/features/feed/feedApi';
import { postPath } from '@/lib/routes/routePolicy';

const PAGE_SIZE = 25;
const TARGET_TILES = 36;

type MediaTile = {
  id: string;
  url: string;
};

function ProfileMediaSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-0.5" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse bg-black/[0.06]" />
      ))}
    </div>
  );
}

/**
 * Media from this account's posts — Instagram-style square grid.
 * Taps open the post detail.
 */
export function ProfileMediaGrid({
  accountId,
  isSelf,
}: {
  accountId: string;
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [tiles, setTiles] = useState<MediaTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>());

  const ingest = useCallback((items: FeedItem[]) => {
    const next: MediaTile[] = [];
    for (const item of items) {
      const url = item.media_url?.trim();
      if (!url || seenIdsRef.current.has(item.id)) continue;
      seenIdsRef.current.add(item.id);
      next.push({ id: item.id, url });
    }
    return next;
  }, []);

  const loadPage = useCallback(
    async (opts: { reset: boolean; signal?: AbortSignal }) => {
      if (opts.reset) {
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
        seenIdsRef.current = new Set();
      } else {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        let offset = opts.reset ? 0 : offsetRef.current;
        let collected: MediaTile[] = [];
        let more = true;
        // Keep paging until we fill a grid-worth of media or run out.
        while (more && collected.length < (opts.reset ? TARGET_TILES : 12)) {
          const page = await fetchFeedPage({
            accountId,
            offset,
            limit: PAGE_SIZE,
            signal: opts.signal,
          });
          if (opts.signal?.aborted) return;
          const batch = ingest(page.items);
          collected = [...collected, ...batch];
          offset += page.items.length;
          more = page.hasMore;
          if (page.items.length === 0) break;
        }
        if (opts.signal?.aborted) return;
        offsetRef.current = offset;
        setHasMore(more);
        setTiles((prev) => (opts.reset ? collected : [...prev, ...collected]));
      } catch (e: unknown) {
        if (opts.signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load media');
        if (opts.reset) setTiles([]);
      } finally {
        if (!opts.signal?.aborted) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [accountId, ingest],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadPage({ reset: true, signal: ac.signal });
    return () => ac.abort();
  }, [loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadPage({ reset: false });
        }
      },
      { rootMargin: '240px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadPage, loading, loadingMore, tiles.length]);

  if (loading) return <ProfileMediaSkeleton />;

  if (error) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-[14px] text-foreground-muted">{error}</p>
        <button
          type="button"
          onClick={() => void loadPage({ reset: true })}
          className="mt-3 text-[14px] font-semibold text-lake-blue"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tiles.length === 0) {
    return (
      <div className="px-5 py-14 text-center">
        <p className="text-[17px] font-bold tracking-tight text-foreground">No media yet</p>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">
          {isSelf
            ? 'Photos and videos from your posts will show up here.'
            : 'When they post photos or videos, they will show up here.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            aria-label="Open post"
            onClick={() => router.push(postPath(tile.id))}
            className="relative aspect-square overflow-hidden bg-black/[0.04] transition active:opacity-80"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tile.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <div ref={sentinelRef} className="h-8" aria-hidden />
      {loadingMore ? (
        <p className="py-3 text-center text-[13px] text-foreground-muted">Loading more…</p>
      ) : null}
    </div>
  );
}
