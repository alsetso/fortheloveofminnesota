'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FeedPostCard } from '@/features/feed/FeedPostCard';
import { fetchFeedPage, type FeedItem } from '@/features/feed/feedApi';

const PAGE_SIZE = 25;

function ProfileFeedSkeleton() {
  return (
    <div className="divide-y divide-black/[0.08] border-t border-black/[0.08]" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-2.5 px-4 py-3">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-black/[0.06]" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-36 animate-pulse rounded bg-black/[0.06]" />
            <div className="h-3 w-full animate-pulse rounded bg-black/[0.05]" />
            <div className="h-3 w-[80%] animate-pulse rounded bg-black/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Account timeline on `/:username` — same row chrome as the community Feed.
 * Owner compose lives in the profile header (+), not a floating FAB.
 */
export function ProfileFeed({
  accountId,
  isSelf,
}: {
  accountId: string;
  isSelf?: boolean;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(
    async (opts: { reset: boolean; signal?: AbortSignal }) => {
      if (opts.reset) {
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
      } else {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        const page = await fetchFeedPage({
          accountId,
          offset: opts.reset ? 0 : offsetRef.current,
          limit: PAGE_SIZE,
          signal: opts.signal,
        });
        if (opts.signal?.aborted) return;
        setItems((prev) => (opts.reset ? page.items : [...prev, ...page.items]));
        offsetRef.current = (opts.reset ? 0 : offsetRef.current) + page.items.length;
        setHasMore(page.hasMore);
      } catch (e: unknown) {
        if (opts.signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load posts');
        if (opts.reset) setItems([]);
      } finally {
        if (!opts.signal?.aborted) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [accountId],
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
  }, [hasMore, loadPage, loading, loadingMore, items.length]);

  if (loading) {
    return <ProfileFeedSkeleton />;
  }

  if (error) {
    return (
      <div className="border-t border-black/[0.08] px-5 py-10 text-center">
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

  if (items.length === 0) {
    return (
      <div className="border-t border-black/[0.08] px-5 py-14 text-center">
        <p className="text-[17px] font-bold tracking-tight text-foreground">No posts yet</p>
        <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">
          {isSelf
            ? 'Tap + to share your first post.'
            : 'When they post, it will show up here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-black/[0.08] border-t border-black/[0.08]">
      {items.map((item) => (
        <FeedPostCard
          key={item.id}
          item={item}
          onPostUpdated={() => void loadPage({ reset: true })}
          onRemoved={(id) =>
            setItems((prev) => prev.filter((p) => p.id !== id))
          }
        />
      ))}
      <div ref={sentinelRef} className="h-8" aria-hidden />
      {loadingMore ? (
        <p className="py-3 text-center text-[13px] text-foreground-muted">Loading more…</p>
      ) : null}
    </div>
  );
}
