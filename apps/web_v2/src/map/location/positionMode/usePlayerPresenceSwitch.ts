'use client';

/**
 * usePlayerPresenceSwitch — Live ↔ Scout toggles for /game HUD.
 *
 * Live  = resolve GPS (prompt allowed on user gesture)
 * Scout = avatar pose in place (no camera jump)
 */

import { useCallback, useState } from 'react';
import { useMapContext } from '@/map/MapProvider';
import { useFindMe } from '@/map/location/camera/useFindMe';
import { getAvatarPresentationCoords } from '@/map/location/player/avatarWalkController';
import { applyPresenceMode } from '@/map/location/positionMode/applyPresenceMode';
import {
  setPresenceMode,
  setPresenceNotice,
} from '@/map/location/positionMode/positionModeStore';
import { setPersistedPresenceMode } from '@/map/location/positionMode/positionPersistence';
import {
  resolvePresenceMode,
  scoutNoticeFor,
} from '@/map/location/positionMode/resolvePositionMode';

export type PlayerPresenceSwitch = {
  /** Enter Live — permission + MN boundary checks; stay Scout with notice on failure. */
  switchToLive: () => Promise<void>;
  /** Enter Scout — avatar stays put; camera unlocked. */
  switchToScout: () => Promise<void>;
  /** @deprecated Alias for switchToLive */
  switchToGps: () => Promise<void>;
  /** @deprecated Alias for switchToScout */
  switchToFree: () => Promise<void>;
  switching: boolean;
};

/** Mode toggle actions for UI — must be used inside FindMeProvider. */
export function usePlayerPresenceSwitch(): PlayerPresenceSwitch {
  const { map } = useMapContext();
  const { findMe, unlockCamera } = useFindMe();
  const [switching, setSwitching] = useState(false);

  const switchToLive = useCallback(async () => {
    if (!map || switching) return;
    setSwitching(true);
    setPresenceNotice(null);
    try {
      const resolved = await resolvePresenceMode({
        request: 'live',
        allowPrompt: true,
        currentPose: getAvatarPresentationCoords(),
      });
      if (resolved.mode === 'scout') {
        setPresenceMode('scout');
        setPersistedPresenceMode('scout');
        setPresenceNotice(scoutNoticeFor(resolved.scoutReason));
        return;
      }
      applyPresenceMode(resolved, { map, findMe, unlockCamera, reframe: 'fly' });
    } finally {
      setSwitching(false);
    }
  }, [map, findMe, unlockCamera, switching]);

  const switchToScout = useCallback(async () => {
    if (!map || switching) return;
    setSwitching(true);
    setPresenceNotice(null);
    try {
      const resolved = await resolvePresenceMode({
        request: 'scout',
        currentPose: getAvatarPresentationCoords(),
      });
      applyPresenceMode(resolved, { map, findMe, unlockCamera, reframe: 'none' });
    } finally {
      setSwitching(false);
    }
  }, [map, findMe, unlockCamera, switching]);

  return {
    switchToLive,
    switchToScout,
    switchToGps: switchToLive,
    switchToFree: switchToScout,
    switching,
  };
}

/** @deprecated Prefer usePlayerPresenceSwitch */
export const usePositionModeSwitch = usePlayerPresenceSwitch;

/** @deprecated Prefer PlayerPresenceSwitch */
export type PositionModeSwitch = PlayerPresenceSwitch;
