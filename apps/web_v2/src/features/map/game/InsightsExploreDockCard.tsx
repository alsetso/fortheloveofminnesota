'use client';

/**
 * Insights Explore — Explore page content surfaced inside the Game dock card.
 * Mirrors /explore but adapted for the dock card format:
 * - No Mapbox map preview in the Home Grounds card (already on the map)
 * - No PageScroll / page chrome
 * - No search-to-route input (can't push Next routes from a dock card mid-game)
 * The /explore route can be gated to dev-only while this card stays available
 * for all authenticated users inside the game.
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AreasPlacesSection } from '@/features/explore/shared/AreasPlacesSection';
import { ExploreRareFindsSection } from '@/features/explore/list/ExploreRareFindsSection';
import { TodayRecordHost, type TodayRecord } from '@/features/today/records';
import {
  HOME_RESET_COOLDOWN_DAYS,
  isProductTerritoryKind,
} from '@/features/accountTerritories/store/constants';
import { passportKindByUnitKind } from '@/features/accountTerritories/store/passportKinds';
import {
  formatHomeResetDate,
  useHomeStatus,
  type HomeStackJurisdiction,
} from '@/features/accountTerritories/store/useHomeStatus';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import { useAuthSafe } from '@/features/auth';
import { useAccountCollections } from '@/features/collections/useAccountCollections';
import { IconLock, IconRefresh } from '@/features/map/dockCore/core/icons';
import { GAME_PATH, discoverKindPath } from '@/lib/routes/routePolicy';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';

// ─── Helpers (mirrored from Discover helpers) ─────────────────────────────────────

const KIND_SHORT: Record<string, string> = {
  county: 'County',
  ctu: 'City / township',
  school_district: 'School district',
};

const HOME_NEST_ORDER: Record<string, number> = {
  county: 0,
  school_district: 1,
  ctu: 2,
};

function homeSubtitle(j: HomeStackJurisdiction): string {
  return j.kindLabel ?? KIND_SHORT[j.kind] ?? j.kind.replace(/_/g, ' ');
}

function sortHomeNest(a: HomeStackJurisdiction, b: HomeStackJurisdiction): number {
  const ai = HOME_NEST_ORDER[a.kind] ?? 50;
  const bi = HOME_NEST_ORDER[b.kind] ?? 50;
  if (ai !== bi) return ai - bi;
  return a.name.localeCompare(b.name);
}


// ─── Home Grounds card (map-free version for in-dock) ────────────────────────

function HomeGroundsCard({
  jurisdictions,
  canReset,
  homeSetAt,
}: {
  jurisdictions: HomeStackJurisdiction[];
  canReset: boolean;
  homeSetAt: string | null;
}) {
  const router = useRouter();
  const nested = useMemo(
    () =>
      [...jurisdictions]
        .filter((j) => isProductTerritoryKind(j.kind))
        .sort(sortHomeNest),
    [jurisdictions],
  );
  const locked = Boolean(homeSetAt) && !canReset;

  if (nested.length === 0) {
    return (
      <button
        type="button"
        onClick={() => router.push(GAME_PATH)}
        className="flex w-full flex-col items-start rounded-[18px] border border-black/[0.08] bg-white p-4 text-left transition active:scale-[0.99]"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
          Not staked yet
        </p>
        <p className="mt-1 text-[20px] font-bold tracking-tight text-foreground">
          Stake your claim
        </p>
        <p className="mt-1.5 max-w-[30ch] text-[13px] leading-snug text-foreground-muted">
          {`Turn on Find Me, open Areas, then set as home — yours for ${HOME_RESET_COOLDOWN_DAYS} days.`}
        </p>
        <span className="mt-4 inline-flex rounded-full bg-[#e8eef2] px-4 py-2 text-[13px] font-bold text-lake-blue">
          Claim home on map
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-[18px] border border-black/[0.08] bg-white px-4 pb-3.5 pt-3">
      <div className="flex items-center justify-between gap-2 pb-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            locked
              ? 'bg-amber-50 text-amber-800'
              : 'bg-[#e8eef2] text-lake-blue'
          }`}
        >
          {locked ? (
            <>
              <IconLock className="h-3 w-3" />
              Locked
            </>
          ) : (
            'Reset ready'
          )}
        </span>
        {homeSetAt ? (
          <p className="text-[12px] text-foreground-muted">
            Set {formatHomeResetDate(homeSetAt)}
          </p>
        ) : null}
      </div>
      <ul className="space-y-1.5" aria-label="Home territories">
        {nested.map((j) => (
          <li key={`home:${j.kind}:${j.id}`} className="flex items-baseline gap-2 truncate">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-muted">
              {homeSubtitle(j)}
            </span>
            <span className="min-w-0 truncate text-[14px] font-semibold leading-tight text-foreground">
              {j.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function InsightsExploreDockCard() {
  const router = useRouter();
  const { account } = useAuthSafe();
  const accountId = account?.id ?? null;
  const { status: homeStatus, reload: reloadHome } = useHomeStatus();
  const { passport, loading: passportLoading, refresh: refreshPassport } = usePassport(accountId);
  const { collections, loading: collectionsLoading, refresh: refreshCollections } =
    useAccountCollections(accountId);

  const [selected, setSelected] = useState<TodayRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const homePending = Boolean(accountId) && !homeStatus;
  const homeJurisdictions = homeStatus?.jurisdictions ?? [];

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    refreshPassport();
    refreshCollections();
    await reloadHome();
    setRefreshing(false);
  }, [refreshing, refreshPassport, refreshCollections, reloadHome]);

  return (
    <>
      <DockCardShell
        variant="feed"
        contentWidth="sheet"
        titleMode="none"
        header={
          <div className="flex items-center justify-between pb-1 pt-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Atlas
              </p>
              <h2 className="mt-0.5 text-[1.2rem] font-semibold tracking-tight text-foreground">
                Explore
              </h2>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh explore insights"
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition active:bg-black/[0.05] disabled:opacity-40"
            >
              <IconRefresh className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      >
        <div className="space-y-8 pb-2">

          {/* ── Home Grounds ─────────────────────────────────────────────── */}
          <section className="space-y-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground-muted">
                Civic home
              </p>
              <h3 className="mt-0.5 text-[22px] font-bold tracking-tight text-foreground">
                Home grounds
              </h3>
              <p className="mt-1 text-[12px] leading-snug text-foreground-muted">
                Your locked corner of Minnesota — county, city, school district.
              </p>
            </div>

            {!accountId ? null : homePending ? (
              <div
                className="h-28 animate-pulse rounded-[18px] bg-black/[0.06]"
                aria-busy="true"
                aria-label="Loading home grounds"
              />
            ) : (
              <HomeGroundsCard
                jurisdictions={homeJurisdictions}
                canReset={Boolean(homeStatus?.canReset)}
                homeSetAt={homeStatus?.homeSetAt ?? null}
              />
            )}
          </section>

          {/* ── Your Passport ─────────────────────────────────────────────── */}
          <AreasPlacesSection
            accountId={accountId}
            passport={passport}
            loading={passportLoading}
            variant="explore"
            onSelectRecord={setSelected}
            onOpenKind={(kind) => {
              const def = passportKindByUnitKind(kind.unitKind);
              if (def) router.push(discoverKindPath(def.slug));
            }}
          />

          {/* ── Your Backpack ─────────────────────────────────────────────── */}
          <ExploreRareFindsSection
            accountId={accountId}
            collections={collections}
            collectionsLoading={collectionsLoading}
            onSelectRecord={setSelected}
          />


          {/* Not signed in */}
          {!accountId ? (
            <div className="rounded-[22px] border border-black/[0.06] bg-white px-5 py-8 text-center shadow-sm">
              <p className="text-[18px] font-bold tracking-tight text-foreground">
                Unlocked areas
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground-muted">
                Sign in to explore your home grounds, unlocked areas, and collectibles.
              </p>
            </div>
          ) : null}

        </div>
      </DockCardShell>

      <TodayRecordHost record={selected} onClose={() => setSelected(null)} />
    </>
  );
}
