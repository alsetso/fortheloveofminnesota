/**
 * Scout map gestures — explicit interaction profile for unlocked browse.
 *
 * Pointer split (`(pointer: coarse)` vs fine):
 *   Touch  — one-finger pan, pinch zoom+rotate, two-finger pitch
 *   Mouse  — left-drag pan, right/Ctrl-drag rotate, wheel zoom, dbl-click zoom
 *
 * Live frame-lock stays in `setFindMeFrameLocked(true)` (center-locked zoom
 * band + pan off). Calling this clears Live's `around: 'center'` pinch so
 * Scout zooms toward the fingers again. Idempotent after Live unlock.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';

/** Mapbox handlers take typed opts; `never[]` keeps enable assignable under strictFunctionTypes. */
function safeEnable(
  handler: { enable?: (...args: never[]) => void } | undefined,
  opts?: object,
): void {
  try {
    const enable = handler?.enable as ((o?: object) => void) | undefined;
    if (!enable) return;
    if (opts !== undefined) enable(opts);
    else enable();
  } catch {
    /* handler missing on this Mapbox build */
  }
}

function safeDisable(handler: { disable?: () => void } | undefined): void {
  try {
    handler?.disable?.();
  } catch {
    /* handler missing on this Mapbox build */
  }
}

/** Prefer touch-first handlers on phones; fine pointer gets mouse rotate. */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return true;
  }
}

/** Scout hard zoom band — independent of Play / CTU floors. */
export function applyScoutZoomLimits(map: MapboxMap): void {
  const floor = MAP_CONFIG.SCOUT_MIN_ZOOM;
  const ceil = MAP_CONFIG.SCOUT_MAX_ZOOM;
  try {
    map.setMinZoom(floor);
    map.setMaxZoom(ceil);
    const z = map.getZoom();
    if (z < floor) map.setZoom(floor);
    else if (z > ceil) map.setZoom(ceil);
  } catch {
    /* style race */
  }
}

export type ScoutMapGestureOpts = {
  /**
   * Desktop right/Ctrl drag rotate. Forced off on coarse pointers so one-finger
   * pan never fights a rotate handler.
   */
  allowRotate?: boolean;
};

/**
 * Apply Scout browse gestures. Idempotent — safe after Live unlock or remount.
 */
export function applyScoutMapGestures(
  map: MapboxMap,
  opts?: ScoutMapGestureOpts,
): void {
  const coarse = isCoarsePointer();
  const allowRotate = opts?.allowRotate !== false && !coarse;

  applyScoutZoomLimits(map);

  // Coast a bit after fling — snappier than Mapbox defaults without feeling icy.
  safeEnable(map.dragPan, {
    linearity: 0.35,
    maxSpeed: 1600,
    deceleration: 3200,
  });

  // Wheel zooms toward cursor on desktop; `around: 'center'` feels wrong for browse.
  safeEnable(map.scrollZoom);
  safeEnable(map.doubleClickZoom);
  safeDisable(map.boxZoom);

  // Pinch zoom + two-finger rotate around fingers (not map center).
  // Pass `{}` so a prior Live `around: 'center'` does not stick.
  safeEnable(map.touchZoomRotate, {});
  try {
    map.touchZoomRotate.enableRotation();
  } catch {
    /* older builds */
  }

  if (map.getMaxPitch() > 0) safeEnable(map.touchPitch);
  else safeDisable(map.touchPitch);

  if (allowRotate) safeEnable(map.dragRotate);
  else safeDisable(map.dragRotate);
}
