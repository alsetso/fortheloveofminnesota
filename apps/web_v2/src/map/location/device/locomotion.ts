/**
 * Speed → locomotion mode (stationary / walking / movingFast) with hysteresis.
 * Used for accuracy gates, display-pose EMA, camera follow, and Despia refresh.
 */

import { MAP_CONFIG } from '@/map/config';
import type { UserCoords } from '@/map/location/device/geolocation';

export type LocomotionMode = 'stationary' | 'walking' | 'movingFast';

// ─── Speed tier (display / UX) ────────────────────────────────────────────────

/**
 * Human-facing speed tier — coarser than LocomotionMode, used for UI labels,
 * speedometer coloring, and driving-mode detection.
 */
export type SpeedTier = 'parked' | 'walking' | 'moving' | 'vehicle';

export function resolveSpeedTier(speedMps: number | null): SpeedTier {
  if (speedMps == null || speedMps < 0.5) return 'parked';
  if (speedMps >= MAP_CONFIG.VEHICLE_SPEED_MPS) return 'vehicle';
  if (speedMps >= MAP_CONFIG.LOCOMOTION.enterMovingFastMps) return 'moving';
  return 'walking';
}

export const SPEED_TIER_LABEL: Record<SpeedTier, string> = {
  parked:  'Parked',
  walking: 'Walking',
  moving:  'Moving',
  vehicle: 'In a vehicle',
};

export type LocomotionFollowPolicy = {
  /** When false, Follow Me updates the puck but does not ease the camera. */
  enabled: boolean;
  /** Min displacement (metres) before a follow ease runs. */
  minDeltaM: number;
  /** Mapbox easeTo duration for follow. */
  durationMs: number;
};

export type DespiaWatchParams = {
  bufferSeconds: number;
  movementCm: number;
};

export type LocomotionProfile = {
  maxAccuracyM: number;
  displayAlpha: number;
  follow: LocomotionFollowPolicy;
  despia: DespiaWatchParams;
  /** Prefer GPS course over device gyro for facing / heading-up. */
  preferGpsCourse: boolean;
};

export type FollowDecision = {
  /** Ease or jump the locked camera to the new pose. */
  shouldMoveCamera: boolean;
  durationMs: number;
  /** While orbiting, jump instead of ease so the pivot stays under the finger. */
  useJump: boolean;
};

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function metersBetween(a: UserCoords, b: UserCoords): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Prefer GPS speed; otherwise estimate from displacement / dt between accepted fixes.
 */
export function resolveSpeedMps(
  next: UserCoords,
  prev: UserCoords | null,
  prevAtMs: number | null,
  nowMs: number,
): number | null {
  if (typeof next.speed === 'number' && Number.isFinite(next.speed) && next.speed >= 0) {
    return next.speed;
  }
  if (!prev || prevAtMs == null) return null;
  const dtSec = (nowMs - prevAtMs) / 1000;
  if (dtSec < 0.4 || dtSec > 90) return null;
  return metersBetween(prev, next) / dtSec;
}

/**
 * Hysteresis so noise around thresholds does not flicker mode.
 * Defaults assume walking until we have a confident sample.
 */
export function nextLocomotionMode(
  current: LocomotionMode,
  speedMps: number | null,
): LocomotionMode {
  if (speedMps == null || !Number.isFinite(speedMps)) return current;

  const {
    enterStationaryMps,
    leaveStationaryMps,
    enterMovingFastMps,
    leaveMovingFastMps,
  } = MAP_CONFIG.LOCOMOTION;

  if (current === 'stationary') {
    if (speedMps < leaveStationaryMps) return 'stationary';
    return speedMps >= enterMovingFastMps ? 'movingFast' : 'walking';
  }

  if (current === 'movingFast') {
    if (speedMps >= leaveMovingFastMps) return 'movingFast';
    return speedMps < enterStationaryMps ? 'stationary' : 'walking';
  }

  // walking
  if (speedMps >= enterMovingFastMps) return 'movingFast';
  if (speedMps < enterStationaryMps) return 'stationary';
  return 'walking';
}

export function locomotionProfile(mode: LocomotionMode): LocomotionProfile {
  return MAP_CONFIG.LOCOMOTION.profiles[mode];
}

export function maxAccuracyMForMode(mode: LocomotionMode): number {
  return locomotionProfile(mode).maxAccuracyM;
}

export function displayAlphaForMode(mode: LocomotionMode): number {
  return locomotionProfile(mode).displayAlpha;
}

export function followPolicyForMode(mode: LocomotionMode): LocomotionFollowPolicy {
  return locomotionProfile(mode).follow;
}

export function despiaParamsForMode(mode: LocomotionMode): DespiaWatchParams {
  return locomotionProfile(mode).despia;
}

/**
 * Facing for the puck wedge / optional heading-up camera.
 * movingFast prefers GPS course; stationary + walking use gyro.
 */
export function resolveFacingHeading(
  mode: LocomotionMode,
  course: number | null | undefined,
  gyro: number | null | undefined,
): number | null {
  if (locomotionProfile(mode).preferGpsCourse) {
    if (typeof course === 'number' && Number.isFinite(course)) return course;
  }
  if (typeof gyro === 'number' && Number.isFinite(gyro)) return gyro;
  return null;
}

/**
 * When raw GPS displacement exceeds this, the user has clearly relocated (e.g.
 * drove somewhere) rather than just drifting due to GPS noise. Bypass the
 * stationary `enabled: false` gate so the camera always jumps to the new spot.
 */
const LARGE_DISPLACEMENT_FOLLOW_M = 100;

/**
 * Continuous Follow Me camera decision from mode + displacement + orbit state.
 * Stationary holds the camera; walk / moving-fast ease when past minΔ.
 * Large displacements (>100 m) always move the camera regardless of mode.
 */
export function resolveFollowDecision(opts: {
  mode: LocomotionMode;
  deltaM: number;
  isOrbiting: boolean;
}): FollowDecision {
  const policy = followPolicyForMode(opts.mode);
  // User has clearly moved to a new place — override stationary/minDelta gate.
  if (opts.deltaM >= LARGE_DISPLACEMENT_FOLLOW_M) {
    return {
      shouldMoveCamera: true,
      durationMs: policy.durationMs,
      useJump: opts.isOrbiting,
    };
  }
  if (!policy.enabled || opts.deltaM < policy.minDeltaM) {
    return {
      shouldMoveCamera: false,
      durationMs: policy.durationMs,
      useJump: false,
    };
  }
  return {
    shouldMoveCamera: true,
    durationMs: policy.durationMs,
    useJump: opts.isOrbiting,
  };
}

/** Shortest signed angular delta in [-180, 180]. */
function angularDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** EMA toward raw fix. Alpha 1 = snap; low alpha = calm (stationary). */
export function blendDisplayPose(
  display: UserCoords | null,
  raw: UserCoords,
  alpha: number,
): UserCoords {
  const a = Math.min(1, Math.max(0, alpha));
  if (!display || a >= 0.999) {
    return {
      lat: raw.lat,
      lng: raw.lng,
      accuracy: raw.accuracy,
      speed: raw.speed,
      course: raw.course,
    };
  }
  // Smooth course through the 359→0 boundary with circular EMA.
  const smoothedCourse =
    typeof display.course === 'number' && typeof raw.course === 'number'
      ? (display.course + angularDelta(display.course, raw.course) * a + 360) % 360
      : raw.course;
  return {
    lat: display.lat + (raw.lat - display.lat) * a,
    lng: display.lng + (raw.lng - display.lng) * a,
    accuracy: raw.accuracy,
    speed: raw.speed,
    course: smoothedCourse,
  };
}
