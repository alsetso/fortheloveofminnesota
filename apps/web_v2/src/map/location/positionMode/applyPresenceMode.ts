/**
 * applyPresenceMode — shared Live / Scout apply path for Game + Campaign.
 *
 * Sets PresenceMode, seeds avatar + Find Me, then either attaches GPS follow
 * (Live) or unlocks / locks the lens (Scout). Campaign passes chaseLocked so
 * gestures stay off while chase cam owns framing.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { lockMapCameraGestures } from '@/map/engine/useMapEngine';
import { setFindMeCoords } from '@/map/location/camera/findMeCoordsStore';
import type { FindMeOptions } from '@/map/location/camera/findMeTypes';
import { applyScoutMapGestures } from '@/map/location/camera/scoutMapGestures';
import type { UserCoords } from '@/map/location/device/geolocation';
import { setAvatarWalkTarget } from '@/map/location/player/avatarWalkController';
import { setPresenceMode } from '@/map/location/positionMode/positionModeStore';
import { PRESENCE_PITCH } from '@/map/location/positionMode/positionConstants';
import {
  setLastKnownAvatarPosition,
  setPersistedPresenceMode,
} from '@/map/location/positionMode/positionPersistence';
import type { ResolvedPresence } from '@/map/location/positionMode/resolvePositionMode';

export type ApplyPresenceContext = {
  map: MapboxMap;
  findMe: (opts?: FindMeOptions) => void;
  unlockCamera: () => void;
  /**
   * How the camera meets the resolved coords:
   * 'jump' — cold boot (under the veil), 'fly' — user-gesture mode switch,
   * 'none' — stay put (switching to Scout keeps the current frame).
   */
  reframe: 'jump' | 'fly' | 'none';
  /**
   * Campaign chase — stick owns locomotion; never re-enable dragPan.
   * Game Scout unlocks for manual / dead-zone pan instead.
   */
  chaseLocked?: boolean;
};

export function asUserCoords(resolved: ResolvedPresence): UserCoords {
  return (
    resolved.fix ?? {
      lat: resolved.coords.lat,
      lng: resolved.coords.lng,
    }
  );
}

export function applyPresenceMode(
  resolved: ResolvedPresence,
  ctx: ApplyPresenceContext,
  opts?: { persist?: boolean },
): void {
  setPresenceMode(resolved.mode, resolved.liveKind);
  if (opts?.persist !== false) {
    setPersistedPresenceMode(resolved.mode);
    setLastKnownAvatarPosition(resolved.coords);
  }

  const coords = asUserCoords(resolved);
  setAvatarWalkTarget(coords, { snap: true });

  if (resolved.mode === 'live') {
    // Seed the GPS store so Find Me attaches immediately, then let the
    // provider own the live watch. avoidPrompt — resolver already handled
    // permission / reused an in-session fix (Scout → Live must not re-prompt).
    if (resolved.fix) setFindMeCoords(resolved.fix, { snapDisplay: true });
    try {
      ctx.findMe({
        camera: ctx.reframe === 'none' ? 'ease' : ctx.reframe,
        quiet: true,
        // User-gesture Live toggle may still need a watch restart; force is
        // inside findMe. avoidPrompt keeps us from OS-prompting when the
        // resolver already proved Live is allowed (or reused a session fix).
        avoidPrompt: true,
      });
    } catch (err) {
      console.error('[presence] findMe attach failed', err);
    }
    return;
  }

  // Scout:
  //   Campaign — chase cam stays locked; gestures stay off.
  //   Game     — unlock + Scout gesture profile (pointer-aware pan/zoom/orbit).
  // Always ease to the flatter Scout pitch (even when reframe is 'none').
  if (ctx.chaseLocked) {
    lockMapCameraGestures(ctx.map);
  } else {
    ctx.unlockCamera();
    applyScoutMapGestures(ctx.map);
  }
  try {
    if (ctx.reframe !== 'none') {
      ctx.map.jumpTo({
        center: [resolved.coords.lng, resolved.coords.lat],
        zoom: MAP_CONFIG.FIND_ME_ZOOM,
        pitch: PRESENCE_PITCH.scout,
      });
    } else {
      ctx.map.easeTo({
        pitch: PRESENCE_PITCH.scout,
        duration: 420,
        essential: true,
      });
    }
  } catch {
    /* style race */
  }
}
