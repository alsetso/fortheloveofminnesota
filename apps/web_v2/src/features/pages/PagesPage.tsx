'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { TopBar } from '@/features/appShell/TopBar';
import { useAuthSafe } from '@/features/auth';
import {
  fetchAccountOwnedPages,
  type AccountOwnedPage,
} from '@/features/map/directory/accountPages';
import { IconBillboard, IconPlus, IconSearch } from '@/features/map/dockCore/core/icons';
import { isPageLogoHttpUrl } from '@/lib/directory/pageTypes';
import { directoryPageSharePath } from '@/lib/directory/pageContactLinks';
import { PAGE_PATH, PAGES_NEW_PATH } from '@/lib/routes/routePolicy';

/**
 * Cover-first tile — Apple Albums / Maps Collections layout:
 * rounded artwork above, title + one meta line below.
 */
function PageCollectionTile({
  page,
  onOpen,
}: {
  page: AccountOwnedPage;
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
      <span className="relative aspect-square w-full overflow-hidden rounded-[14px] bg-black/[0.06] ring-1 ring-black/[0.06]">
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
      <span className="mt-2 min-w-0 px-0.5">
        <span className="block truncate text-[15px] font-semibold leading-snug text-foreground">
          {page.title}
        </span>
        {meta ? (
          <span className="mt-0.5 block truncate text-[12px] leading-snug text-foreground-muted">
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * /pages — Own-tab collection of directory pages (Albums-style grid).
 */
export default function PagesPage() {
  const { account } = useAuthSafe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const advertiseIntent = searchParams.get('intent') === 'advertise';

  const [pages, setPages] = useState<AccountOwnedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!account?.id) {
      setPages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAccountOwnedPages();
      setPages(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [account?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (pages.length <= 4) return pages;
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => {
      const hay = [p.title, p.pageTypeLabel, p.addressLine, p.slug, p.visibility, p.claimStatus]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [pages, query]);

  const openCreate = () => {
    router.push(PAGES_NEW_PATH);
  };

  const openView = (page: AccountOwnedPage) => {
    const path = directoryPageSharePath(page.slug) ?? `${PAGE_PATH}/${encodeURIComponent(page.id)}`;
    router.push(path);
  };

  const showSearch = pages.length > 4;
  const searching = showSearch && Boolean(query.trim());
  const countLabel = searching
    ? `${filtered.length} of ${pages.length}`
    : `${pages.length}`;

  return (
    <PageScroll onRefresh={account ? load : undefined}>
      <TopBar
        title="My Pages"
        trailing={
          <button
            type="button"
            onClick={openCreate}
            disabled={!account}
            className="px-1 text-[17px] font-semibold text-lake-blue transition active:opacity-60 disabled:opacity-40"
          >
            Create
          </button>
        }
        below={
          account && showSearch ? (
            <div className="flex items-center gap-2.5 border-b border-black/[0.08] px-4 pb-3">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search your pages</span>
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  className="h-9 w-full rounded-full border border-black/[0.08] bg-white pl-9 pr-3 text-[15px] text-foreground shadow-sm outline-none placeholder:text-foreground-muted"
                />
              </label>
              {!loading ? (
                <span className="shrink-0 text-[13px] tabular-nums text-foreground-muted">
                  {countLabel}
                </span>
              ) : null}
            </div>
          ) : undefined
        }
      />

      <div className="px-4 pb-10 pt-3">
        {account && advertiseIntent ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-lake-blue/20 bg-lake-blue/[0.06] px-3 py-2.5">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lake-blue ring-1 ring-lake-blue/15">
              <IconBillboard className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">Open a page to advertise</p>
              <p className="mt-0.5 text-[12px] leading-snug text-foreground-muted">
                Ads run from the page — pick one below, then tap Advertise.
              </p>
            </div>
          </div>
        ) : null}

        {!account ? (
          <div className="px-2 py-16 text-center">
            <p className="text-[16px] font-semibold text-foreground">Sign in to see your pages</p>
            <p className="mt-1 text-[13px] text-foreground-muted">
              Pages you create or claim land here.
            </p>
          </div>
        ) : null}

        {error ? (
          <button
            type="button"
            onClick={() => void load()}
            className="mb-3 w-full text-center text-[14px] font-semibold text-lake-blue"
          >
            {error} — tap to retry
          </button>
        ) : null}

        {loading && pages.length === 0 ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col">
                <div className="aspect-square animate-pulse rounded-[14px] bg-black/[0.06]" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-black/[0.06]" />
                <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-black/[0.05]" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && account && filtered.length === 0 ? (
          <div className="px-2 py-14 text-center">
            <p className="text-[16px] font-semibold text-foreground">
              {searching ? 'No matching pages' : 'No pages yet'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground-muted">
              {searching
                ? 'Try a different search.'
                : 'Create a local business, public figure, community, or event page.'}
            </p>
            {!searching ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-lake-blue px-4 py-2.5 text-[14px] font-semibold text-white transition active:scale-95"
              >
                <IconPlus className="h-4 w-4" />
                Create a page
              </button>
            ) : null}
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5">
            {filtered.map((page) => (
              <li key={page.id}>
                <PageCollectionTile page={page} onOpen={() => openView(page)} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </PageScroll>
  );
}
