'use client';

import { useEffect, useState } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { DirectoryPageProfileBody } from '@/features/map/directory/DirectoryPageProfileBody';
import { fetchDirectoryPageDetail } from '@/features/map/directory';
import type { DirectoryPageDetail } from '@/lib/directory/directoryPageTypes';
import { canViewPrivatePage } from '@/lib/directory/pageAudience';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

const ROW = `flex w-full items-center gap-3 rounded-[1.15rem] px-3.5 py-3.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`;

/**
 * User-generated page detail — dock pane fallback (map card is the primary surface).
 */
export default function DockPageDetailSection({ entity }: { entity: DockEntity }) {
  const { openSubpage, openDockCard } = useMapDock();
  const [page, setPage] = useState<DirectoryPageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    void fetchDirectoryPageDetail(entity.id, ac.signal)
      .then((row) => {
        if (!ac.signal.aborted) setPage(row);
      })
      .catch(() => {
        if (!ac.signal.aborted) setPage(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [entity.id]);

  const title = page?.title ?? entity.title;
  const slug = page?.slug ?? null;
  const privateView = page ? canViewPrivatePage(page.viewer) : false;

  return (
    <DirectoryPageProfileBody
      page={page}
      loading={loading}
      fallback={{
        title: entity.title,
        typeLabel: entity.kindLabel,
        address: entity.subtitle,
        summary: entity.summary,
        logoUrl: entity.imageUrl,
      }}
      privateActions={
        privateView ? (
          <>
            <button
              type="button"
              className={ROW}
              onClick={() =>
                openSubpage({
                  title,
                  subtitle: 'Manage',
                  kind: 'page-manage',
                  slug: slug ?? entity.id,
                })
              }
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-foreground">Manage page</span>
                <span className="mt-0.5 block text-[13px] text-foreground-muted">
                  {slug ? `/${slug}` : 'Owner settings'}
                </span>
              </span>
              <span className="text-foreground-muted" aria-hidden>
                ›
              </span>
            </button>
            <button
              type="button"
              className={ROW}
              onClick={() => openDockCard('page-manager')}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-foreground">My pages</span>
                <span className="mt-0.5 block text-[13px] text-foreground-muted">
                  Pages you created or claimed
                </span>
              </span>
              <span className="text-foreground-muted" aria-hidden>
                ›
              </span>
            </button>
          </>
        ) : null
      }
    />
  );
}
