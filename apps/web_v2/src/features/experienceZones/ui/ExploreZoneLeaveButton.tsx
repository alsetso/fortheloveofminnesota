'use client';

/**
 * Top-right leave control while Explore Zone is on.
 * Two-step: first tap arms “Leave?”, second tap within the window exits.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconLeave } from '@/features/map/dockCore/core/icons';
import { MAP_DOCK_CIRCLE_SIZE_CLASS } from '@/features/map/dockCore/core/mapDockTokens';
import {
  stopExploreZone,
  useVenueMode,
} from '@/features/experienceZones/store/venueModeStore';
import { objectRadarActions } from '@/features/map/game/objectRadar/objectRadarStore';
import { triggerWorldRefresh } from '@/features/map/game/world/worldRefreshSignal';
import { haptic } from '@/lib/despia/haptics';
import {
  closeContributeSheet,
  getContributeSheetSnapshot,
} from '@/features/community/contributeSheetStore';

const CONFIRM_MS = 2800;

const FLOAT_BTN_BASE_CLASS =
  'pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-full border shadow-lg transition-[background-color,transform,border-color,color,box-shadow] duration-150 active:scale-95';

export function ExploreZoneLeaveButton() {
  const { exploring, zoneName } = useVenueMode();
  const [armed, setArmed] = useState(false);
  const armTimerRef = useRef<number | null>(null);

  const clearArm = useCallback(() => {
    if (armTimerRef.current != null) {
      window.clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    setArmed(false);
  }, []);

  useEffect(() => {
    if (!exploring) clearArm();
  }, [exploring, clearArm]);

  useEffect(() => () => clearArm(), [clearArm]);

  if (!exploring) return null;

  const leave = () => {
    clearArm();
    haptic.toggle();
    stopExploreZone();
    objectRadarActions.closeSheet();
    triggerWorldRefresh();
    // Close the contribute sheet if it was opened in zone-scoped mode —
    // the zone context is no longer valid once the user stops exploring.
    const sheet = getContributeSheetSnapshot();
    if (sheet.open && sheet.experienceZoneId) closeContributeSheet();
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
      aria-label={
        armed
          ? zoneName
            ? `Confirm leave ${zoneName}`
            : 'Confirm leave zone'
          : zoneName
            ? `Leave ${zoneName}`
            : 'Leave zone'
      }
      aria-pressed={armed}
      title={armed ? 'Tap again to leave' : 'Leave zone'}
      data-chrome="explore-zone-leave"
      className={`${MAP_DOCK_CIRCLE_SIZE_CLASS} ${FLOAT_BTN_BASE_CLASS} ${
        armed
          ? 'border-violet-200 bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.55)]'
          : 'border-violet-300/45 bg-violet-950/90 text-violet-100 shadow-[0_6px_20px_rgba(76,29,149,0.4)]'
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
