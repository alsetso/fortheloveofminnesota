'use client';

/**
 * Standing — Today progress hub on /game.
 * Single entry point: XP, streak, passport, collectibles, and recent activity.
 * Level and Collections are accessible as direct dock cards from HUD taps.
 * Atlas (explore map) is reachable via openDockCard('atlas').
 */

import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { DockCardSubHeader } from '@/features/map/dockCore/dockCard/DockCardSubHeader';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import InsightsTodayDockCard from '@/features/map/game/InsightsTodayDockCard';
export default function StandingDockCard() {
  const { openAccount, openDockCard } = useMapDock();
  const fromAccount = false;

  return (
    <DockCardShell
      variant="feed"
      contentWidth="sheet"
      titleMode="none"
      header={
        <div className="pb-1 pt-0.5">
          {fromAccount ? (
            <DockCardSubHeader
              backLabel="Account"
              onBack={() => openAccount()}
              eyebrow="Standing"
              title="Today"
            />
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Standing
              </p>
              <h2 className="mt-0.5 text-[1.2rem] font-semibold tracking-tight text-foreground">
                Today
              </h2>
            </div>
          )}
        </div>
      }
    >
      <InsightsTodayDockCard embedded />
    </DockCardShell>
  );
}
