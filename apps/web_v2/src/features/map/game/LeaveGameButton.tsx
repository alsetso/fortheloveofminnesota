'use client';

/**
 * Top-left exit from the game map (/game) — returns to Feed.
 * Two-step: first tap arms “Leave?”, second tap within the window exits.
 * Prefer tab bar when AppShell chrome is on; this remains for full-bleed /
 * demo surfaces without the footer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLeave } from '@/features/map/dockCore/core/icons';
import { MAP_DOCK_CIRCLE_SIZE_CLASS } from '@/features/map/dockCore/core/mapDockTokens';
import { FEED_PATH } from '@/lib/routes/routePolicy';
import { haptic } from '@/lib/despia/haptics';

const CONFIRM_MS = 2800;

const FLOAT_BTN_BASE_CLASS =
  'pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-[background-color,transform,border-color,color,box-shadow] duration-150 active:scale-95';

export function LeaveGameButton() {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const armTimerRef = useRef<number | null>(null);

  const clearArm = useCallback(() => {
    if (armTimerRef.current != null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    setArmed(false);
  }, []);

  useEffect(() => () => clearArm(), [clearArm]);

  const leave = () => {
    clearArm();
    haptic.toggle();
    router.push(FEED_PATH);
  };

  const onClick = () => {
    if (armed) {
      leave();
      return;
    }
    haptic.toggle();
    setArmed(true);
    armTimerRef.current = window.setTimeout(() => {
      armTimerRef.current = null;
      setArmed(false);
    }, CONFIRM_MS);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={armed ? 'Confirm leave map' : 'Leave map'}
      aria-pressed={armed}
      title={armed ? 'Tap again to leave' : 'Leave map'}
      data-chrome="leave-game"
      className={`${MAP_DOCK_CIRCLE_SIZE_CLASS} ${FLOAT_BTN_BASE_CLASS} ${
        armed
          ? 'border-white/50 bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.35)]'
          : 'border-white/20 bg-black/55 text-white'
      }`}
    >
      {armed ? (
        <span className="px-0.5 text-[9px] font-bold uppercase leading-none tracking-wide">
          Leave?
        </span>
      ) : (
        <IconLeave className="h-5 w-5" />
      )}
    </button>
  );
}
