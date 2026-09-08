'use client';

/**
 * Game free-chrome top-right — one tap target for the whole HUD.
 * Opens the Standing Today hub at full height (replaces the utilities dock pane
 * as the primary entry point from the HUD).
 *
 * Displays (read-only): username · level · XP bar · areas · coins · hearts.
 *
 * While data is in flight on first load every text element renders as a
 * pulsing skeleton placeholder — no blank flash or meaningless "Lv —".
 *
 * During the demo, stat counts reveal progressively:
 *   Level bar  — visible from claim_streak (step 2)
 *   Areas      — visible from unlock_territories (step 8)
 *   Hearts     — visible from collect_heart (step 10)
 *   Coins      — visible from collect_coin (step 11)
 */

import { useAuthSafe } from '@/features/auth';
import { getAccountHandle } from '@/features/auth/accountDisplay';
import { useAccountCollections } from '@/features/collections/useAccountCollections';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useAccountLevel } from '@/features/xp/logic/useAccountLevel';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import { IconCoin, IconHeart, IconMapPin } from '@/features/map/dockCore/core/icons';
import {
  useDemoMapChrome,
  demoShowsAreas,
  demoShowsCoins,
  demoShowsHearts,
} from '@/features/setup/DemoMapChromeContext';
import { GameStatsHudSkeleton, SkeletonPulse, StatCountSkeleton } from './GameHudSkeletons';

const COIN_SLUG = 'coin-quaternius';

export default function GameStatsHud({
  interactive = true,
}: {
  /** When false, HUD is read-only (Story has no dock to open). */
  interactive?: boolean;
}) {
  const { account } = useAuthSafe();
  const { pane, openToday, openBrowse } = useMapDock();
  const { level, loading: levelLoading } = useAccountLevel(account?.id ?? null);
  const { collections, loading: collectionsLoading } = useAccountCollections(account?.id ?? null);
  const { passport, loading: passportLoading } = usePassport(account?.id ?? null);
  const demo = useDemoMapChrome();

  if (!account) return null;

  const handle = getAccountHandle(account);
  const levelNum = level?.level ?? null;
  const progressPct = level?.progressPct ?? 0;
  const atMaxLevel = levelNum === 99;
  const heartsCollected = collections?.hearts.collected ?? 0;
  const coinsCollected = collections?.byModel.find((m) => m.slug === COIN_SLUG)?.count ?? 0;
  const areasUnlocked = passport?.unlockedTotal ?? 0;
  const active = pane.id === 'today';

  // First-load skeleton gates — only skeleton while both loading AND no data yet.
  // After the first successful response the data is non-null, so re-fetches
  // (standing invalidation) never re-trigger skeleton state.
  const levelPending = levelLoading && level === null;
  const collectionsPending = collectionsLoading && collections === null;
  const passportPending = passportLoading && passport === null;

  const stepKey = demo?.stepKey ?? null;
  const showAreas  = demoShowsAreas(stepKey);
  const showHearts = demoShowsHearts(stepKey);
  const showCoins  = demoShowsCoins(stepKey);
  const showAnyStat = showAreas || showHearts || showCoins;

  const handleTap = () => {
    if (!interactive) return;
    if (active) {
      openBrowse();
      return;
    }
    openToday();
  };

  // Full skeleton while the very first level fetch is in flight.
  if (levelPending) {
    return (
      <button
        type="button"
        onClick={handleTap}
        aria-label="Loading stats…"
        data-hud="standing"
        className={`flex items-center justify-end gap-2.5 transition ${
          interactive
            ? 'pointer-events-auto active:scale-[0.97]'
            : 'pointer-events-none'
        }`}
      >
        <GameStatsHudSkeleton showStats={showAnyStat} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-pressed={active}
      aria-label={[
        levelNum != null ? `Level ${levelNum}` : null,
        showAreas  ? `${areasUnlocked} areas unlocked` : null,
        showCoins  ? `${coinsCollected} coins` : null,
        showHearts ? `${heartsCollected} ${heartsCollected === 1 ? 'heart' : 'hearts'} collected` : null,
        active ? 'Close Today' : 'Open Today',
      ]
        .filter(Boolean)
        .join('. ')}
      data-hud="standing"
      className={`flex items-center justify-end gap-2.5 transition ${
        interactive
          ? 'pointer-events-auto active:scale-[0.97]'
          : 'pointer-events-none'
      }`}
    >
      <div className="flex min-w-0 flex-col items-end gap-1 text-right">

        {/* Username + level + XP bar */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-baseline gap-1.5">
            {handle ? (
              <span className="text-[11px] font-semibold tracking-tight text-foreground-muted">
                {handle}
              </span>
            ) : (
              <SkeletonPulse width="w-14" height="h-2.5" />
            )}
            <span className="text-[13px] font-bold tabular-nums tracking-tight text-foreground">
              {levelNum != null ? `Lv ${levelNum}` : (
                <SkeletonPulse width="w-8" height="h-3" />
              )}
            </span>
          </div>
          {!atMaxLevel && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
              <span
                className="block h-full rounded-full bg-lake-blue transition-[width] duration-500"
                style={{ width: `${Math.round(progressPct * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Areas · Coins · Hearts — each revealed progressively during the demo */}
        {showAnyStat && (
          <div className="flex items-center gap-2.5">
            {showAreas && (
              <span className="flex items-center gap-1" data-hud="areas">
                <span className="text-[13px] font-bold tabular-nums leading-none text-foreground">
                  {passportPending ? <StatCountSkeleton /> : areasUnlocked.toLocaleString()}
                </span>
                <IconMapPin className="h-3.5 w-3.5 text-lake-blue" />
              </span>
            )}
            {showCoins && (
              <span className="flex items-center gap-1" data-hud="coins">
                <span className="text-[13px] font-bold tabular-nums leading-none text-foreground">
                  {collectionsPending ? <StatCountSkeleton /> : coinsCollected.toLocaleString()}
                </span>
                <IconCoin className="h-3.5 w-3.5 text-amber-400" />
              </span>
            )}
            {showHearts && (
              <span className="flex items-center gap-1" data-hud="hearts">
                <span className="text-[13px] font-bold tabular-nums leading-none text-foreground">
                  {collectionsPending ? <StatCountSkeleton /> : heartsCollected.toLocaleString()}
                </span>
                <IconHeart solid className="h-3.5 w-3.5 text-red-400" />
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
