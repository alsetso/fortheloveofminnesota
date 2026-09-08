/**
 * Progressive zoom-in on game map clicks — step toward max until capped.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { acquireExclusiveCameraIntent } from '@/map/location/camera/cameraIntentStore';
import { getPresenceMode } from '@/map/location/positionMode/positionModeStore';

/** Presence-aware ceiling for click zoom-in. */
export function mapClickMaxZoom(): number {
  return getPresenceMode() === 'scout'
    ? MAP_CONFIG.SCOUT_MAX_ZOOM
    : MAP_CONFIG.MAX_ZOOM;
}

/** Next zoom after one map-click step (never past max, never zooms out). */
export function resolveMapClickZoom(map: MapboxMap): number {
  const max = mapClickMaxZoom();
  const current = map.getZoom();
  return Math.min(max, current + MAP_CONFIG.MAP_CLICK_ZOOM_STEP);
}

/**
 * Ease toward click center + one zoom step (no-op zoom delta when already at max,
 * still recenters).
 */
export function easeMapClickZoomIn(
  map: MapboxMap,
  center: { lng: number; lat: number },
): void {
  const zoom = resolveMapClickZoom(map);
  acquireExclusiveCameraIntent('pinned', 1000);
  map.easeTo({
    center: [center.lng, center.lat],
    zoom,
    duration: 420,
    essential: true,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}
