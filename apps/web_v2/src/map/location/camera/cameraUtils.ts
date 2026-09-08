/**
 * Pure camera math — no React, no Mapbox, no side effects.
 *
 * Consumers:
 *   flyToFindMe — scales third-person look-ahead with zoom
 */

import { MAP_CONFIG } from '@/map/config';

/**
 * Scale factor [0 → 1] for third-person look-ahead vs zoom.
 *
 *   ≤ PITCH_FLAT_ZOOM     → 0  (dead center at birds-eye)
 *   PITCH_FLAT → FIND_ME  → ramp to 1 (Live home / street chase)
 *   FIND_ME → MAX_ZOOM    → ramp to 0 (close inspect is avatar-centered)
 *   ≥ MAX_ZOOM            → 0
 */
export function lookAheadScaleForZoom(zoom: number): number {
  const { PITCH_FLAT_ZOOM, FIND_ME_ZOOM, MAX_ZOOM } = MAP_CONFIG;
  if (zoom <= PITCH_FLAT_ZOOM) return 0;
  if (zoom >= MAX_ZOOM) return 0;
  if (zoom <= FIND_ME_ZOOM) {
    const span = FIND_ME_ZOOM - PITCH_FLAT_ZOOM;
    return span <= 0 ? 1 : (zoom - PITCH_FLAT_ZOOM) / span;
  }
  const span = MAX_ZOOM - FIND_ME_ZOOM;
  return span <= 0 ? 0 : 1 - (zoom - FIND_ME_ZOOM) / span;
}
