'use client';

/**
 * PlayerPresenceController — /game presence owner (boot + Play / Scout).
 *
 * Mount once inside MapProvider + FindMeProvider. No Campaign / Story branches.
 * Campaign boots via CampaignPositionController; story routes redirect to /game.
 *
 * Boot contract:
 *   1. Cold open always starts in Scout (free roam) — no GPS lock on entry
 *   2. Find Me still switches into Play (GPS follow) after boot
 *   3. Denied / timeout / outside MN stay Scout with a short notice
 *
 * Switching: usePlayerPresenceSwitch (Find Me → Play, Controls → Scout).
 */

import { useEffect, useRef } from 'react';
import { useMapContext } from '@/map/MapProvider';
import { useFindMe } from '@/map/location/camera/useFindMe';
import { applyPresenceMode } from '@/map/location/positionMode/applyPresenceMode';
import {
  hydratePresenceStore,
  setPresenceBootStatus,
  setPresenceNotice,
} from '@/map/location/positionMode/positionModeStore';
import { flushAvatarPositionPersist } from '@/map/location/positionMode/positionPersistence';
import {
  resolvePresenceMode,
  scoutNoticeFor,
} from '@/map/location/positionMode/resolvePositionMode';
import { useFreeModeCamera } from '@/map/location/positionMode/useFreeModeCamera';

export function PlayerPresenceController() {
  const { map, ready } = useMapContext();
  const { findMe, unlockCamera } = useFindMe();
  const bootStartedRef = useRef(false);

  const findMeRef = useRef(findMe);
  findMeRef.current = findMe;
  const unlockCameraRef = useRef(unlockCamera);
  unlockCameraRef.current = unlockCamera;

  useEffect(() => {
    hydratePresenceStore();
  }, []);

  useEffect(() => {
    if (!map || !ready || bootStartedRef.current) return;
    bootStartedRef.current = true;
    setPresenceBootStatus('resolving');
    let cancelled = false;
    void (async () => {
      try {
        // Game always opens in Scout — Play is opt-in via Find Me / mode menu.
        const resolved = await resolvePresenceMode({
          request: 'scout',
          allowPrompt: false,
        });
        if (cancelled) return;
        applyPresenceMode(resolved, {
          map,
          findMe: findMeRef.current,
          unlockCamera: unlockCameraRef.current,
          reframe: 'jump',
        });
        if (resolved.mode === 'scout') {
          setPresenceNotice(scoutNoticeFor(resolved.scoutReason));
        }
      } catch (err) {
        console.error('[presence] boot resolve failed', err);
        setPresenceNotice('Could not lock a starting place — you can still explore.');
      } finally {
        if (!cancelled) setPresenceBootStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, ready]);

  useEffect(() => {
    const flush = () => flushAvatarPositionPersist();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, []);

  // Scout dead-zone pan when free-move is attached (Campaign owns its own cam).
  useFreeModeCamera(map, ready);

  return null;
}

export {
  usePlayerPresenceSwitch,
  usePositionModeSwitch,
  type PlayerPresenceSwitch,
  type PositionModeSwitch,
} from '@/map/location/positionMode/usePlayerPresenceSwitch';
