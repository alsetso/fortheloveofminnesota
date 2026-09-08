/**
 * mapCameraAuthority — single posture for who owns the map lens.
 *
 * Product language on `/game`:
 *   Live  → live-follow (frame lock + GPS ticks)
 *   Scout → scout (user pans; GPS must not steal camera)
 *
 * Pin / feature focus temporarily yields via cameraIntentStore ('pinned').
 * That yield is checked here for posture labeling; follow ticks still gate on
 * acquireCameraIntent('follow') so we do not double-block.
 *
 * Surfaces with lockToUser=false (statewide atlas) never force live-follow
 * frame lock. Follow may still refresh accuracy / soft attach per Find Me.
 *
 * Prefer this module over mapModeStore for new code. mapModeStore remains a
 * deprecated mirror of PresenceMode for legacy callers.
 */

import { getCameraIntent } from '@/map/location/camera/cameraIntentStore';
import { getPresenceMode } from '@/map/location/positionMode/positionModeStore';

export type MapCameraPosture = 'live-follow' | 'scout' | 'yield-pin';

/** Live presence — GPS (or scaffolded driving) may drive the follow camera. */
export function isPresenceLive(): boolean {
  return getPresenceMode() === 'live';
}

/** @deprecated Use isPresenceLive */
export const isLivePositionMode = isPresenceLive;

/**
 * Who should own framing right now.
 * Does not replace acquireCameraIntent — use both: posture for mode, intent for races.
 */
export function getMapCameraPosture(lockToUser: boolean): MapCameraPosture {
  if (getCameraIntent() === 'pinned') return 'yield-pin';
  if (!lockToUser) return 'scout';
  if (getPresenceMode() === 'scout') return 'scout';
  return 'live-follow';
}

/**
 * GPS / avatar follow ticks may move or frame-lock the camera.
 * Scout never owns — Free Move / manual pan does.
 * Pin yield is handled by cameraIntentStore, not this gate (matches prior behavior).
 */
export function gpsOwnsCamera(lockToUser: boolean): boolean {
  return !(lockToUser && getPresenceMode() === 'scout');
}

/**
 * Live presence with an active GPS session — the user is being followed.
 * Chrome (e.g. Find Me in search) should treat this as “already on you.”
 * PresenceMode = intent; GPS phase = capability. Do not collapse them.
 */
export function isLiveFollowing(
  gpsPhase: 'idle' | 'finding' | 'active' | 'error',
): boolean {
  return isPresenceLive() && gpsPhase === 'active';
}

/**
 * Orbit + compass heading-up only while Live on a lock-to-user surface.
 * Equivalent to legacy `mapMode === 'follow'` under the Presence shim.
 */
export function isLiveFollowCamera(lockToUser: boolean): boolean {
  return lockToUser && isPresenceLive();
}
