'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { PageScroll } from '@/features/appShell/PageScroll';
import { FeedAdCard } from '@/features/feed/FeedAdCard';
import { FeedComposeFab } from '@/features/feed/FeedComposeFab';
import { FeedFilterSheet } from '@/features/feed/FeedFilterSheet';
import { FeedFollowingStories } from '@/features/feed/FeedFollowingStories';
import { FeedNotificationsButton } from '@/features/feed/FeedNotificationsButton';
import { FeedPlacesStories } from '@/features/feed/FeedPlacesStories';
import { FeedPostCard } from '@/features/feed/FeedPostCard';
import {
  FeedSegmentToolbar,
  type FeedSegmentId,
} from '@/features/feed/FeedSegmentToolbar';
import {
  getFeedHiddenTopicsSnapshot,
  subscribeFeedFilters,
  type FeedFilterTopicId,
} from '@/features/feed/feedFilterStore';
import { TopBar } from '@/features/appShell/TopBar';
import {
  fetchFeedPage,
  type FeedItem,
  type FeedScope,
} from '@/features/feed/feedApi';
import {
  appendFeedCachePage,
  ensureFeedCache,
  FEED_PAGE_SIZE,
  getFeedCache,
  removeFeedCacheItem,
} from '@/features/feed/feedCacheStore';
import {
  interleaveFeedAds,
  type FeedAdItem,
  type FeedStreamItem,
} from '@/features/feed/feedStream';
import {
  CATEGORY_UUID,
  type ContributionCategoryId,
} from '@/features/community/contributionTypes';
import {
  DISCOVER_PATH,
  DISCOVER_PLACES_PATH,
  GAME_PATH,
} from '@/lib/routes/routePolicy';

const UUID_TO_TOPIC = Object.fromEntries(
  (Object.entries(CATEGORY_UUID) as [ContributionCategoryId, string][]).map(
    ([id, uuid]) => [uuid, id],
  ),
) as Record<string, FeedFilterTopicId>;

function isPostHiddenByFilters(
  post: FeedItem,
  hidden: ReadonlySet<FeedFilterTopicId>,
): boolean {
  if (hidden.size === 0) return false;
  const topic = post.mention_type_id
    ? UUID_TO_TOPIC[post.mention_type_id]
    : undefined;
  return Boolean(topic && hidden.has(topic));
}

function segmentToScope(segment: FeedSegmentId): FeedScope {
  if (segment === 'following') return 'following';
  if (segment === 'places') return 'places';
  return 'all';
}

function FeedSkeleton() {
  return (
    <div className="divide-y divide-black/[0.08]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex animate-pulse gap-3 px-5 py-3.5">
          <div className="h-10 w-10 shrink-0 rounded-full bg-black/[0.06]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-36 rounded bg-black/[0.06]" />
            <div className="h-3 w-full rounded bg-black/[0.06]" />
            <div className="h-3 w-4/5 rounded bg-black/[0.06]" />
            <div className="mt-2 aspect-[16/10] w-full rounded-2xl bg-black/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Signed-in community feed — posts from across Minnesota, with sponsored inserts. */
export default function FeedPage() {
  const [segment, setSegment] = useState<FeedSegmentId>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const feedScope = segmentToScope(segment);
  const cached0 = getFeedCache(feedScope);
  const [items, setItems] = useState<FeedItem[]>(() => cached0?.items ?? []);
  const [ads, setAds] = useState<FeedAdItem[]>(() => cached0?.ads ?? []);
  const [offset, setOffset] = useState(() => cached0?.offset ?? 0);
  const [hasMore, setHasMore] = useState(() => cached0?.hasMore ?? true);
  const [loading, setLoading] = useState(() => !cached0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const hiddenTopics = useSyncExternalStore(
    subscribeFeedFilters,
    getFeedHiddenTopicsSnapshot,
    () => new Set<FeedFilterTopicId>(),
  );

  const showAds = segment === 'all';

  const applyCached = useCallback((scope: FeedScope) => {
    const hit = getFeedCache(scope);
    if (!hit) return false;
    setItems(hit.items);
    setAds(hit.ads);
    setOffset(hit.offset);
    setHasMore(hit.hasMore);
    setError(null);
    setLoading(false);
    return true;
  }, []);

  const paintEntry = useCallback(
    (entry: {
      items: FeedItem[];
      ads: FeedAdItem[];
      hasMore: boolean;
      offset: number;
    }) => {
      setItems(entry.items);
      setAds(entry.ads);
      setOffset(entry.offset);
      setHasMore(entry.hasMore);
      setError(null);
      setLoading(false);
    },
    [],
  );

  /** Soft refresh: keep painted rows; skeleton only when nothing cached. */
  const reload = useCallback(async () => {
    setError(null);
    if (items.length === 0) setLoading(true);
    try {
      const entry = await ensureFeedCache(feedScope, { force: true });
      paintEntry(entry);
    } catch (e: unknown) {
      if (items.length === 0) {
        setError(e instanceof Error ? e.message : 'Failed to load feed');
        setItems([]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }, [feedScope, items.length, paintEntry]);

  useEffect(() => {
    const ac = new AbortController();
    const hadCache = applyCached(feedScope);
    if (!hadCache) {
      setLoading(true);
      setError(null);
      setItems([]);
      setAds([]);
      setOffset(0);
      setHasMore(true);
    }

    void (async () => {
      try {
        const entry = await ensureFeedCache(feedScope, {
          force: true,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        paintEntry(entry);
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        if (!getFeedCache(feedScope)) {
          setError(e instanceof Error ? e.message : 'Failed to load feed');
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [applyCached, feedScope, paintEntry]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchFeedPage({
        offset,
        limit: FEED_PAGE_SIZE,
        scope: feedScope,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setOffset((n) => n + page.items.length);
      setHasMore(page.hasMore);
      appendFeedCachePage(feedScope, page.items, page.hasMore);
    } catch {
      /* keep existing list */
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, feedScope, offset]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '240px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, loading, segment]);

  const visibleItems = useMemo(
    () => items.filter((post) => !isPostHiddenByFilters(post, hiddenTopics)),
    [hiddenTopics, items],
  );

  const stream: FeedStreamItem[] = useMemo(() => {
    if (!showAds) {
      return visibleItems.map((post) => ({
        kind: 'post' as const,
        key: `post:${post.id}`,
        post,
      }));
    }
    return interleaveFeedAds(visibleItems, ads).items;
  }, [ads, showAds, visibleItems]);

  const chromeBelow = (
    <FeedSegmentToolbar
      active={segment}
      onChange={setSegment}
      onOpenFilter={() => setFilterOpen(true)}
    />
  );

  const emptyCopy = (() => {
    if (segment === 'following') {
      return {
        title: 'No posts yet',
        body: 'Posts from people you follow will show up here.',
        href: DISCOVER_PATH,
        cta: 'Find people',
      };
    }
    if (segment === 'places') {
      return {
        title: 'No posts in your places',
        body: 'Add cities you live, work, or follow — posts from those CTUs land here.',
        href: DISCOVER_PLACES_PATH,
        cta: 'Manage places',
      };
    }
    return {
      title: 'Nothing here yet',
      body: 'Drop a pin on the map and it will show up here.',
      href: GAME_PATH,
      cta: 'Open map',
    };
  })();

  const postsBody = loading ? (
    <FeedSkeleton />
  ) : error ? (
    <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">
      {error}
    </p>
  ) : items.length === 0 ? (
    <div className="px-5 py-14 text-center">
      <p className="text-[17px] font-bold tracking-tight text-foreground">
        {emptyCopy.title}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">
        {emptyCopy.body}
      </p>
      <Link
        href={emptyCopy.href}
        className="mt-5 inline-flex text-[14px] font-semibold text-lake-blue transition active:opacity-70"
      >
        {emptyCopy.cta}
      </Link>
    </div>
  ) : visibleItems.length === 0 ? (
    <div className="px-5 py-14 text-center">
      <p className="text-[17px] font-bold tracking-tight text-foreground">
        Everything filtered out
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">
        Reset your topic filters to see posts again.
      </p>
      <button
        type="button"
        onClick={() => setFilterOpen(true)}
        className="mt-5 inline-flex text-[14px] font-semibold text-lake-blue transition active:opacity-70"
      >
        Adjust filters
      </button>
    </div>
  ) : (
    <div className="divide-y divide-black/[0.08]">
      {stream.map((row) =>
        row.kind === 'ad' ? (
          <FeedAdCard key={row.key} ad={row.ad} />
        ) : (
          <FeedPostCard
            key={row.key}
            item={row.post}
            onPostUpdated={() => void reload()}
            onRemoved={(id) => {
              removeFeedCacheItem(id);
              setItems((prev) => prev.filter((p) => p.id !== id));
            }}
          />
        ),
      )}
      <div ref={sentinelRef} className="h-8" aria-hidden />
      {loadingMore ? (
        <p className="py-3 text-center text-[13px] text-foreground-muted">
          Loading more…
        </p>
      ) : null}
    </div>
  );

  return (
    <PageScroll onRefresh={reload}>
      <TopBar
        title="Minnesota"
        trailing={<FeedNotificationsButton />}
        below={chromeBelow}
      />

      <div className="pb-8">
        {segment === 'following' ? (
          <>
            <FeedFollowingStories />
            {postsBody}
          </>
        ) : segment === 'places' ? (
          <>
            <FeedPlacesStories />
            {postsBody}
          </>
        ) : (
          postsBody
        )}
      </div>

      <FeedFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} />
      <FeedComposeFab
        onCreated={() => {
          // Land on All so a new public post is obvious.
          setSegment('all');
          void reload();
        }}
      />
    </PageScroll>
  );
}
