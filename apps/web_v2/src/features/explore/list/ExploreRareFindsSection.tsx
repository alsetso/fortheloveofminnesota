'use client';

/**
 * Explore — world objects: hearts (always) + rare finds (after first claim).
 * Heart stats sit under a hearts title with the 3D model; rares list below.
 * Tapping any object opens the shared collectible popup.
 */

import { useMemo, type ReactNode } from 'react';
import { ExploreStat } from '@/features/explore/list/ExploreSection';
import type { TodayRecord } from '@/features/today/records/records';
import type {
  CollectionsByModel,
  CollectionsState,
  HeartsInUnlockedCtus,
  HeartsProgress,
} from '@/features/collections/useAccountCollections';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';
import { resolveWorldModelUrl, type WorldModelSlug } from '@/features/map/game/world/catalog';

const HEART_SLUG = 'heart-quaternius';
const HEART_FALLBACK_URL = '/models/props/heart-quaternius.glb';

/** Preferred order for known rares; anything else follows alphabetically. */
const RARE_SLUG_ORDER = ['coin-quaternius', 'treasure-chest-safayan'] as const;

function collectableModelUrl(slug: string, filePath?: string | null): string | null {
  const path = filePath?.trim();
  if (!path) return null;
  return resolveWorldModelUrl(path, slug as WorldModelSlug);
}

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-black/[0.06] ${className ?? ''}`} />;
}

function HeartStat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | null;
  loading: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      {loading || value == null ? (
        <Pulse className="h-6 w-10" />
      ) : (
        <p className="text-[22px] font-bold tabular-nums tracking-tight text-foreground">
          {value.toLocaleString()}
        </p>
      )}
      <p className="mt-0.5 text-[11px] font-medium leading-snug text-foreground-muted">
        {label}
      </p>
    </div>
  );
}

function HeartsStatsGrid({
  hearts,
  heartsInUnlockedCtus,
  loading,
}: {
  hearts: HeartsProgress | null;
  heartsInUnlockedCtus: HeartsInUnlockedCtus | null;
  loading: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <HeartStat
          label="Ready in your cities"
          value={loading ? null : (heartsInUnlockedCtus?.remaining ?? 0)}
          loading={loading}
        />
        <HeartStat
          label="Beyond your passport"
          value={loading ? null : (heartsInUnlockedCtus?.remainingOutside ?? 0)}
          loading={loading}
        />
        <HeartStat
          label="Collected there"
          value={loading ? null : (heartsInUnlockedCtus?.collected ?? 0)}
          loading={loading}
        />
        <HeartStat
          label="Statewide stock"
          value={loading ? null : (hearts?.available ?? 0)}
          loading={loading}
        />
      </div>
      <p className="mt-2.5 text-[12px] leading-snug text-foreground-muted">
        Ready in your cities can be claimed now — beyond your passport opens as you stamp new
        places.
      </p>
    </div>
  );
}

function ObjectFindCard({
  model,
  subtitle,
  rare,
  onOpen,
}: {
  model: CollectionsByModel;
  subtitle: string;
  rare?: boolean;
  onOpen: () => void;
}) {
  const modelUrl = collectableModelUrl(model.slug, model.filePath);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] bg-black/[0.04] px-4 py-3.5 text-left transition active:bg-black/[0.07]"
    >
      <div className="flex items-center gap-3">
        {modelUrl ? (
          <WorldModelPreviewCanvas
            url={modelUrl}
            transparent
            className="h-11 w-11 shrink-0"
          />
        ) : (
          <span className="h-11 w-11 shrink-0 rounded-[10px] bg-black/[0.06]" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {model.name}
            {rare ? (
              <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                Rare
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[12px] text-foreground-muted">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        <ExploreStat label="Found" value={model.count} />
        <ExploreStat label="Left on map" value={model.remaining} />
        <ExploreStat label="Total stock" value={model.availableTotal} />
      </div>
    </button>
  );
}

type Props = {
  accountId: string | null;
  collections: CollectionsState | null;
  collectionsLoading: boolean;
  query?: string;
  onSelectRecord: (record: TodayRecord) => void;
};

export function ExploreRareFindsSection({
  accountId,
  collections,
  collectionsLoading,
  query = '',
  onSelectRecord,
}: Props) {
  const q = query.trim().toLowerCase();
  const pending = Boolean(accountId) && collectionsLoading && !collections;

  const heartModel = useMemo(
    () => (collections?.byModel ?? []).find((m) => m.slug === HEART_SLUG) ?? null,
    [collections?.byModel],
  );

  const heartPreviewUrl =
    collectableModelUrl(heartModel?.slug ?? HEART_SLUG, heartModel?.filePath) ??
    HEART_FALLBACK_URL;

  const rares = useMemo(() => {
    const models = (collections?.byModel ?? []).filter((m) => m.rare && m.count > 0);
    const order = new Map<string, number>(RARE_SLUG_ORDER.map((slug, i) => [slug, i]));
    const sorted = [...models].sort((a, b) => {
      const ai = order.get(a.slug) ?? 100;
      const bi = order.get(b.slug) ?? 100;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
    if (!q) return sorted;
    return sorted.filter((m) => {
      const name = m.name.toLowerCase();
      const slug = m.slug.toLowerCase();
      if (name.includes(q) || slug.includes(q)) return true;
      if (q === 'rare' || q === 'rares') return true;
      if (q.includes('credit') || q.includes('coin')) return slug.includes('coin');
      if (q.includes('chest') || q.includes('treasure')) return slug.includes('chest');
      return false;
    });
  }, [collections?.byModel, q]);

  const heartsMatchQuery =
    !q ||
    q.includes('heart') ||
    q === 'object' ||
    q === 'objects' ||
    q === 'find' ||
    q === 'finds';

  const showHeartsBlock = !q || heartsMatchQuery;
  const showRares = !pending && rares.length > 0;

  const openCollectable = (model: CollectionsByModel) => {
    onSelectRecord({
      kind: 'collectable',
      model,
      recent: (collections?.recent ?? []).filter((item) => item.model?.slug === model.slug),
      hearts: collections?.hearts ?? null,
      heartsInUnlockedCtus: collections?.heartsInUnlockedCtus ?? null,
    });
  };

  if (!accountId) return null;
  if (q && !showHeartsBlock && rares.length === 0) return null;

  const leftInCities = collections?.heartsInUnlockedCtus?.remaining ?? 0;
  const heartSupporting =
    leftInCities > 0
      ? `${leftInCities.toLocaleString()} hearts waiting in your stamped cities & towns`
      : 'Find hearts and rare objects as you roam — they store here in your backpack.';

  let header: ReactNode = null;
  if (showHeartsBlock) {
    header = (
      <button
        type="button"
        onClick={() => {
          if (!heartModel) return;
          openCollectable(heartModel);
        }}
        disabled={!heartModel}
        className="flex w-full items-center gap-3.5 text-left transition active:opacity-70 disabled:active:opacity-100"
      >
        <WorldModelPreviewCanvas
          url={heartPreviewUrl}
          transparent
          className="h-14 w-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
            Collectibles
          </p>
          <h2 className="mt-0.5 text-[22px] font-bold tracking-tight text-foreground">
            Your backpack
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-foreground-muted">{heartSupporting}</p>
        </div>
      </button>
    );
  } else if (showRares) {
    header = (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
          Collectibles
        </p>
        <h2 className="mt-0.5 text-[22px] font-bold tracking-tight text-foreground">
          Your backpack
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-foreground-muted">
          Rare objects you&apos;ve found scattered across the state.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="px-5">{header}</div>

      <div className="mt-3 space-y-4 px-5">
        {showHeartsBlock ? (
          <HeartsStatsGrid
            hearts={collections?.hearts ?? null}
            heartsInUnlockedCtus={collections?.heartsInUnlockedCtus ?? null}
            loading={pending}
          />
        ) : null}

        {pending && showHeartsBlock ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading objects">
            <div className="rounded-[18px] bg-black/[0.04] px-4 py-3.5">
              <div className="flex items-center gap-3">
                <Pulse className="h-11 w-11 shrink-0 rounded-[10px]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Pulse className="h-3.5 w-28" />
                  <Pulse className="h-3 w-36" />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showRares ? (
          <div className="space-y-3">
            {rares.map((model) => {
              const done = model.availableTotal > 0 && model.count >= model.availableTotal;
              return (
                <ObjectFindCard
                  key={model.slug}
                  model={model}
                  rare
                  subtitle={
                    done
                      ? 'All found on the map'
                      : model.remaining > 0
                        ? `${model.remaining.toLocaleString()} left on the map`
                        : 'No placements yet'
                  }
                  onOpen={() => openCollectable(model)}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
