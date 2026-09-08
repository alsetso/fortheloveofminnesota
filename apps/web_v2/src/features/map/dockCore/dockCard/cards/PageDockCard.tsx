'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DirectoryPageProfileBody,
  pageCardChipsFor,
} from '@/features/map/directory/DirectoryPageProfileBody';
import { PageCardIdentityHeader } from '@/features/map/directory/PageCardIdentityHeader';
import { fetchDirectoryPageDetail } from '@/features/map/directory';
import type { DirectoryPageDetail } from '@/lib/directory/directoryPageTypes';
import { canViewPrivatePage } from '@/lib/directory/pageAudience';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { ToolPrimaryButton } from '@/features/tools/core/toolUi';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { directoryPageAdvertisePath } from '@/lib/directory/pageContactLinks';

const ROW = `flex w-full items-center gap-3 rounded-[1.15rem] px-3.5 py-3.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`;

/**
 * Directory page card — compact identity in the sticky header.
 * Public facts in the body; creator / owner fields stay behind “Only you”.
 */
export default function PageDockCard() {
  const router = useRouter();
  const {
    pageCardEntity,
    pageReturnToCard,
    closeDockCard,
    openDockCard,
    openSubpage,
  } = useMapDock();
  const entity = pageCardEntity;

  const [page, setPage] = useState<DirectoryPageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entity?.id) {
      setPage(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void fetchDirectoryPageDetail(entity.id, ac.signal)
      .then((row) => {
        if (ac.signal.aborted) return;
        setPage(row);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Failed to load');
        setPage(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [entity?.id]);

  if (!entity) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] text-foreground-muted">No page selected.</p>
      </div>
    );
  }

  const title = page?.title ?? entity.title;
  const slug = page?.slug ?? null;
  const typeLine = [page?.pageTypeLabel ?? entity.kindLabel, page?.categoryName]
    .filter(Boolean)
    .join(' · ');
  const address = page?.addressLine ?? entity.subtitle ?? null;
  const privateView = page ? canViewPrivatePage(page.viewer) : false;

  const backLabel =
    pageReturnToCard === 'page-manager'
      ? 'My pages'
      : pageReturnToCard === 'directory-pages'
        ? 'Directory'
        : undefined;

  return (
    <DockCardShell
      variant="entity"
      scrollKey={entity.id}
      header={
        <PageCardIdentityHeader
          title={title}
          typeLine={typeLine}
          address={address}
          logoUrl={page?.logoUrl ?? entity.imageUrl}
          icon={page?.icon}
          chips={pageCardChipsFor(page)}
          verified={page?.isVerified}
          executive={page?.executivePass}
          backLabel={backLabel}
          onBack={pageReturnToCard ? () => openDockCard(pageReturnToCard) : undefined}
          onAdvertise={
            privateView
              ? () => {
                  const path = directoryPageAdvertisePath(slug ?? entity.id);
                  if (!path) return;
                  closeDockCard();
                  router.push(path);
                }
              : undefined
          }
        />
      }
      footer={
        privateView ? (
          <ToolPrimaryButton
            onClick={() => {
              closeDockCard();
              openSubpage({
                title,
                subtitle: 'Manage',
                kind: 'page-manage',
                slug: slug ?? entity.id,
              });
            }}
          >
            Manage page
          </ToolPrimaryButton>
        ) : null
      }
    >
      <DirectoryPageProfileBody
        page={page}
        loading={loading}
        error={error}
        fallback={{
          title: entity.title,
          typeLabel: entity.kindLabel,
          address: entity.subtitle,
          summary: entity.summary,
          logoUrl: entity.imageUrl,
        }}
        privateActions={
          pageReturnToCard !== 'page-manager' ? (
            <button
              type="button"
              className={ROW}
              onClick={() => {
                closeDockCard();
                openDockCard('page-manager');
              }}
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
          ) : null
        }
      />
    </DockCardShell>
  );
}
