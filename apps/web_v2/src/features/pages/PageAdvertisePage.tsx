'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { PageLogoDisc } from '@/features/map/directory/PageLogoDisc';
import { fetchDirectoryPageDetail } from '@/features/map/directory/directoryPages';
import { IconArrowLeft, IconBillboard } from '@/features/map/dockCore/core/icons';
import { canViewPrivatePage } from '@/lib/directory/pageAudience';
import type { DirectoryPageDetail } from '@/lib/directory/directoryPageTypes';
import {
  directoryPageManagePath,
  directoryPageSharePath,
} from '@/lib/directory/pageContactLinks';
import { PAGES_PATH } from '@/lib/routes/routePolicy';
import { safePadTop } from '@/lib/despia/safeArea';
import { useAuthSafe } from '@/features/auth';

/**
 * /page/:slug/advertise — page-scoped ads entry.
 * Credits, creatives, and placements expand here; account hub stays My Pages.
 */
export default function PageAdvertisePage() {
  const params = useParams<{ slug: string }>();
  const slugParam = typeof params?.slug === 'string' ? params.slug : '';
  const slug = decodeURIComponent(slugParam).trim();
  const router = useRouter();
  const { account } = useAuthSafe();

  const [page, setPage] = useState<DirectoryPageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const profileHref = (s: string) =>
    directoryPageSharePath(s) ?? `/page/${encodeURIComponent(s)}`;

  const load = useCallback(async () => {
    if (!slug) {
      setPage(null);
      setError('Missing page');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await fetchDirectoryPageDetail(slug);
      if (!row) {
        setPage(null);
        setError('Page not found');
        return;
      }
      if (!canViewPrivatePage(row.viewer)) {
        router.replace(profileHref(row.slug));
        return;
      }
      setPage(row);
    } catch (e: unknown) {
      setPage(null);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [slug, account?.id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const onBack = () => {
    router.push(profileHref(page?.slug ?? slug));
  };

  const managePath = directoryPageManagePath(page?.slug ?? slug);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]/95 backdrop-blur-md"
        style={{ paddingTop: safePadTop('0.15rem') }}
      >
        <div className="flex h-11 items-center gap-2 px-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="inline-flex items-center gap-0.5 py-1.5 pl-1 pr-2 text-[17px] text-lake-blue active:opacity-60"
          >
            <IconArrowLeft className="h-5 w-5" />
            Page
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-foreground">
            Advertise
          </h1>
          <span className="w-[4.5rem]" aria-hidden />
        </div>
      </header>

      <PageScroll onRefresh={load}>
        <div className="space-y-5 px-4 pb-12 pt-4">
          {loading && !page ? (
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 animate-pulse rounded-[0.95rem] bg-black/[0.06]" />
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <div className="h-5 w-48 animate-pulse rounded bg-black/[0.06]" />
                <div className="h-3 w-32 animate-pulse rounded bg-black/[0.05]" />
              </div>
            </div>
          ) : null}

          {error && !page ? (
            <div className="py-16 text-center">
              <p className="text-[16px] font-semibold text-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 text-[14px] font-semibold text-lake-blue"
              >
                Retry
              </button>
            </div>
          ) : null}

          {page ? (
            <>
              <div className="flex items-start gap-3">
                <PageLogoDisc
                  title={page.title}
                  logoUrl={page.logoUrl}
                  icon={page.icon}
                  size="lg"
                  verified={page.isVerified}
                  executive={page.executivePass}
                />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-[22px] font-extrabold tracking-tight text-foreground">
                    {page.title}
                  </p>
                  <p className="mt-0.5 text-[13px] text-foreground-muted">
                    Promote this page on the feed and map.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[14px] border border-black/[0.08] bg-white shadow-sm">
                <div className="flex items-start gap-3 border-b border-black/[0.06] px-4 py-3.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-lake-blue/[0.08] text-lake-blue">
                    <IconBillboard className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold text-foreground">Ads for this page</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-foreground-muted">
                      Credits, creatives, and placements are managed here — not from a separate
                      account Ads Manager.
                    </p>
                  </div>
                </div>
                <AdvertiseRow
                  title="Credits"
                  subtitle="Page wallet balance and top-ups"
                />
                <AdvertiseRow
                  title="Creatives"
                  subtitle="Sponsored posts and artwork"
                />
                <AdvertiseRow
                  title="Placements"
                  subtitle="Feed, homepage, and map slots"
                />
              </div>

              <div className="overflow-hidden rounded-[14px] border border-black/[0.08] bg-white shadow-sm">
                {managePath ? (
                  <button
                    type="button"
                    onClick={() => router.push(managePath)}
                    className="flex w-full items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 text-left transition active:bg-black/[0.03]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-medium text-foreground">
                        Edit listing
                      </span>
                      <span className="mt-0.5 block text-[13px] text-foreground-muted">
                        Title, about, contact, publishing
                      </span>
                    </span>
                    <span className="text-foreground-muted" aria-hidden>
                      ›
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => router.push(PAGES_PATH)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-black/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-medium text-foreground">My Pages</span>
                    <span className="mt-0.5 block text-[13px] text-foreground-muted">
                      All pages you own or claimed
                    </span>
                  </span>
                  <span className="text-foreground-muted" aria-hidden>
                    ›
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </PageScroll>
    </div>
  );
}

function AdvertiseRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex w-full items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-[13px] text-foreground-muted">{subtitle}</span>
      </span>
      <span className="shrink-0 rounded-md bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
        Soon
      </span>
    </div>
  );
}
