'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAccountHandle, useAuthSafe } from '@/features/auth';
import {
  fetchAccountOwnedPages,
  type AccountOwnedPage,
} from '@/features/map/directory/accountPages';
import { PageAudienceChips } from '@/features/map/directory/PageAudienceChips';
import { PageLogoDisc } from '@/features/map/directory/PageLogoDisc';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconPlus, IconSearch } from '@/features/map/dockCore/core/icons';
import { DockSection, DockSkeletonRows } from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { pageAudienceChips } from '@/lib/directory/pageAudience';
import { ToolPrimaryButton } from '@/features/tools/core/toolUi';

/**
 * My pages — listings this account created or officially claimed.
 * Tap a row → page card. Create stays in the footer.
 */
export default function PageManagerDockCard() {
  const { openAccount, closeDockCard, openSubpage, openPageCard } = useMapDock();
  const { account } = useAuthSafe();
  const handle = getAccountHandle(account);

  const [pages, setPages] = useState<AccountOwnedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!account?.id) {
      setPages([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void fetchAccountOwnedPages(ac.signal)
      .then((rows) => {
        if (!ac.signal.aborted) setPages(rows);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setPages([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [account?.id]);

  const filtered = useMemo(() => {
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
    closeDockCard();
    openSubpage({
      title: 'Create a page',
      subtitle: 'Launch',
      kind: 'page-launch',
    });
  };

  const openView = (page: AccountOwnedPage) => {
    openPageCard(
      {
        id: page.id,
        kind: 'page',
        title: page.title,
        subtitle: page.addressLine ?? page.pageTypeLabel ?? undefined,
        kindLabel: page.pageTypeLabel ?? 'Page',
        summary: page.description ?? undefined,
        imageUrl: page.logoUrl,
      },
      { fromCard: 'page-manager' },
    );
  };

  return (
    <DockCardShell
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      title="My pages"
      subtitle={
        loading
          ? 'Loading…'
          : handle
            ? `${handle} · ${pages.length}`
            : `${pages.length} page${pages.length === 1 ? '' : 's'}`
      }
      footer={
        account ? (
          <ToolPrimaryButton onClick={openCreate}>
            <span className="inline-flex items-center gap-2">
              <IconPlus className="h-4 w-4" />
              Create a page
            </span>
          </ToolPrimaryButton>
        ) : null
      }
    >
      {!account ? (
        <DockSection title="Your pages" subtitle="Sign in to see pages you created or claimed.">
          <p className="px-0.5 text-[13px] text-foreground-muted">
            Local business, public figure, community, and event pages live here.
          </p>
        </DockSection>
      ) : (
        <>
          <div
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <IconSearch className="h-4 w-4 shrink-0 text-foreground-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your pages"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground-muted"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {error ? (
            <p className="px-1 text-center text-[13px] text-foreground-muted">{error}</p>
          ) : null}

          {loading && pages.length === 0 ? (
            <DockSection title="Your pages">
              <DockSkeletonRows count={4} />
            </DockSection>
          ) : filtered.length === 0 ? (
            <DockSection
              title="Your pages"
              subtitle={
                query.trim()
                  ? 'No matching pages'
                  : 'Nothing here yet — create your first page.'
              }
            >
              {!query.trim() ? (
                <p className="px-0.5 text-[13px] leading-relaxed text-foreground-muted">
                  Created pages show as Created until you claim them. Claimed pages show as Owner.
                </p>
              ) : null}
            </DockSection>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((page) => {
                const chips = pageAudienceChips({
                  claimStatus: page.claimStatus,
                  visibility: page.visibility,
                  status: page.status,
                  access: {
                    isCreator: page.isCreator,
                    isClaimedOwner: page.isClaimedOwner,
                  },
                });
                const line = [page.pageTypeLabel, page.addressLine].filter(Boolean).join(' · ');
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => openView(page)}
                    className={`flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-2.5 text-left transition active:scale-[0.99] hover:bg-map-glass-hover ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                  >
                    <PageLogoDisc
                      title={page.title}
                      logoUrl={page.logoUrl}
                      icon={page.icon}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-foreground">
                        {page.title}
                      </span>
                      {line ? (
                        <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">
                          {line}
                        </span>
                      ) : null}
                      <PageAudienceChips chips={chips} className="mt-1" />
                    </span>
                    <span className="text-foreground-muted" aria-hidden>
                      ›
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </DockCardShell>
  );
}
