'use client';

/**
 * Discover standing — account level / passport / collectible metrics
 * (ported from Insights Today Standing section).
 */

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import {
  formatUnlockedPct,
  passportStanding,
} from '@/features/explore/shared/AreasPlacesSection';
import { useAccountCollections } from '@/features/collections/useAccountCollections';
import { IconChevronDown } from '@/features/map/dockCore/core/icons';
import { useAccountStreak } from '@/features/streaks/useAccountStreak';
import type { TodayRecord } from '@/features/today/records';
import { getLevelTier } from '@/features/xp/logic/levelTiers';
import { useAccountLevel } from '@/features/xp/logic/useAccountLevel';
import { XpClaimedSuccessModal } from '@/features/xp/modals/XpClaimedSuccessModal';
import {
  claimAllXp,
  getPendingXpSnapshot,
  refreshPendingXp,
  subscribePendingXp,
  type ClaimXpResult,
  type PendingXpState,
} from '@/features/xp/store/pendingXpStore';
import { DISCOVER_COLLECTIBLES_PATH } from '@/lib/routes/routePolicy';

const EMPTY_PENDING_XP: PendingXpState = {
  total: 0,
  count: 0,
  items: [],
  loading: false,
};

function Pulse({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-black/[0.06] ${className ?? ''}`}
      {...rest}
    />
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

export function DiscoverLevelSection({
  onSelectRecord,
  embedded = false,
}: {
  onSelectRecord: (record: TodayRecord) => void;
  /** Tighter padding when nested in a profile expand panel. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const { level, loading: levelLoading } = useAccountLevel(accountId);
  const { passport, loading: passportLoading } = usePassport(accountId);
  const { collections, loading: collectionsLoading } =
    useAccountCollections(accountId);
  const { refresh: refreshStreak } = useAccountStreak(accountId);
  const pendingXp = useSyncExternalStore(
    subscribePendingXp,
    getPendingXpSnapshot,
    () => EMPTY_PENDING_XP,
  );

  const [claimingXp, setClaimingXp] = useState(false);
  const [unclaimedOpen, setUnclaimedOpen] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<{
    result: ClaimXpResult;
    sources: { id: string; name: string; detail?: string; amount: number }[];
  } | null>(null);

  useEffect(() => {
    if (accountId) void refreshPendingXp();
  }, [accountId]);

  const tier = level ? getLevelTier(level.level) : null;
  const levelPending = Boolean(accountId) && (levelLoading || !level);
  const collectionsPending =
    Boolean(accountId) && (collectionsLoading || !collections);
  const passportPending = Boolean(accountId) && (passportLoading || !passport);

  const xpSpan = level ? Math.max(1, level.xpForNextLevel - level.xpForCurrentLevel) : 0;
  const xpIntoLevel = level
    ? Math.min(xpSpan, Math.max(0, level.totalXp - level.xpForCurrentLevel))
    : 0;
  const xpToNext = level ? Math.max(0, level.xpForNextLevel - level.totalXp) : 0;

  const { unlockedTotal, areasAvailable, minnesotaUnlockedPct } = useMemo(
    () => passportStanding(passport),
    [passport],
  );

  const ctuKind = useMemo(
    () => passport?.kinds.find((k) => k.unitKind === 'ctu') ?? null,
    [passport],
  );

  if (!accountId) return null;

  const pad = embedded ? 'px-3 pt-1 pb-3' : 'px-5 pt-4';

  return (
    <>
      <section className={pad}>
        {levelPending ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading level">
            {!embedded ? (
              <>
                <Pulse className="h-4 w-24" />
                <Pulse className="h-12 w-20" />
              </>
            ) : null}
            <Pulse className="h-2.5 w-full rounded-full" />
            <Pulse className="h-3 w-40" />
            <div className="mt-5 flex items-baseline gap-8">
              <StandingMetricSkeleton label="Items found" />
              <StandingMetricSkeleton label="Areas" />
              <StandingMetricSkeleton label="Of Minnesota Unlocked" wide />
            </div>
          </div>
        ) : level && tier ? (
          <>
            {!embedded ? (
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-foreground-muted">
                    {tier.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSelectRecord({ kind: 'level', level })}
                    className="mt-0.5 text-left transition active:opacity-70"
                    aria-label={`Level ${level.level} details`}
                  >
                    <span className="block text-[48px] font-bold leading-none tabular-nums tracking-tight text-foreground">
                      {level.level}
                    </span>
                  </button>
                </div>
                <div className="pb-1 text-right">
                  <p className="text-[22px] font-bold tabular-nums text-foreground">
                    {level.totalXp.toLocaleString()}
                  </p>
                  <p className="text-[12px] font-medium text-foreground-muted">
                    total XP
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectRecord({ kind: 'level', level })}
                className="text-left text-[12px] font-semibold text-lake-blue transition active:opacity-70"
              >
                Level {level.level} · {tier.name}
              </button>
            )}

            {level.level < 99 ? (
              <>
                <div
                  className={`${embedded ? 'mt-2' : 'mt-4'} h-2.5 w-full overflow-hidden rounded-full bg-black/[0.08]`}
                >
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
              <p className={`${embedded ? 'mt-2' : 'mt-3'} text-[12px] text-foreground-muted`}>
                Max level reached
              </p>
            )}

            <div
              className={`${embedded ? 'mt-3' : 'mt-5'} flex items-baseline gap-8`}
              aria-busy={collectionsPending || passportPending || undefined}
            >
              {collectionsPending ? (
                <StandingMetricSkeleton label="Items found" />
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(DISCOVER_COLLECTIBLES_PATH)}
                  className="min-w-0 flex-1 text-left transition active:opacity-70"
                  aria-label={`${collections!.total} of ${collections!.availableTotal} items found`}
                >
                  <StandingMetric
                    label="Items found"
                    collected={collections!.total}
                    available={collections!.availableTotal}
                  />
                </button>
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
                    onSelectRecord({
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
                      onClick={() => onSelectRecord({ kind: 'pending_xp', item })}
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
