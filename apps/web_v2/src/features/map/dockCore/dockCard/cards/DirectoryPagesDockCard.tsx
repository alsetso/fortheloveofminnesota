'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  setDirectoryPagesVisible,
  useDirectoryPagesVisible,
  fetchDirectoryPages,
} from '@/features/map/directory';
import { DockCardSubHeader } from '@/features/map/dockCore/dockCard/DockCardSubHeader';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { DockLayerGroupCard, DockLayerToggle } from '@/features/map/dockCore/shell/DockLayerToggle';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { IconSearch } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import type { DirectoryPagePin } from '@/lib/directory/directoryPageTypes';
import { isPageLogoHttpUrl } from '@/lib/directory/pageTypes';

/**
 * Directory pages layer toggle + searchable list.
 * Back → Game controls card, or Explore browse (close).
 */
export default function DirectoryPagesDockCard() {
  const { openDockCard, openPageCard } = useMapDock();
  const backToParent = () => openDockCard('controls');
  const pagesOn = useDirectoryPagesVisible();
  const [pages, setPages] = useState<DirectoryPagePin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void fetchDirectoryPages(ac.signal)
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
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => {
      const hay = [p.title, p.pageTypeLabel, p.addressLine, p.slug]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [pages, query]);

  return (
    <DockCardShell
      header={
        <div className="space-y-4">
          <DockCardSubHeader
            onBack={backToParent}
            eyebrow="Map controls"
            title="Directory pages"
            subtitle={
              loading
                ? 'Loading…'
                : `${filtered.length.toLocaleString()} page${filtered.length === 1 ? '' : 's'}`
            }
          />
          <div
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <IconSearch className="h-4 w-4 shrink-0 text-foreground-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground-muted"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </div>
      }
    >
      <DockLayerGroupCard>
        <DockLayerToggle
          label="Show on map"
          on={pagesOn}
          onClick={() => setDirectoryPagesVisible(!pagesOn)}
          hint="Business & community logos"
        />
      </DockLayerGroupCard>

      {error ? (
        <p className="px-1 text-center text-[13px] text-foreground-muted">{error}</p>
      ) : null}

      <div className="space-y-2">
        {loading && pages.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            Loading directory…
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-foreground-muted">
            {query.trim() ? 'No matching pages' : 'No directory pages yet'}
          </p>
        ) : (
          filtered.map((page) => {
            const logo =
              page.logoUrl && isPageLogoHttpUrl(page.logoUrl) ? page.logoUrl : null;
            const emoji =
              page.icon && !isPageLogoHttpUrl(page.icon) ? page.icon : null;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() =>
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
                    { fromCard: 'directory-pages' },
                  )
                }
                className={`flex w-full items-center gap-3 rounded-[1.15rem] px-3 py-3 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-950/30 text-foreground">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="h-full w-full object-cover" />
                  ) : emoji ? (
                    <span className="text-lg" aria-hidden>
                      {emoji}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold">
                      {page.title.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">
                    {page.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-foreground-muted">
                    {[page.pageTypeLabel, page.addressLine].filter(Boolean).join(' · ') ||
                      page.slug}
                  </span>
                </span>
                <span className="text-foreground-muted" aria-hidden>
                  ›
                </span>
              </button>
            );
          })
        )}
      </div>
    </DockCardShell>
  );
}
