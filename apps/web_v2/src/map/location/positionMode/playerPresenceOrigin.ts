/**
 * playerPresenceOrigin — single origin for /game content systems.
 *
 * Radar, tile grid, world stream, and zone rings should read here — not
 * mapModeStore or raw Find Me alone. Presence owns Live/Scout; this module
 * picks the best player lng/lat for content anchoring.
 *
 * Priority:
 *   1. Avatar presentation (Scout walk / Live smoothed pose)
 *   2. Find Me display / raw coords
 *   3. Last-known avatar persist
 *   4. MAP_CONFIG.DEFAULT_CENTER (Capitol-area fallback)
 *
 * Scout vs Live gating for content (hide grid while Scout, GPS-only stream
 * tiles while Scout, skip compass bearing sync while Scout) uses
 * `isPresenceScout()`.
 */

import { MAP_CONFIG } from '@/map/config';
import {
  isPresenceLive,
} from '@/map/location/camera/mapCameraAuthority';
import {
  getFindMeCoordsSnapshot,
  getFindMeDisplayCoords,
  subscribeFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import {
  getAvatarPresentationCoords,
  subscribeAvatarWalk,
} from '@/map/location/player/avatarWalkController';
import {
  getPresenceMode,
  subscribePresence,
} from '@/map/location/positionMode/positionModeStore';

export type PresenceOrigin = {
  lng: number;
  lat: number;
  /** True when the origin came from a live or presented pose (not DEFAULT_CENTER). */
  hasFix: boolean;
};

export { isPresenceLive };

/** Scout — player pans freely; content must not assume camera === player. */
export function isPresenceScout(): boolean {
  return getPresenceMode() === 'scout';
}

/**
 * Best player lng/lat for radar / world / tile / ring anchoring.
 * Never returns null — always a concrete point (DEFAULT_CENTER last resort).
 */
export function getPresenceOrigin(): PresenceOrigin {
  const avatar = getAvatarPresentationCoords();
  if (avatar) return { lng: avatar.lng, lat: avatar.lat, hasFix: true };

  const display = getFindMeDisplayCoords(getFindMeCoordsSnapshot());
  if (display) return { lng: display.lng, lat: display.lat, hasFix: true };

  const snap = getFindMeCoordsSnapshot();
  if (snap.coords) return { lng: snap.coords.lng, lat: snap.coords.lat, hasFix: true };
  if (snap.lookupCoords) {
    return { lng: snap.lookupCoords.lng, lat: snap.lookupCoords.lat, hasFix: true };
  }

  const last = getFindMeLastCoords();
  if (last) return { lng: last.lng, lat: last.lat, hasFix: true };

  return {
    lng: MAP_CONFIG.DEFAULT_CENTER[0],
    lat: MAP_CONFIG.DEFAULT_CENTER[1],
    hasFix: false,
  };
}

/** Subscribe when avatar walk, Find Me, or Presence changes. */
export function subscribePresenceOrigin(cb: () => void): () => void {
  const u1 = subscribeAvatarWalk(cb);
  const u2 = subscribeFindMeCoords(cb);
  const u3 = subscribePresence(cb);
  return () => {
    u1();
    u2();
    u3();
  };
}
