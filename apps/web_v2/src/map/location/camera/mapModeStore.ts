/**
 * DEPRECATED camera-chrome shim — do not add new callers.
 *
 * PresenceMode (`live` | `scout`) is the authority:
 *   Live  → mapMode 'follow'
 *   Scout → mapMode 'scout'
 *
 * `setMapMode` is a no-op. Callers that used to flip Locked/Explore must
 * switch presence instead (`usePlayerPresenceSwitch`).
 */

import {
  getPresenceMode,
  subscribePresence,
} from '@/map/location/positionMode/positionModeStore';

export type MapMode = 'follow' | 'scout';

function modeFromPresence(): MapMode {
  return getPresenceMode() === 'scout' ? 'scout' : 'follow';
}

export function getMapMode(): MapMode {
  return modeFromPresence();
}

/** @deprecated No-op — PresenceMode owns Live/Scout. */
export function setMapMode(_next: MapMode): void {
  /* intentionally empty */
}

export function subscribeMapMode(cb: () => void): () => void {
  return subscribePresence(cb);
}

/** useSyncExternalStore snapshot. */
export function getMapModeSnapshot(): MapMode {
  return modeFromPresence();
}
