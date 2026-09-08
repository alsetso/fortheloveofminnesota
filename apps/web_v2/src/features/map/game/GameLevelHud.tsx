'use client';

/**
 * TopBar leading control — level + XP bar beside the account avatar.
 * Taps open (or close) the Level dock card.
 */

import { useAuthSafe } from '@/features/auth';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useAccountLevel } from '@/features/xp/logic/useAccountLevel';
import { haptic } from '@/lib/despia/haptics';
import { SkeletonPulse } from './GameHudSkeletons';

export function GameLevelHud() {
  const { account } = useAuthSafe();
  const { dockCard, openDockCard, closeDockCard } = useMapDock();
  const { level, loading: levelLoading } = useAccountLevel(account?.id ?? null);

  if (!account) return null;

  const levelNum = level?.level ?? null;
  const progressPct = level?.progressPct ?? 0;
  const atMaxLevel = levelNum === 99;
  const levelPending = levelLoading && level === null;
  const active = dockCard === 'level';

  const handleTap = () => {
    haptic.toggle();
    if (active) {
      closeDockCard();
      return;
    }
    openDockCard('level');
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-pressed={active}
      aria-label={
        levelNum != null
          ? `Level ${levelNum}${active ? '. Close level' : '. Open level'}`
          : 'Loading level'
      }
      data-hud="level"
      className={`pointer-events-auto flex min-h-9 min-w-[2.75rem] flex-col items-start justify-center gap-0.5 rounded-lg px-1.5 py-0.5 transition active:scale-[0.97] ${
        active ? 'bg-black/[0.05]' : ''
      }`}
    >
      <span className="text-[13px] font-bold tabular-nums tracking-tight text-foreground">
        {levelPending || levelNum == null ? (
          <SkeletonPulse width="w-8" height="h-3" className="bg-black/10" />
        ) : (
          `Lv ${levelNum}`
        )}
      </span>
      {!atMaxLevel && !levelPending ? (
        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-black/[0.08]">
          <span
            className="block h-full rounded-full bg-lake-blue transition-[width] duration-500"
            style={{ width: `${Math.round(progressPct * 100)}%` }}
          />
        </div>
      ) : null}
    </button>
  );
}
