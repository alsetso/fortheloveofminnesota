import type { Map as MapboxMap, PaddingOptions } from 'mapbox-gl';
import { getCtuFloorZoom } from '@/features/map/territory/ctuFloorZoomStore';
import { MAP_CONFIG } from '@/map/config';
import { lookAheadScaleForZoom } from '@/map/location/camera/cameraUtils';
import { applyScoutMapGestures } from '@/map/location/camera/scoutMapGestures';
import { pitchForState } from '@/map/location/camera/zoomStateUtils';
import type { UserCoords } from '@/map/location/device/geolocation';

export type FindMeCameraMode = 'fly' | 'jump' | 'ease';

export type FindMeCameraOptions = {
  /**
   * When true and `bearing` is a number, drive map bearing from device heading.
   * Otherwise preserve the current map bearing (no snap-to-zero).
   */
  compassMode?: boolean;
  /** Degrees clockwise from north (Mapbox). Ignored unless compassMode. */
  bearing?: number | null;
  /**
   * When false, center exactly on the user (no third-person look-ahead).
   * Default true for Game Follow Me.
   */
  thirdPerson?: boolean;
  /**
   * When true, keep the current map zoom instead of snapping to FIND_ME_ZOOM.
   * Use for relocations and soft re-centers so the user's pinched zoom is
   * respected. Initial attach (boot / Find Me tap) leaves this false so the
   * canonical street-level frame is always restored.
   */
  preserveZoom?: boolean;
  /**
   * Explicit target zoom for the initial camera attach. Overrides FIND_ME_ZOOM.
   * Ignored when preserveZoom is true. Used by follow-mode entry to land at
   * ZOOM_STATE_CLOSE rather than the default street-level zoom.
   */
  overrideZoom?: number;
};

/**
 * Stable Follow Me padding — dock overlays the map; it must not grow camera
 * padding as the sheet opens (that reframes / "pushes" the map).
 * Clears the collapsed pill / rail footprint + map bleed only.
 */
export function findMeFollowPadding(): PaddingOptions {
  return {
    top: 0,
    left: 0,
    right: 0,
    bottom: MAP_CONFIG.FIND_ME_PADDING_BOTTOM_PX + MAP_CONFIG.BLEED_BOTTOM_PX + 12,
  };
}

function clampZoom(zoom: number): number {
  return Math.min(MAP_CONFIG.MAX_ZOOM, Math.max(MAP_CONFIG.MIN_ZOOM, zoom));
}

/** Offset lng/lat along map bearing (0° = north, 90° = east). */
export function offsetByBearingMeters(
  lng: number,
  lat: number,
  bearingDeg: number,
  distanceM: number,
): { lng: number; lat: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (distanceM * Math.cos(rad)) / 111_320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const metersPerDegLng = 111_320 * Math.max(cosLat, 1e-6);
  const dLng = (distanceM * Math.sin(rad)) / metersPerDegLng;
  return { lng: lng + dLng, lat: lat + dLat };
}

/**
 * Speed-aware third-person look-ahead distance.
 *
 * Stationary / walking → base 6 m keeps the avatar large and centred.
 * Cycling / driving → scales up so you see what's ahead:
 *   ~12 m at 4 m/s (bike), ~40 m at 13+ m/s (car).
 *
 * When zoom is provided the result is multiplied by `lookAheadScaleForZoom`
 * so the offset fades to zero at birds-eye zoom — the user expects the
 * avatar dead-centre at that frame, not slightly off-axis.
 */
export function resolveLookAheadM(
  speedMps: number | null | undefined,
  zoom?: number,
): number {
  const base = MAP_CONFIG.FIND_ME_LOOK_AHEAD_M;
  let distM: number;
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps < 0) {
    distM = base;
  } else {
    distM = Math.min(40, Math.max(base, speedMps * 3));
  }
  if (zoom !== undefined) distM *= lookAheadScaleForZoom(zoom);
  return distM;
}

/**
 * Ground point the pitched camera looks at — slightly ahead of the avatar so
 * the camera trails behind (third person, always see his back).
 */
export function thirdPersonCameraCenter(
  lng: number,
  lat: number,
  bearingDeg: number,
  lookAheadM: number = MAP_CONFIG.FIND_ME_LOOK_AHEAD_M,
): { lng: number; lat: number } {
  return offsetByBearingMeters(lng, lat, bearingDeg, lookAheadM);
}

function resolveBearing(map: MapboxMap, opts?: FindMeCameraOptions): number {
  const useHeading =
    opts?.compassMode === true &&
    typeof opts.bearing === 'number' &&
    Number.isFinite(opts.bearing);
  return useHeading ? opts!.bearing! : map.getBearing();
}

function centerZoomBearing(
  map: MapboxMap,
  coords: UserCoords,
  opts?: FindMeCameraOptions & {
    /** Speed-resolved look-ahead from resolveLookAheadM — overrides map config default. */
    lookAheadM?: number;
  },
) {
  const bearing = resolveBearing(map, opts);
  const thirdPerson = opts?.thirdPerson !== false;
  const lookAt = thirdPerson
    ? thirdPersonCameraCenter(coords.lng, coords.lat, bearing, opts?.lookAheadM)
    : { lng: coords.lng, lat: coords.lat };
  const zoom = opts?.preserveZoom
    ? clampZoom(map.getZoom())
    : clampZoom(opts?.overrideZoom ?? MAP_CONFIG.FIND_ME_ZOOM);
  return {
    center: [lookAt.lng, lookAt.lat] as [number, number],
    zoom,
    bearing,
    padding: findMeFollowPadding(),
  };
}

/** User gesture — smooth Mapbox spline into neighborhood frame. */
export function flyToFindMe(
  map: MapboxMap,
  coords: UserCoords,
  opts?: FindMeCameraOptions,
): void {
  map.flyTo({
    ...centerZoomBearing(map, coords, opts),
    pitch: pitchForState('close'),
    speed: 0.85,
    curve: 1.55,
    essential: true,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

/**
 * Uber-style cold open — land on last-known / first fix immediately.
 * Lands at Live Presence pitch.
 */
export function jumpToFindMe(
  map: MapboxMap,
  coords: UserCoords,
  opts?: FindMeCameraOptions,
): void {
  const czb = centerZoomBearing(map, coords, opts);
  map.jumpTo({
    ...czb,
    pitch: pitchForState('close'),
  });
}

/**
 * Short refine after a cached jump when fresh GPS lands.
 * Always preserves the current zoom so the post-boot ease doesn't
 * override a zoom the user applied in the 2–5 s gap between the
 * cached jump and the first live GPS fix arriving.
 */
export function easeToFindMe(
  map: MapboxMap,
  coords: UserCoords,
  opts?: FindMeCameraOptions,
): void {
  const czb = centerZoomBearing(map, coords, { ...opts, preserveZoom: true });
  map.easeTo({
    ...czb,
    pitch: pitchForState('close'),
    duration: 650,
    essential: true,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

/**
 * Continuous Follow Me — short ease so the locked frame tracks GPS (+ heading).
 * Preserves pinch zoom + user pitch so follow ticks don't fight gestures.
 * Pass `lookAheadM` from `resolveLookAheadM(speed, zoom)` for speed-scaled
 * and zoom-scaled framing.
 */
export function followToFindMe(
  map: MapboxMap,
  coords: UserCoords,
  opts?: FindMeCameraOptions & { durationMs?: number; lookAheadM?: number },
): void {
  map.easeTo({
    ...centerZoomBearing(map, coords, { ...opts, preserveZoom: true }),
    pitch: map.getPitch(),
    duration: opts?.durationMs ?? 320,
    essential: true,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

function findMeLookAt(
  map: MapboxMap,
  coords: UserCoords,
): { lng: number; lat: number } {
  const zoom = map.getZoom();
  const lookAheadM = resolveLookAheadM(undefined, zoom);
  return thirdPersonCameraCenter(
    coords.lng,
    coords.lat,
    map.getBearing(),
    lookAheadM,
  );
}

/**
 * Snap center back onto the third-person look-at while keeping zoom / pitch / bearing.
 * Safety net after gestures; Live should not drift in the first place
 * (`touchZoomRotate` + `scrollZoom` use `around: 'center'`).
 */
export function pinFindMeCenter(map: MapboxMap, coords: UserCoords): void {
  const lookAt = findMeLookAt(map, coords);
  map.jumpTo({
    center: [lookAt.lng, lookAt.lat],
    zoom: clampZoom(map.getZoom()),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    padding: findMeFollowPadding(),
  });
}

/**
 * Mid-gesture center hold — corrects lng/lat only so pinch zoom / pitch
 * keep working. Pokemon Go style: avatar look-at never leaves the frame.
 */
export function holdFindMeCenter(map: MapboxMap, coords: UserCoords): void {
  const lookAt = findMeLookAt(map, coords);
  const center = map.getCenter();
  // Sub-meter epsilon — ignore float jitter, catch any pinch drift immediately.
  if (
    Math.abs(center.lng - lookAt.lng) < 1e-7 &&
    Math.abs(center.lat - lookAt.lat) < 1e-7
  ) {
    return;
  }
  map.setCenter([lookAt.lng, lookAt.lat]);
}

export function moveCameraToFindMe(
  map: MapboxMap,
  coords: UserCoords,
  mode: FindMeCameraMode,
  opts?: FindMeCameraOptions,
): void {
  if (mode === 'jump') jumpToFindMe(map, coords, opts);
  else if (mode === 'ease') easeToFindMe(map, coords, opts);
  else flyToFindMe(map, coords, opts);
}

/**
 * Live Presence frame lock (Pokemon Go posture):
 * - Pan off — avatar look-at owns the center; no pull-away.
 * - Pinch + scroll zoom around map center (avatar frame), band
 *   [ZOOM_STATE_CLOSE → MAX_ZOOM].
 * - Pinch rotation off — one-finger orbit owns bearing.
 * - Two-finger pitch stays on.
 *
 * Unlock:
 * - Scout (`allowPitch` default) → {@link applyScoutMapGestures}
 * - Flat atlas (`allowPitch: false`) → pan/zoom only
 */
let findMeZoomLocked = false;

/**
 * True while Live follow owns the zoom band (floor = Live home, ceil = MAX).
 * CTU / Explore floor setters must not reopen below the Live home zoom.
 */
export function isFindMeZoomLocked(): boolean {
  return findMeZoomLocked;
}

export function setFindMeFrameLocked(
  map: MapboxMap,
  locked: boolean,
  opts?: { compassMode?: boolean; allowRotate?: boolean; allowPitch?: boolean },
): void {
  const allowPitch = opts?.allowPitch !== false && map.getMaxPitch() > 0;
  const disable = (handler: { disable?: () => void } | undefined) => {
    try {
      handler?.disable?.();
    } catch {
      /* handler missing on this Mapbox build */
    }
  };
  // Mapbox handlers take typed opts; `never[]` keeps enable assignable under strictFunctionTypes.
  const enable = (
    handler: { enable?: (...args: never[]) => void } | undefined,
    enableOpts?: object,
  ) => {
    try {
      const fn = handler?.enable as ((o?: object) => void) | undefined;
      if (!fn) return;
      if (enableOpts !== undefined) fn(enableOpts);
      else fn();
    } catch {
      /* handler missing on this Mapbox build */
    }
  };

  findMeZoomLocked = locked;

  if (locked) {
    const floor = MAP_CONFIG.ZOOM_STATE_CLOSE;
    const ceil = MAP_CONFIG.MAX_ZOOM;
    try {
      map.setMinZoom(floor);
      map.setMaxZoom(ceil);
      const z = map.getZoom();
      // Clamp into the inspect band — do not snap to floor (preserves pinch).
      if (z < floor) map.setZoom(floor);
      else if (z > ceil) map.setZoom(ceil);
    } catch {
      /* style race */
    }
    map.dragPan.disable();
    disable(map.boxZoom);
    // Zoom around viewport center (= Live look-at). Without `around: 'center'`,
    // Mapbox pinches around the finger midpoint and the frame drifts away.
    enable(map.scrollZoom, { around: 'center' });
    enable(map.doubleClickZoom);
    enable(map.touchZoomRotate, { around: 'center' });
    try {
      // Pinch = zoom only; one-finger orbit owns bearing.
      map.touchZoomRotate.disableRotation();
    } catch {
      /* older builds */
    }
    if (allowPitch) map.touchPitch.enable();
    else map.touchPitch.disable();
    // Desktop rotate: Live uses one-finger/pointer orbit instead of dragRotate.
    map.dragRotate.disable();
    return;
  }

  // Flat atlas / Explore — pan + zoom, no pitch/rotate.
  if (opts?.allowPitch === false) {
    try {
      map.setMinZoom(getCtuFloorZoom() ?? MAP_CONFIG.MIN_ZOOM);
      map.setMaxZoom(MAP_CONFIG.MAX_ZOOM);
    } catch {
      /* style race */
    }
    map.dragPan.enable();
    enable(map.scrollZoom);
    enable(map.boxZoom);
    enable(map.doubleClickZoom);
    enable(map.touchZoomRotate);
    try {
      map.touchZoomRotate.disableRotation();
    } catch {
      /* older builds */
    }
    map.touchPitch.disable();
    if (opts?.allowRotate === false) map.dragRotate.disable();
    else map.dragRotate.enable();
    return;
  }

  // Scout browse — pointer-aware pan / pinch / wheel / orbit profile.
  applyScoutMapGestures(map, { allowRotate: opts?.allowRotate !== false });
}
