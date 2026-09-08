'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import {
  DirectoryPageProfileBody,
  pageCardChipsFor,
} from '@/features/map/directory/DirectoryPageProfileBody';
import { PageAudienceChips } from '@/features/map/directory/PageAudienceChips';
import { PageLogoDisc } from '@/features/map/directory/PageLogoDisc';
import { fetchDirectoryPageDetail } from '@/features/map/directory/directoryPages';
import {
  IconArrowLeft,
  IconEllipsis,
  IconShield,
} from '@/features/map/dockCore/core/icons';
import { canViewPrivatePage } from '@/lib/directory/pageAudience';
import type { DirectoryPageDetail } from '@/lib/directory/directoryPageTypes';
import {
  directoryPageAdvertisePath,
  directoryPageManagePath,
  directoryPageSharePath,
  directoryPageShareUrl,
} from '@/lib/directory/pageContactLinks';
import { PAGES_PATH } from '@/lib/routes/routePolicy';
import { safePadTop } from '@/lib/despia/safeArea';
import { useAuthSafe } from '@/features/auth';

const SCROLLBAR_HIDE =
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const COVER_CHROME_BTN =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-[#1c1c1e] shadow-[0_2px_12px_rgba(0,0,0,0.18)] backdrop-blur-sm transition active:scale-[0.93]';

function ManageRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 text-left last:border-b-0 transition active:bg-black/[0.03] disabled:opacity-45"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-[13px] text-foreground-muted">{subtitle}</span>
      </span>
      {onClick ? (
        <span className="text-foreground-muted" aria-hidden>
          ›
        </span>
      ) : null}
    </button>
  );
}

function ManageGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <div className="overflow-hidden rounded-[14px] border border-black/[0.08] bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

async function shareOrCopy(title: string, url: string) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title, url });
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    /* ignore */
  }
}

/**
 * /page/:slug — sharable directory page profile.
 * Creator / claimed owner see manage controls via viewer flags from the API.
 */
export default function PublicPagePage() {
  const params = useParams<{ slug: string }>();
  const slugParam = typeof params?.slug === 'string' ? params.slug : '';
  const slug = decodeURIComponent(slugParam).trim();
  const router = useRouter();
  const { account } = useAuthSafe();

  const [page, setPage] = useState<DirectoryPageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareFlash, setShareFlash] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      setPage(row);
      if (!row) {
        setError('Page not found');
        setSaved(false);
        return;
      }
      if (account?.id && !canViewPrivatePage(row.viewer)) {
        const res = await fetch(
          `/api/directory/favorites?page_id=${encodeURIComponent(row.id)}`,
          { credentials: 'include', cache: 'no-store' },
        );
        const json = (await res.json().catch(() => ({}))) as { saved?: boolean };
        setSaved(Boolean(json.saved));
      } else {
        setSaved(false);
      }
    } catch (e: unknown) {
      setPage(null);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [slug, account?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setMenuOpen(false);
  }, [slug]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const privateView = page ? canViewPrivatePage(page.viewer) : false;
  const typeLine = [page?.pageTypeLabel, page?.cityName].filter(Boolean).join(' • ');
  const chips = pageCardChipsFor(page);
  const shareUrl = page ? directoryPageShareUrl(page.slug) : null;
  const sharePath = page ? directoryPageSharePath(page.slug) : null;
  const managePath = page
    ? directoryPageManagePath(page.slug || page.id)
    : null;
  const advertisePath = page
    ? directoryPageAdvertisePath(page.slug || page.id)
    : null;
  const coverUrl = page?.coverUrl?.trim() || null;
  const showMenu =
    Boolean(shareUrl) ||
    (privateView && Boolean(managePath)) ||
    (privateView && Boolean(advertisePath)) ||
    Boolean(account && page && !privateView);

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(privateView ? PAGES_PATH : '/feed');
  };

  const onManage = () => {
    if (!managePath) return;
    setMenuOpen(false);
    router.push(managePath);
  };

  const onAdvertise = () => {
    if (!advertisePath) return;
    setMenuOpen(false);
    router.push(advertisePath);
  };

  const onShare = () => {
    if (!page || !shareUrl) return;
    setMenuOpen(false);
    void shareOrCopy(page.title, shareUrl).then(() => {
      setShareFlash(true);
      window.setTimeout(() => setShareFlash(false), 1600);
    });
  };

  const onToggleSave = async () => {
    if (!page || !account || saveBusy || privateView) return;
    setMenuOpen(false);
    setSaveBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch('/api/directory/favorites', {
        method: next ? 'POST' : 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: page.id }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        saved?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setSaved(!next);
        setError(json.error || 'Could not update book');
        return;
      }
      setSaved(Boolean(json.saved));
    } catch {
      setSaved(!next);
      setError('Could not update book');
    } finally {
      setSaveBusy(false);
    }
  };

  const coverChrome = (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pb-2"
      style={{ paddingTop: safePadTop('0.55rem') }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className={`pointer-events-auto ${COVER_CHROME_BTN}`}
      >
        <IconArrowLeft className="h-5 w-5" />
      </button>

      {showMenu ? (
        <div ref={menuRef} className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={COVER_CHROME_BTN}
          >
            <IconEllipsis className="h-5 w-5" />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.35rem)] z-20 min-w-[10.5rem] overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-black/[0.08]"
            >
              {privateView && managePath ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={onManage}
                  className="flex w-full px-3.5 py-2.5 text-left text-[14px] font-medium text-foreground transition active:bg-black/[0.04]"
                >
                  Manage
                </button>
              ) : null}
              {privateView && advertisePath ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={onAdvertise}
                  className="flex w-full px-3.5 py-2.5 text-left text-[14px] font-medium text-foreground transition active:bg-black/[0.04]"
                >
                  Ads Manager
                </button>
              ) : null}
              {account && page && !privateView ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void onToggleSave()}
                  disabled={saveBusy}
                  className="flex w-full px-3.5 py-2.5 text-left text-[14px] font-medium text-foreground transition active:bg-black/[0.04] disabled:opacity-40"
                >
                  {saved ? 'Remove from book' : 'Save to book'}
                </button>
              ) : null}
              {shareUrl ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={onShare}
                  className="flex w-full px-3.5 py-2.5 text-left text-[14px] font-medium text-foreground transition active:bg-black/[0.04]"
                >
                  {shareFlash ? 'Link copied' : 'Share'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <span className="h-9 w-9" aria-hidden />
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
      <PageScroll onRefresh={load} className={SCROLLBAR_HIDE}>
        <div className={`relative ${coverUrl ? 'bg-black/[0.06]' : 'bg-[#f7f5f1]'}`}>
          {coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt=""
                className="h-[min(42vw,13.5rem)] w-full object-cover sm:h-56"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent"
                aria-hidden
              />
            </>
          ) : (
            <div className="h-11 w-full" style={{ marginTop: safePadTop('0.55rem') }} aria-hidden />
          )}
          {coverChrome}
          {coverUrl && chips.length > 0 ? (
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[38%]">
              <PageAudienceChips chips={chips} variant="cover" />
            </div>
          ) : null}
        </div>

        <div className={`space-y-5 px-4 pb-12 ${coverUrl && page ? 'pt-0' : 'pt-4'}`}>
          {loading && !page ? (
            <div className="flex flex-col items-center gap-3 pt-1">
              <div className="h-24 w-24 animate-pulse rounded-[1.65rem] bg-black/[0.06]" />
              <div className="flex w-full flex-col items-center gap-2">
                <div className="h-6 w-48 animate-pulse rounded bg-black/[0.06]" />
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
              <div className="flex flex-col items-center text-center">
                <div
                  className={`relative z-[5] rounded-[1.75rem] bg-[#f7f5f1] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)] ${
                    coverUrl ? '-mt-12' : ''
                  }`}
                >
                  <PageLogoDisc
                    title={page.title}
                    logoUrl={page.logoUrl}
                    icon={page.icon}
                    size="xl"
                    verified={page.isVerified}
                    executive={page.executivePass}
                  />
                </div>
                <div className="mt-3.5 flex min-w-0 max-w-full items-center justify-center gap-1.5">
                  <h1 className="min-w-0 text-[24px] font-extrabold tracking-tight text-foreground">
                    {page.title}
                  </h1>
                  {page.isVerified ? (
                    <IconShield className="h-5 w-5 shrink-0 text-lake-blue" />
                  ) : null}
                </div>
                {typeLine ? (
                  <p className="mt-1 max-w-full text-[13px] text-foreground-muted">{typeLine}</p>
                ) : null}
              </div>

              {account && !privateView ? (
                <button
                  type="button"
                  onClick={() => void onToggleSave()}
                  disabled={saveBusy}
                  className={`inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40 ${
                    saved
                      ? 'bg-black/[0.06] text-foreground'
                      : 'bg-lake-blue text-white'
                  }`}
                >
                  {saved ? 'Saved to book' : 'Save to book'}
                </button>
              ) : null}

              <DirectoryPageProfileBody
                page={page}
                loading={false}
                error={null}
                fallback={{
                  title: page.title,
                  typeLabel: page.pageTypeLabel,
                  address: page.addressLine,
                  summary: page.description,
                  logoUrl: page.logoUrl,
                  icon: page.icon,
                }}
              />

              {privateView ? (
                <div className="space-y-6 pt-2">
                  <ManageGroup label="Listing">
                    <ManageRow
                      title="Edit listing"
                      subtitle="Title, about, contact, publishing"
                      onClick={managePath ? onManage : undefined}
                    />
                    <ManageRow
                      title={shareFlash ? 'Link copied' : 'Share page'}
                      subtitle={sharePath ?? 'Public link'}
                      onClick={shareUrl ? onShare : undefined}
                    />
                  </ManageGroup>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PageScroll>
    </div>
  );
}
