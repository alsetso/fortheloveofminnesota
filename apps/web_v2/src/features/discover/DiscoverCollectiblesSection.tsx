'use client';

/**
 * Discover idle — collectible finds as a no-chrome horizontal strip:
 * 3D model, name, collected / total.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { useAuthSafe } from '@/features/auth';
import { DiscoverSectionHeader } from '@/features/discover/DiscoverChrome';
import {
  useAccountCollections,
  type CollectionsByModel,
} from '@/features/collections/useAccountCollections';
import { resolveWorldModelUrl, type WorldModelSlug } from '@/features/map/game/world';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';
import { DISCOVER_COLLECTIBLES_PATH } from '@/lib/routes/routePolicy';

const PREVIEW_LIMIT = 8;

function collectableModelUrl(slug: string, filePath?: string | null): string | null {
  const path = filePath?.trim();
  if (!path) return null;
  return resolveWorldModelUrl(path, slug as WorldModelSlug);
}

function CollectibleCard({ model }: { model: CollectionsByModel }) {
  const modelUrl = collectableModelUrl(model.slug, model.filePath);
  const progress =
    model.availableTotal > 0
      ? `${model.count.toLocaleString()} / ${model.availableTotal.toLocaleString()}`
      : `${model.count.toLocaleString()} found`;

  return (
    <Link
      href={DISCOVER_COLLECTIBLES_PATH}
      role="listitem"
      className="w-[104px] shrink-0 snap-start transition active:opacity-80"
    >
      <div className="flex h-[88px] w-full items-center justify-center">
        {modelUrl ? (
          <WorldModelPreviewCanvas
            url={modelUrl}
            transparent
            className="h-[88px] w-[88px]"
          />
        ) : (
          <span className="h-14 w-14 rounded-full bg-black/[0.06]" aria-hidden />
        )}
      </div>
      <div className="mt-1.5 space-y-0.5 px-0.5 text-center">
        <p className="truncate text-[13px] font-semibold leading-snug tracking-tight text-foreground">
          {model.name}
        </p>
        <p className="truncate text-[11px] tabular-nums text-foreground-muted">
          {progress}
        </p>
      </div>
    </Link>
  );
}

function EmptyHint({ children }: { children: string }) {
  return (
    <p className="px-5 pt-2.5 text-[13px] leading-snug text-foreground-muted">
      {children}
    </p>
  );
}

export function DiscoverCollectiblesSection() {
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const { collections, loading } = useAccountCollections(accountId);

  const preview = useMemo(() => {
    if (!collections?.byModel?.length) return [];
    return [...collections.byModel]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, PREVIEW_LIMIT);
  }, [collections]);

  return (
    <section className="pt-5">
      <DiscoverSectionHeader
        title="Collectibles"
        actionHref={DISCOVER_COLLECTIBLES_PATH}
      />

      {!accountId ? (
        <EmptyHint>Sign in to track items you find across Minnesota.</EmptyHint>
      ) : loading || !collections ? (
        <div
          className="mt-3 flex gap-3 overflow-x-hidden px-5"
          aria-hidden
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-[104px] shrink-0">
              <div className="mx-auto h-[88px] w-[88px] animate-pulse rounded-full bg-black/[0.05]" />
              <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-black/[0.05]" />
              <div className="mx-auto mt-1.5 h-2.5 w-10 animate-pulse rounded bg-black/[0.04]" />
            </div>
          ))}
        </div>
      ) : preview.length === 0 ? (
        <EmptyHint>Open the map and collect things around Minnesota.</EmptyHint>
      ) : (
        <div
          className="mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
          role="list"
        >
          {preview.map((model) => (
            <CollectibleCard key={model.slug} model={model} />
          ))}
        </div>
      )}
    </section>
  );
}
