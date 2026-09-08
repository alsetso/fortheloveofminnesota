'use client';

/**
 * /discover/collectibles — per-model find progress (from Insights Today).
 */

import { useState, type HTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { useAuthSafe } from '@/features/auth';
import {
  useAccountCollections,
  type CollectionsByModel,
} from '@/features/collections/useAccountCollections';
import { IconArrowLeft, IconChevronRight } from '@/features/map/dockCore/core/icons';
import { resolveWorldModelUrl, type WorldModelSlug } from '@/features/map/game/world';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';
import { TodayRecordHost, type TodayRecord } from '@/features/today/records';
import { safePadTop } from '@/lib/despia/safeArea';
import { DISCOVER_PATH } from '@/lib/routes/routePolicy';

const HEART_SLUG = 'heart-quaternius';

function Pulse({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-black/[0.06] ${className ?? ''}`}
      {...rest}
    />
  );
}

function collectableModelUrl(slug: string, filePath?: string | null): string | null {
  const path = filePath?.trim();
  if (!path) return null;
  return resolveWorldModelUrl(path, slug as WorldModelSlug);
}

function ProgressBar({
  value,
  max,
  tone = 'lake',
}: {
  value: number;
  max: number;
  tone?: 'lake' | 'rose';
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar = tone === 'rose' ? 'bg-[#c45c6a]' : 'bg-lake-blue';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.08]">
      <span
        className={`block h-full rounded-full transition-[width] duration-500 ${bar}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CollectableRow({
  model,
  onOpen,
}: {
  model: CollectionsByModel;
  onOpen: () => void;
}) {
  const done = model.availableTotal > 0 && model.count >= model.availableTotal;
  const modelUrl = collectableModelUrl(model.slug, model.filePath);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full py-3.5 text-left transition active:opacity-70"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {modelUrl ? (
            <WorldModelPreviewCanvas
              url={modelUrl}
              transparent
              className="h-11 w-11 shrink-0"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {model.name}
              {model.rare ? (
                <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Rare
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[12px] text-foreground-muted">
              {done
                ? 'All found on the map'
                : model.remaining > 0
                  ? `${model.remaining} left on the map`
                  : 'No placements yet'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {model.xp > 0 ? (
            <p className="text-[13px] font-semibold tabular-nums text-lake-blue">
              +{model.xp} XP
            </p>
          ) : null}
          <p
            className={`text-[13px] font-semibold tabular-nums text-foreground ${
              model.xp > 0 ? 'mt-0.5' : ''
            }`}
          >
            {model.count}
            <span className="font-medium text-foreground-muted">
              {' '}
              / {model.availableTotal}
            </span>
          </p>
        </div>
        <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted opacity-70" />
      </div>
      <div className="mt-2.5">
        <ProgressBar
          value={model.count}
          max={model.availableTotal}
          tone={model.slug === HEART_SLUG ? 'rose' : 'lake'}
        />
      </div>
    </button>
  );
}

export default function DiscoverCollectiblesPage() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const { collections, loading: collectionsLoading } =
    useAccountCollections(accountId);
  const [selectedRecord, setSelectedRecord] = useState<TodayRecord | null>(null);

  const collectionsPending =
    Boolean(accountId) && (collectionsLoading || !collections);
  const collectibleModels = collections?.byModel ?? [];

  return (
    <PageScroll>
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]"
        style={{ paddingTop: safePadTop('0.2rem') }}
      >
        <div className="relative flex h-11 items-center px-3">
          <button
            type="button"
            onClick={() => router.push(DISCOVER_PATH)}
            aria-label="Back to Discover"
            className="relative z-[1] inline-flex h-9 items-center gap-0.5 rounded-full px-1.5 text-lake-blue transition active:opacity-70"
          >
            <IconArrowLeft className="h-5 w-5" />
            <span className="text-[16px] font-semibold">Discover</span>
          </button>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-bold tracking-tight text-foreground">
            Collectibles
          </h1>
          <div className="ml-auto w-[88px]" aria-hidden />
        </div>
      </header>

      <div className="pb-10 pt-4">
        {!accountId ? (
          <p className="px-5 text-[14px] leading-snug text-foreground-muted">
            Sign in to track finds across Minnesota.
          </p>
        ) : (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2 px-5">
              <p className="text-[14px] leading-snug text-foreground-muted">
                Finds you’ve claimed on the map.
              </p>
              {!collectionsPending && collections ? (
                <p className="shrink-0 text-[12px] text-foreground-muted">
                  {collections.total} of {collections.availableTotal}
                </p>
              ) : null}
            </div>

            {collectionsPending ? (
              <div
                className="mt-2 space-y-3 px-5"
                aria-busy="true"
                aria-label="Loading collectibles"
              >
                {[0, 1, 2].map((i) => (
                  <div key={i} className="py-3.5">
                    <div className="flex items-center gap-3">
                      <Pulse className="h-11 w-11 shrink-0 rounded-[10px]" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Pulse className="h-3.5 w-28" />
                        <Pulse className="h-3 w-20" />
                      </div>
                      <Pulse className="h-3.5 w-12" />
                    </div>
                    <Pulse className="mt-2.5 h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : collectibleModels.length > 0 ? (
              <div className="mt-1 divide-y divide-black/[0.06] px-5">
                {collectibleModels.map((m) => (
                  <CollectableRow
                    key={m.slug}
                    model={m}
                    onOpen={() =>
                      setSelectedRecord({
                        kind: 'collectable',
                        model: m,
                        recent: (collections?.recent ?? []).filter(
                          (item) => item.model?.slug === m.slug,
                        ),
                        hearts: collections?.hearts ?? null,
                        heartsInUnlockedCtus:
                          collections?.heartsInUnlockedCtus ?? null,
                      })
                    }
                  />
                ))}
              </div>
            ) : !collectionsLoading && collections ? (
              <p className="mt-4 px-5 text-[14px] text-foreground-muted">
                Open the map and tap a collectible to start finding things.
              </p>
            ) : null}
          </>
        )}
      </div>

      <TodayRecordHost
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </PageScroll>
  );
}
