'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageScroll } from '@/features/appShell/PageScroll';
import { fetchFeedAds } from '@/features/ads/adsFeedApi';
import { useAuthSafe } from '@/features/auth';
import { FeedAdCard } from '@/features/feed/FeedAdCard';
import { TopBar } from '@/features/appShell/TopBar';
import type { FeedAdItem } from '@/features/feed/feedStream';
import { IconBillboard } from '@/features/map/dockCore/core/icons';
import { pagesAdvertisePath } from '@/lib/routes/routePolicy';

function AdsSkeleton() {
  return (
    <div className="divide-y divide-black/[0.08] border-t border-black/[0.08]">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex animate-pulse gap-3 px-4 py-3.5">
          <div className="h-10 w-10 shrink-0 rounded-full bg-black/[0.06]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-40 rounded bg-black/[0.06]" />
            <div className="h-3 w-full rounded bg-black/[0.06]" />
            <div className="mt-2 aspect-[16/10] w-full rounded-2xl bg-black/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * /ads — dedicated sponsored stream from the `ads_feed` platform slot.
 * Same card + impression/click ledger as main_feed inserts on /feed.
 */
export default function AdsFeedPage() {
  const { account } = useAuthSafe();
  const [items, setItems] = useState<FeedAdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    setLoading(true);
    try {
      const next = await fetchFeedAds({ slot: 'ads_feed', limit: 24, signal });
      if (signal?.aborted) return;
      setItems(next);
    } catch (e: unknown) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : 'Failed to load sponsored feed');
      setItems([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void reload(ac.signal);
    return () => ac.abort();
  }, [reload]);

  return (
    <PageScroll onRefresh={() => void reload()}>
      <TopBar title="Sponsored" />

      <div className="pb-8">
        {loading ? (
          <AdsSkeleton />
        ) : error ? (
          <p className="px-5 py-10 text-center text-[14px] text-foreground-muted">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-foreground-muted">
              <IconBillboard className="h-6 w-6" />
            </span>
            <h2 className="mt-4 text-[17px] font-bold tracking-tight text-foreground">
              No sponsored posts yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-foreground-muted">
              When pages run creatives on the Sponsored feed slot, they show up here in the same
              format as community posts.
            </p>
            {account ? (
              <Link
                href={pagesAdvertisePath()}
                className="mt-6 inline-flex rounded-full bg-foreground px-4 py-2.5 text-[14px] font-semibold text-white transition active:scale-95"
              >
                My Pages
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-black/[0.08] border-t border-black/[0.08]">
            {items.map((ad) => (
              <FeedAdCard key={`${ad.placementId}:${ad.creativeId}`} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </PageScroll>
  );
}
