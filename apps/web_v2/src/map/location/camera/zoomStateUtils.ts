/**
 * Zoom-state math — pure functions, no React, no Mapbox side effects.
 *
 * Two named zoom anchors used for Find Me / selected-point camera moves:
 *
 *   street (z ≈ 16) — Scout / Live home
 *   close  (z ≈ 16) — Live floor; pinch inspect up to MAX_ZOOM (22)
 *
 * Pitch values track Presence:
 *   street / close Live attach → PRESENCE_PITCH.live
 *   Scout entry → PRESENCE_PITCH.scout (applied in applyPresenceMode)
 */

import { MAP_CONFIG } from '@/map/config';
import { PRESENCE_PITCH } from '@/map/location/positionMode/positionConstants';

export type ZoomState = 'street' | 'close';

/** Canonical pitch (degrees) for each zoom state — both use Live tilt. */
export const ZOOM_STATE_PITCH: Record<ZoomState, number> = {
  street: PRESENCE_PITCH.live,
  close: PRESENCE_PITCH.live,
};

/** Canonical zoom level for a named state. */
export function zoomForState(state: ZoomState): number {
  return state === 'close' ? MAP_CONFIG.ZOOM_STATE_CLOSE : MAP_CONFIG.ZOOM_STATE_STREET;
}

/** Canonical pitch for a named state. */
export function pitchForState(state: ZoomState): number {
  return ZOOM_STATE_PITCH[state];
}

/**
 * Classify a continuous Mapbox zoom value into one of the two named states.
 * Uses the midpoint between street and close as the boundary.
 */
const STREET_CLOSE_MID =
  (MAP_CONFIG.ZOOM_STATE_STREET + MAP_CONFIG.ZOOM_STATE_CLOSE) / 2;

export function getZoomState(zoom: number): ZoomState {
  return zoom >= STREET_CLOSE_MID ? 'close' : 'street';
}
