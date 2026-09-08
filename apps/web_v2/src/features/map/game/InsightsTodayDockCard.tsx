'use client';

/**
 * Insights Today — Today page content surfaced inside the Game dock card.
 * Pulls the same data as /today but renders in the dock card format.
 * No location map card (you're already on the map) and no page chrome.
 * The /today route can be gated to dev-only while this card remains
 * available inside the game for all authenticated users.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
} from 'react';
import {
  formatUnlockedPct,
  passportStanding,
} from '@/features/explore/shared/AreasPlacesSection';
import { TodayRecordHost, type TodayRecord } from '@/features/today/records';
import { useAuthSafe } from '@/features/auth';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import {
  useAccountCollections,
  type CollectionsByModel,
} from '@/features/collections/useAccountCollections';
import { formatRelativeTime } from '@/features/community/pinPostApi';
import { invalidateStanding } from '@/lib/standing/invalidateStanding';
import { getLevelTier } from '@/features/xp/logic/levelTiers';
import { useAccountLevel } from '@/features/xp/logic/useAccountLevel';
import { useAccountStreak } from '@/features/streaks/useAccountStreak';
import {
  claimAllXp,
  getPendingXpSnapshot,
  refreshPendingXp,
  subscribePendingXp,
  type ClaimXpResult,
  type PendingXpState,
} from '@/features/xp/store/pendingXpStore';
import { XpClaimedSuccessModal } from '@/features/xp/modals/XpClaimedSuccessModal';
import {
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
} from '@/features/map/dockCore/core/icons';
import { resolveWorldModelUrl, type WorldModelSlug } from '@/features/map/game/world';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';

// ─── Shared helpers (mirrors former Today helpers) ────────────────────────────

const EMPTY_PENDING_XP: PendingXpState = { total: 0, count: 0, items: [], loading: false };

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

const KIND_SHORT: Record<string, string> = {
  district: 'District',
  county: 'County',
  ctu: 'City / township',
  school_district: 'School district',
  senate_district: 'Senate',
  house_district: 'House',
};

const HEART_SLUG = 'heart-quaternius';

function ProgressBar({
  value,
  max,
  tone = 'lake',
}: {
  value: number;
  max: number;
  tone?: 'lake' | 'rose' | 'moss';
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const bar =
    tone === 'rose'
      ? 'bg-[#c45c6a]'
      : tone === 'moss'
        ? 'bg-[#3d5a40]'
        : 'bg-lake-blue';
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
            <p className="text-[13px] font-semibold tabular-nums text-lake-blue">+{model.xp} XP</p>
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

function StandingMetricSkeleton({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <Pulse className={`h-[22px] ${wide ? 'w-14' : 'w-16'}`} />
      <p className="mt-1 text-[12px] font-medium text-foreground-muted">{label}</p>
    </div>
  );
}

function StandingMetric({
  label,
  collected,
  available,
}: {
  label: string;
  collected: number;
  available: number;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="flex items-baseline gap-1 tabular-nums leading-none tracking-tight text-foreground">
        <span className="text-[22px] font-bold">{collected.toLocaleString()}</span>
        <span className="text-[13px] font-normal text-foreground-muted">
          /{available.toLocaleString()}
        </span>
      </p>
      <p className="mt-1 text-[12px] font-medium text-foreground-muted">{label}</p>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function InsightsTodayDockCard({
  embedded = false,
}: {
  /** Body only — used inside Standing segments (no outer shell). */
  embedded?: boolean;
}) {
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;

  const { level, loading: levelLoading } = useAccountLevel(accountId);
  const { passport, loading: passportLoading } = usePassport(accountId);
  const { collections, loading: collectionsLoading } = useAccountCollections(accountId);
  const { refresh: refreshStreak } = useAccountStreak(accountId);
  const pendingXp = useSyncExternalStore(
    subscribePendingXp,
    getPendingXpSnapshot,
    () => EMPTY_PENDING_XP,
  );
  const [claimingXp, setClaimingXp] = useState(false);
  const [unclaimedOpen, setUnclaimedOpen] = useState(false);
  const [selected, setSelected] = useState<TodayRecord | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<{
    result: ClaimXpResult;
    sources: { id: string; name: string; detail?: string; amount: number }[];
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (accountId) void refreshPendingXp();
  }, [accountId]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    invalidateStanding();
    refreshStreak();
    await refreshPendingXp();
    setRefreshing(false);
  }, [refreshing, refreshStreak]);

  const tier = level ? getLevelTier(level.level) : null;
  const levelPending = Boolean(accountId) && !level;
  const collectionsPending = Boolean(accountId) && !collections;
  const passportPending = Boolean(accountId) && !passport;
  const activityPending = levelPending || collectionsPending;
  const loading = Boolean(accountId) && (levelLoading || passportLoading || collectionsLoading);

  const xpSpan = level ? Math.max(1, level.xpForNextLevel - level.xpForCurrentLevel) : 0;
  const xpIntoLevel = level
    ? Math.min(xpSpan, Math.max(0, level.totalXp - level.xpForCurrentLevel))
    : 0;
  const xpToNext = level ? Math.max(0, level.xpForNextLevel - level.totalXp) : 0;
  const collectibleModels = collections?.byModel ?? [];

  const standingLine = level ? `Level ${level.level} · ${level.totalXp} XP total` : null;

  const activityRows = useMemo(() => {
    const rows: {
      id: string;
      title: string;
      subtitle: string;
      at: string;
      accent: 'lake' | 'rose';
      record: TodayRecord;
    }[] = [];

    for (const item of level?.recentActivity ?? []) {
      if (item.sourceType === 'collect') continue;
      const name = item.name ?? item.label;
      const kindDetail =
        item.referenceType && KIND_SHORT[item.referenceType]
          ? KIND_SHORT[item.referenceType]
          : item.label;
      rows.push({
        id: `xp-${item.id}`,
        title: name,
        subtitle: `+${item.amount} XP · ${item.label}`,
        at: item.claimedAt ?? item.createdAt,
        accent: 'lake',
        record: {
          kind: 'activity',
          title: 'Claimed!',
          rewardLine: `+${item.amount} XP`,
          standingLine: standingLine ?? `+${item.amount} XP claimed`,
          sources: [{ id: item.id, name, detail: kindDetail, amount: item.amount }],
        },
      });
    }

    for (const item of collections?.recent ?? []) {
      const name = item.model?.name ?? 'Find';
      const claimKind = item.kind ?? 'collect';
      const rewardBits: string[] = [];
      if (item.reward?.type === 'hearts' && item.reward.amount) {
        rewardBits.push(`+${item.reward.amount} heart${item.reward.amount === 1 ? '' : 's'}`);
      } else if (item.reward?.type === 'credits' && item.reward.amount) {
        rewardBits.push(`+${item.reward.amount} credit${item.reward.amount === 1 ? '' : 's'}`);
      }
      if (item.reward?.xp) rewardBits.push(`+${item.reward.xp} XP`);
      const rewardLine =
        rewardBits.length > 0 ? rewardBits.join(' · ') : 'Added to your collection';
      const heartsLine =
        item.reward?.type === 'hearts' && collections?.hearts
          ? `${collections.hearts.collected} of ${collections.hearts.available} hearts · `
          : '';
      // Kind-aware copy: "Found" for landmarks, "Checked in" for check-ins, "Collected" for consumables
      const actionLabel =
        claimKind === 'find'     ? 'Found'
        : claimKind === 'check_in' ? 'Checked in'
        : claimKind === 'redeem'   ? 'Redeemed'
        : 'Collected';
      const successTitle =
        claimKind === 'find'     ? 'Found!'
        : claimKind === 'check_in' ? 'Checked in!'
        : 'Collected!';
      rows.push({
        id: `col-${item.id}`,
        title: name,
        subtitle: `${actionLabel} · ${rewardLine}`,
        at: item.collectedAt,
        accent: 'rose',
        record: {
          kind: 'activity',
          title: successTitle,
          rewardLine,
          standingLine: `${heartsLine}${standingLine ?? 'In your collection'}`,
        },
      });
    }

    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return rows.slice(0, 20);
  }, [level?.recentActivity, collections?.recent, collections?.hearts, standingLine]);

  const { unlockedTotal, areasAvailable, minnesotaUnlockedPct } = useMemo(
    () => passportStanding(passport),
    [passport],
  );

  // CTU is the primary "unlocked" surface — cities & towns users actually visit.
  const ctuKind = useMemo(
    () => passport?.kinds.find((k) => k.unitKind === 'ctu') ?? null,
    [passport],
  );

  // Header right — refresh button
  const headerRight = (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label="Refresh insights"
      className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition active:bg-black/[0.05] disabled:opacity-40"
    >
      <IconRefresh
        className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
      />
    </button>
  );

  const body = (
        <div className="space-y-8 pb-2">
          {/* ── Standing ─────────────────────────────────────────────────── */}
          {accountId ? (
            <section className="px-1">
              {levelPending ? (
                <div className="space-y-3" aria-busy="true" aria-label="Loading level">
                  <Pulse className="h-4 w-24" />
                  <Pulse className="h-12 w-20" />
                  <Pulse className="h-2.5 w-full rounded-full" />
                  <Pulse className="h-3 w-40" />
                  <div className="mt-5 flex items-baseline gap-8">
                    <StandingMetricSkeleton label="Hearts" />
                    <StandingMetricSkeleton label="Areas" />
                    <StandingMetricSkeleton label="Of Minnesota Unlocked" wide />
                  </div>
                </div>
              ) : level && tier ? (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[13px] font-medium text-foreground-muted">{tier.name}</p>
                      <button
                        type="button"
                        onClick={() => setSelected({ kind: 'level', level })}
                        className="mt-0.5 text-left transition active:opacity-70"
                        aria-label={`Level ${level.level} details`}
                      >
                        <span className="block text-[48px] font-bold leading-none tabular-nums tracking-tight text-foreground">
                          {level.level}
                        </span>
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1 pb-1">
                      {embedded ? headerRight : null}
                      <div className="text-right">
                        <p className="text-[22px] font-bold tabular-nums text-foreground">
                          {level.totalXp.toLocaleString()}
                        </p>
                        <p className="text-[12px] font-medium text-foreground-muted">total XP</p>
                      </div>
                    </div>
                  </div>

                  {level.level < 99 ? (
                    <>
                      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
                        <span
                          className="block h-full rounded-full bg-lake-blue transition-[width] duration-500"
                          style={{ width: `${Math.round(level.progressPct * 100)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[12px] tabular-nums text-foreground-muted">
                        {xpIntoLevel} / {xpSpan} XP
                        {xpToNext > 0
                          ? ` · ${xpToNext} to Level ${level.level + 1}`
                          : ` · Level ${level.level + 1} reached`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-[12px] text-foreground-muted">Max level reached</p>
                  )}

                  <div
                    className="mt-5 flex items-baseline gap-8"
                    aria-busy={collectionsPending || passportPending || undefined}
                  >
                    {collectionsPending ? (
                      <StandingMetricSkeleton label="Hearts" />
                    ) : (
                      <StandingMetric
                        label="Hearts"
                        collected={collections!.hearts.collected}
                        available={collections!.hearts.available}
                      />
                    )}
                    {passportPending || ctuKind == null ? (
                      <StandingMetricSkeleton label="Cities & towns" />
                    ) : (
                      <StandingMetric
                        label="Cities & towns"
                        collected={ctuKind.unlocked}
                        available={ctuKind.total}
                      />
                    )}
                    {passportPending ||
                    minnesotaUnlockedPct == null ||
                    unlockedTotal == null ||
                    areasAvailable == null ? (
                      <StandingMetricSkeleton label="Of Minnesota Unlocked" wide />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setSelected({
                            kind: 'minnesota',
                            areasUnlocked: unlockedTotal,
                            areasAvailable,
                            kinds: passport?.kinds ?? [],
                          })
                        }
                        className="min-w-0 flex-1 text-left transition active:opacity-70"
                        aria-label={`${formatUnlockedPct(minnesotaUnlockedPct)} of Minnesota unlocked`}
                      >
                        <p className="text-[22px] font-bold leading-none tabular-nums tracking-tight text-foreground">
                          {formatUnlockedPct(minnesotaUnlockedPct)}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-foreground-muted">
                          Of Minnesota Unlocked
                        </p>
                      </button>
                    )}
                  </div>
                </>
              ) : null}

              {/* Unclaimed XP */}
              {pendingXp.count > 0 ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-[15px] font-semibold tracking-tight text-foreground">
                      Unclaimed +{pendingXp.total.toLocaleString()} XP
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={claimingXp}
                        onClick={async () => {
                          const sources = pendingXp.items.map((item) => ({
                            id: item.id,
                            name: item.name,
                            detail: item.sourceLabel,
                            amount: item.amount,
                          }));
                          setClaimingXp(true);
                          const result = await claimAllXp();
                          setClaimingXp(false);
                          if (result) {
                            setClaimSuccess({ result, sources });
                            setUnclaimedOpen(false);
                            refreshStreak();
                          }
                        }}
                        className="rounded-full bg-lake-blue px-3.5 py-2 text-[13px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
                      >
                        {claimingXp ? 'Claiming…' : 'Claim all'}
                      </button>
                      <button
                        type="button"
                        aria-expanded={unclaimedOpen}
                        aria-label={
                          unclaimedOpen ? 'Hide unclaimed sources' : 'Show unclaimed sources'
                        }
                        onClick={() => setUnclaimedOpen((o) => !o)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted transition active:bg-black/[0.05]"
                      >
                        <IconChevronDown
                          className={`h-5 w-5 transition-transform duration-200 ${
                            unclaimedOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  {unclaimedOpen ? (
                    <ul className="mt-3 max-h-48 space-y-0.5 overflow-y-auto">
                      {pendingXp.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelected({ kind: 'pending_xp', item })}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left transition active:bg-black/[0.04]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-medium text-foreground">
                                {item.name}
                              </p>
                              <p className="mt-0.5 truncate text-[12px] text-foreground-muted">
                                {item.sourceLabel}
                              </p>
                            </div>
                            <span className="shrink-0 text-[14px] font-semibold tabular-nums text-lake-blue">
                              +{item.amount}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ── Collectibles ─────────────────────────────────────────────── */}
          {accountId ? (
            <section>
              <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
                <p className="text-[13px] font-semibold text-foreground">Collectibles</p>
                {!collectionsPending && collections ? (
                  <p className="text-[12px] text-foreground-muted">
                    {collections.total} of {collections.availableTotal} on the map
                  </p>
                ) : null}
              </div>

              {collectionsPending ? (
                <div className="space-y-3 px-1" aria-busy="true" aria-label="Loading collectibles">
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
                <div className="divide-y divide-black/[0.06] px-1">
                  {collectibleModels.map((m) => (
                    <CollectableRow
                      key={m.slug}
                      model={m}
                      onOpen={() =>
                        setSelected({
                          kind: 'collectable',
                          model: m,
                          recent: (collections?.recent ?? []).filter(
                            (item) => item.model?.slug === m.slug,
                          ),
                          hearts: collections?.hearts ?? null,
                          heartsInUnlockedCtus: collections?.heartsInUnlockedCtus ?? null,
                        })
                      }
                    />
                  ))}
                </div>
              ) : !collectionsLoading && collections ? (
                <p className="px-1 text-[14px] text-foreground-muted">
                  Open the map and tap a collectible to start finding things.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* ── Recent activity ──────────────────────────────────────────── */}
          {accountId ? (
            <section className="px-1">
              <p className="text-[13px] font-semibold text-foreground">Recent activity</p>
              {activityPending ? (
                <ul className="mt-2 space-y-2" aria-busy="true" aria-label="Loading activity">
                  {[0, 1, 2, 3].map((i) => (
                    <li key={i} className="flex items-center gap-2.5 py-1.5">
                      <Pulse className="h-1.5 w-1.5 shrink-0 rounded-full" />
                      <Pulse className="h-3.5 flex-1" />
                      <Pulse className="h-3 w-10 shrink-0" />
                    </li>
                  ))}
                </ul>
              ) : activityRows.length === 0 && !loading ? (
                <p className="mt-2 text-[13px] text-foreground-muted">
                  Collect a heart or unlock an area — your ledger shows up here.
                </p>
              ) : (
                <ul className="mt-2 space-y-0.5">
                  {activityRows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(row.record)}
                        className="flex w-full items-center gap-2.5 py-1.5 text-left transition active:opacity-70"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            row.accent === 'rose' ? 'bg-[#c45c6a]' : 'bg-lake-blue'
                          }`}
                          aria-hidden
                        />
                        <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                          <span className="font-medium">{row.title}</span>
                          <span className="text-foreground-muted">
                            {' · '}
                            {row.subtitle}
                          </span>
                        </p>
                        {row.at ? (
                          <span className="shrink-0 text-[11px] tabular-nums text-foreground-muted">
                            {formatRelativeTime(row.at)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {/* Not signed in */}
          {!accountId ? (
            <div className="mx-1 rounded-[22px] border border-black/[0.06] bg-white px-5 py-8 text-center shadow-sm">
              <p className="text-[18px] font-bold tracking-tight text-foreground">Your standing</p>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground-muted">
                Sign in to track level, XP, collections, and every area you unlock across Minnesota.
              </p>
            </div>
          ) : null}
        </div>
  );

  return (
    <>
      {embedded ? (
        body
      ) : (
        <DockCardShell
          variant="feed"
          contentWidth="sheet"
          titleMode="none"
          header={
            <div className="flex items-center justify-between pb-1 pt-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                  Minnesota
                </p>
                <h2 className="mt-0.5 text-[1.2rem] font-semibold tracking-tight text-foreground">
                  Insights Today
                </h2>
              </div>
              {headerRight}
            </div>
          }
        >
          {body}
        </DockCardShell>
      )}

      <TodayRecordHost record={selected} onClose={() => setSelected(null)} />

      {claimSuccess ? (
        <XpClaimedSuccessModal
          title="Claimed!"
          rewardLine={`+${claimSuccess.result.claimedAmount} XP`}
          standingLine={`Level ${claimSuccess.result.highestLevelReached} · ${claimSuccess.result.totalXp} XP total`}
          sources={claimSuccess.sources}
          levelUpPrepared={claimSuccess.result.levelUpPrepared}
          onClose={() => setClaimSuccess(null)}
        />
      ) : null}
    </>
  );
}
