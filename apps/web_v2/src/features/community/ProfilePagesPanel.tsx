'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AccountOwnedPage } from '@/features/map/directory/accountPages';
import { IconBillboard } from '@/features/map/dockCore/core/icons';
import { isPageLogoHttpUrl } from '@/lib/directory/pageTypes';
import { directoryPageSharePath } from '@/lib/directory/pageContactLinks';
import { directoryPageAdvertisePath } from '@/lib/directory/pageContactLinks';
import { PAGES_NEW_PATH, pagesAdvertisePath } from '@/lib/routes/routePolicy';

type RunningAdsStatus = {
  hasRunningAds: boolean;
  pageCount: number;
  creativeCount: number;
  pageIds: string[];
};

async function fetchProfilePages(
  accountId: string,
  signal?: AbortSignal,
): Promise<{ pages: AccountOwnedPage[]; runningAds: RunningAdsStatus }> {
  const res = await fetch(
    `/api/community/profile/pages?account_id=${encodeURIComponent(accountId)}`,
    { credentials: 'include', cache: 'no-store', signal },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Failed to load pages');
  }
  const json = (await res.json()) as {
    pages?: AccountOwnedPage[];
    runningAds?: RunningAdsStatus;
  };
  return {
    pages: json.pages ?? [],
    runningAds: json.runningAds ?? {
      hasRunningAds: false,
      pageCount: 0,
      creativeCount: 0,
      pageIds: [],
    },
  };
}

function RunningAdsBanner({
  isSelf,
  pageCount,
  creativeCount,
  manageHref,
}: {
  isSelf: boolean;
  pageCount: number;
  creativeCount: number;
  manageHref: string;
}) {
  const title = isSelf ? 'You’re running ads' : 'Running ads';
  const subtitle = (() => {
    if (pageCount <= 0) return 'Promoting on Love of Minnesota';
    if (pageCount === 1) {
      return creativeCount === 1
        ? '1 promotion live on Love of Minnesota'
        : `${creativeCount} promotions live on Love of Minnesota`;
    }
    return `${pageCount} pages promoting on Love of Minnesota`;
  })();

  return (
    <div className="px-4 pb-1 pt-3">
      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-lake-blue/20 bg-lake-blue/[0.06] px-3 py-2.5">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-lake-blue/15 bg-white text-lake-blue"
          aria-hidden
        >
          <IconBillboard className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold leading-snug text-foreground">{title}</p>
          <p className="truncate text-[12px] text-foreground-muted">{subtitle}</p>
        </div>
        {isSelf ? (
          <Link
            href={manageHref}
            className="shrink-0 rounded-lg border border-lake-blue/20 bg-white px-3 py-1.5 text-[12px] font-semibold text-lake-blue transition active:opacity-80"
          >
            Manage
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function PageLogoMark({
  page,
  isRunningAds,
}: {
  page: AccountOwnedPage;
  isRunningAds: boolean;
}) {
  const logo = page.logoUrl && isPageLogoHttpUrl(page.logoUrl) ? page.logoUrl : null;
  const emoji = page.icon && !isPageLogoHttpUrl(page.icon) ? page.icon : null;

  return (
    <span className="relative shrink-0">
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[9px] bg-black/[0.06] ring-1 ring-black/[0.08]">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-full w-full object-cover" />
        ) : emoji ? (
          <span className="text-[15px] leading-none" aria-hidden>
            {emoji}
          </span>
        ) : (
          <span className="text-[12px] font-bold tracking-tight text-lake-blue">
            {page.title.slice(0, 1).toUpperCase() || '?'}
          </span>
        )}
      </span>
      {isRunningAds ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-[1.5px] border-white bg-lake-blue text-white shadow-sm"
          title="Running ads"
          aria-label="Running ads"
        >
          <IconBillboard className="h-2.5 w-2.5" />
        </span>
      ) : null}
    </span>
  );
}

function PageTile({
  page,
  isRunningAds,
  onOpen,
}: {
  page: AccountOwnedPage;
  isRunningAds: boolean;
  onOpen: () => void;
}) {
  const cover = page.coverUrl?.trim() || null;
  const logo = page.logoUrl && isPageLogoHttpUrl(page.logoUrl) ? page.logoUrl : null;
  const emoji = page.icon && !isPageLogoHttpUrl(page.icon) ? page.icon : null;
  const art = cover || logo;
  const role = page.isClaimedOwner ? 'Owner' : page.isCreator ? 'Created' : null;
  const meta = [page.pageTypeLabel, role].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col text-left transition active:opacity-80"
    >
      <span className="relative aspect-[16/10] w-full overflow-hidden rounded-[14px] bg-black/[0.06] ring-1 ring-black/[0.06]">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={art}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-active:scale-[1.02]"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center"
            style={{
              background:
                'linear-gradient(145deg, rgb(var(--lake-blue) / 0.22) 0%, rgb(var(--lake-blue) / 0.08) 100%)',
            }}
            aria-hidden
          >
            {emoji ? (
              <span className="text-[2.5rem] leading-none">{emoji}</span>
            ) : (
              <span className="text-[2rem] font-bold tracking-tight text-lake-blue">
                {page.title.slice(0, 1).toUpperCase() || '?'}
              </span>
            )}
          </span>
        )}
        {page.status === 'draft' ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Draft
          </span>
        ) : null}
      </span>
      <span className="mt-2 flex min-w-0 items-start gap-2 px-0.5">
        <PageLogoMark page={page} isRunningAds={isRunningAds} />
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">
            {page.title}
          </span>
          {meta ? (
            <span className="mt-0.5 block truncate text-[12px] leading-snug text-foreground-muted">
              {meta}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

/**
 * Pages created / claimed by this account — Albums-style grid on the profile.
 */
export function ProfilePagesPanel({
  accountId,
  isSelf,
}: {
  accountId: string;
  isSelf?: boolean;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<AccountOwnedPage[]>([]);
  const [runningAds, setRunningAds] = useState<RunningAdsStatus>({
    hasRunningAds: false,
    pageCount: 0,
    creativeCount: 0,
    pageIds: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runningPageIds = useMemo(
    () => new Set(runningAds.pageIds),
    [runningAds.pageIds],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchProfilePages(accountId, signal);
        if (signal?.aborted) return;
        setPages(result.pages);
        setRunningAds(result.runningAds);
      } catch (e: unknown) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load pages');
        setPages([]);
        setRunningAds({
          hasRunningAds: false,
          pageCount: 0,
          creativeCount: 0,
          pageIds: [],
        });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [accountId],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const advertiseHref = useMemo(() => {
    if (runningAds.pageCount === 1 && runningAds.pageIds[0]) {
      const match = pages.find((p) => p.id === runningAds.pageIds[0]);
      const path = directoryPageAdvertisePath(match?.slug);
      if (path) return path;
    }
    return pagesAdvertisePath();
  }, [pages, runningAds.pageCount, runningAds.pageIds]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 px-4 pt-3" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[16/10] animate-pulse rounded-[14px] bg-black/[0.06]" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-[9px] bg-black/[0.06]" />
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-black/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-[14px] text-foreground-muted">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 text-[14px] font-semibold text-lake-blue"
        >
          Retry
        </button>
      </div>
    );
  }

  const banner =
    runningAds.hasRunningAds ? (
      <RunningAdsBanner
        isSelf={Boolean(isSelf)}
        pageCount={runningAds.pageCount}
        creativeCount={runningAds.creativeCount}
        manageHref={advertiseHref}
      />
    ) : null;

  if (pages.length === 0) {
    return (
      <div>
        {banner}
        <div className="px-5 py-14 text-center">
          <p className="text-[17px] font-bold tracking-tight text-foreground">No pages yet</p>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground-muted">
            {isSelf
              ? 'Create a page for a business, place, or project.'
              : 'They haven’t published any pages yet.'}
          </p>
          {isSelf ? (
            <button
              type="button"
              onClick={() => router.push(PAGES_NEW_PATH)}
              className="mt-4 text-[14px] font-semibold text-lake-blue"
            >
              Create a page
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      {banner}
      <div className={`grid grid-cols-2 gap-3 px-4 pb-4 ${banner ? 'pt-2' : 'pt-3'}`}>
        {pages.map((page) => {
          const path = directoryPageSharePath(page.slug);
          return (
            <PageTile
              key={page.id}
              page={page}
              isRunningAds={runningPageIds.has(page.id)}
              onOpen={() => {
                if (path) router.push(path);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
