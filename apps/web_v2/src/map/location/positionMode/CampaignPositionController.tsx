'use client';

/**
 * CampaignPositionController — Campaign-only presence (boot + WASD + chase).
 *
 * Not mounted on `/game`. WorldMapShell is currently unrouted (/campaign → /game).
 * Owns its own Free @ Capitol boot — does not share PlayerPresenceController.
 */

import { useEffect, useRef } from 'react';
import { useMapContext } from '@/map/MapProvider';
import { lockMapCameraGestures } from '@/map/engine/useMapEngine';
import { useFindMe } from '@/map/location/camera/useFindMe';
import { applyPresenceMode } from '@/map/location/positionMode/applyPresenceMode';
import {
  attachFreeMove,
  attachFreeMoveKeyboard,
  detachFreeMove,
} from '@/map/location/positionMode/freeMoveController';
import {
  CAMPAIGN_MOVE_SPEED_MPS,
  CAMPAIGN_PITCH,
  CAMPAIGN_TURN_LERP,
  CAMPAIGN_ZOOM,
  CAPITOL_SPAWN,
} from '@/map/location/positionMode/positionConstants';
import {
  hydratePresenceStore,
  setPresenceBootStatus,
  setPresenceNotice,
} from '@/map/location/positionMode/positionModeStore';
import { resolvePresenceMode } from '@/map/location/positionMode/resolvePositionMode';
import { useCampaignChaseCamera } from '@/map/location/positionMode/useCampaignChaseCamera';
import { usePresence } from '@/map/location/positionMode/usePositionMode';

function CampaignBoot() {
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
        const resolved = await resolvePresenceMode({
          request: 'scout',
          spawn: 'capitol',
        });
        if (cancelled) return;
        applyPresenceMode(
          resolved,
          {
            map,
            findMe: findMeRef.current,
            unlockCamera: unlockCameraRef.current,
            reframe: 'none',
            chaseLocked: true,
          },
          { persist: false },
        );
        try {
          map.jumpTo({
            center: [CAPITOL_SPAWN.lng, CAPITOL_SPAWN.lat],
            zoom: CAMPAIGN_ZOOM,
            pitch: CAMPAIGN_PITCH,
            bearing: 0,
          });
        } catch {
          /* style race — chase cam will settle */
        }
      } catch (err) {
        console.error('[campaign-presence] boot resolve failed', err);
        setPresenceNotice('Could not lock Campaign spawn — you can still scout.');
      } finally {
        if (!cancelled) setPresenceBootStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [map, ready]);

  return null;
}

function CampaignFreeMoveEffects() {
  const { map, ready } = useMapContext();
  const { mode } = usePresence();

  useEffect(() => attachFreeMoveKeyboard(), []);

  useEffect(() => {
    if (!map || !ready || mode !== 'scout') return;
    attachFreeMove(map, {
      speedMps: CAMPAIGN_MOVE_SPEED_MPS,
      turnLerp: CAMPAIGN_TURN_LERP,
    });
    return () => detachFreeMove();
  }, [map, ready, mode]);

  useEffect(() => {
    if (!map || !ready) return;
    lockMapCameraGestures(map);
    const reassert = () => lockMapCameraGestures(map);
    map.on('style.load', reassert);
    return () => {
      map.off('style.load', reassert);
    };
  }, [map, ready]);

  useCampaignChaseCamera(map, ready, true);
  return null;
}

/** Boot as Campaign Free + attach scout locomotion/chase. */
export function CampaignPositionController() {
  return (
    <>
      <CampaignBoot />
      <CampaignFreeMoveEffects />
    </>
  );
}
