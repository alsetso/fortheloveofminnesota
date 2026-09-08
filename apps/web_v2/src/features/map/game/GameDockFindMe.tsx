'use client';

import { useCallback } from 'react';
import { IconCursor, IconSpinner } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';
import { isLiveFollowing } from '@/map/location/camera/mapCameraAuthority';
import { useFindMe } from '@/map/location/camera/useFindMe';
import { usePlayerPresenceSwitch } from '@/map/location/positionMode/usePlayerPresenceSwitch';
import { usePositionMode } from '@/map/location/positionMode/usePositionMode';

/**
 * Find Me — right side of the dock search field on /game.
 *
 * Visibility derives from Presence + GPS capability (not a local toggle):
 *   show  — Scout, or Live while still resolving / recovering
 *   hide  — Live + GPS `active` (already following)
 *
 * Tap always enters Live through resolve → apply → findMe. Recenter is not
 * this button’s job once following (camera already tracks).
 */
export function GameDockFindMe() {
  const { phase, canFindMe } = useFindMe();
  const { mode } = usePositionMode();
  const { switchToLive, switching } = usePlayerPresenceSwitch();

  const following = isLiveFollowing(phase);
  const locating = phase === 'finding' || switching;

  const handleClick = useCallback(() => {
    if (following || !canFindMe || locating) return;
    haptic.toggle();
    void switchToLive();
  }, [following, canFindMe, locating, switchToLive]);

  // Hide only once Live has a live fix and is following. Keep the control
  // visible (with spinner) while switchToLive / GPS attach is in flight.
  if (following) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={locating || !canFindMe}
      aria-label={locating ? 'Finding your location' : 'Find me'}
      title="Find me"
      data-rail="locate"
      data-presence={mode}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground-muted transition-[color,transform] duration-150 hover:text-foreground active:scale-90 disabled:opacity-50"
    >
      {locating ? (
        <IconSpinner className="h-4 w-4 animate-spin" />
      ) : (
        <IconCursor className="h-4 w-4" />
      )}
    </button>
  );
}
