/**
 * Avatar walk-to-target — presentation pose between GPS fixes.
 *
 * Architecture:
 *   findMeCoordsStore (passive GPS truth)
 *        ↓ setAvatarWalkTarget(next)
 *   avatarWalkController (rAF lerp A→B over forced duration)
 *        ↓ pose
 *   playerAvatarRuntime + Follow Me / Campaign chase camera
 *
 * Why not put this in displayCoords?
 *   displayCoords is shared with territories / lookups. Teleport-free walking
 *   is a *visual* concern only — keep GPS SSOT separate.
 */

import type { UserCoords } from '@/map/location/device/geolocation';
import {
  metersBetween,
  type LocomotionMode,
} from '@/map/location/device/locomotion';

export type AvatarWalkPhase = 'idle' | 'walking' | 'snapping';

/**
 * Last bearing the avatar walked along. Persists across GPS gaps so the
 * avatar holds its travel direction when stationary rather than spinning to
 * face the camera.
 */
let lastWalkBearingDeg: number | null = null;
/**
 * Last Free Mode / direct-drive yaw. Survives endAvatarDrive so release
 * consumers recompute the same facing the last painted frame used.
 * Cleared on clearAvatarWalk; overwritten when a new drive starts.
 */
let lastDrivenYawDeg: number | null = null;

export function getLastWalkBearing(): number | null {
  return lastWalkBearingDeg;
}

/** Sticky drive yaw for post-release paint / yaw resolution. */
export function getLastDrivenYaw(): number | null {
  return lastDrivenYawDeg;
}

export type AvatarWalkSnapshot = {
  /** Interpolated pose for the 3D player + third-person camera. */
  pose: UserCoords | null;
  /** Latest GPS/target the controller is walking toward. */
  target: UserCoords | null;
  phase: AvatarWalkPhase;
  /** 0–1 along the current A→B segment. */
  progress: number;
  /** Bearing along the current segment (degrees), or null if idle. */
  pathBearingDeg: number | null;
};

export type SetAvatarWalkTargetOptions = {
  /**
   * Force the A→B duration (ms). When omitted, duration = distance / walkSpeed
   * clamped to [min,max].
   */
  forceDurationMs?: number;
  /** Locomotion hint — picks walk vs fast speed when duration not forced. */
  mode?: LocomotionMode;
  /** Snap immediately (cold open / >snap distance / cache resume). */
  snap?: boolean;
};

/** Typical pedestrian speed used to force walk time from A→B. */
export const AVATAR_WALK_SPEED_M_S = 1.35;
/** Faster glide when GPS says movingFast (bike/car-ish). */
export const AVATAR_FAST_SPEED_M_S = 8;
/** Ignore GPS jitter below this. */
export const AVATAR_WALK_IGNORE_M = 0.6;
/** Beyond this, snap (or use fast speed if mode is movingFast). */
export const AVATAR_WALK_SNAP_M = 75;
export const AVATAR_WALK_MIN_DURATION_MS = 350;
export const AVATAR_WALK_MAX_DURATION_MS = 6_000;

type Listener = () => void;

type Segment = {
  from: UserCoords;
  to: UserCoords;
  startMs: number;
  durationMs: number;
  pathBearingDeg: number;
};

let pose: UserCoords | null = null;
let target: UserCoords | null = null;
let phase: AvatarWalkPhase = 'idle';
let progress = 0;
let pathBearingDeg: number | null = null;
let segment: Segment | null = null;
let raf = 0;
let snapshot: AvatarWalkSnapshot = {
  pose: null,
  target: null,
  phase: 'idle',
  progress: 0,
  pathBearingDeg: null,
};

const listeners = new Set<Listener>();

function emit() {
  snapshot = {
    pose,
    target,
    phase,
    progress,
    pathBearingDeg,
  };
  for (const l of listeners) l();
}

export function getAvatarWalkSnapshot(): AvatarWalkSnapshot {
  return snapshot;
}

export function getAvatarPresentationCoords(): UserCoords | null {
  return snapshot.pose ?? snapshot.target;
}

export function subscribeAvatarWalk(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function bearingDeg(from: UserCoords, to: UserCoords): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = (Math.atan2(y, x) * 180) / Math.PI;
  return (θ + 360) % 360;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function mixPose(from: UserCoords, to: UserCoords, t: number): UserCoords {
  const u = easeInOutCubic(Math.min(1, Math.max(0, t)));
  return {
    lat: lerp(from.lat, to.lat, u),
    lng: lerp(from.lng, to.lng, u),
    accuracy: to.accuracy,
    speed: to.speed,
    course: to.course ?? from.course,
  };
}

function resolveDurationMs(
  distanceM: number,
  opts?: SetAvatarWalkTargetOptions,
): number {
  if (
    typeof opts?.forceDurationMs === 'number' &&
    Number.isFinite(opts.forceDurationMs) &&
    opts.forceDurationMs > 0
  ) {
    return opts.forceDurationMs;
  }
  const speed =
    opts?.mode === 'movingFast' ? AVATAR_FAST_SPEED_M_S : AVATAR_WALK_SPEED_M_S;
  const raw = (distanceM / Math.max(speed, 0.1)) * 1000;
  return Math.min(
    AVATAR_WALK_MAX_DURATION_MS,
    Math.max(AVATAR_WALK_MIN_DURATION_MS, raw),
  );
}

function stopRaf() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

function finishSegment(finalPose: UserCoords) {
  stopRaf();
  segment = null;
  pose = finalPose;
  phase = 'idle';
  progress = 1;
  pathBearingDeg = null;
  emit();
}

function tick(now: number) {
  raf = 0;
  if (!segment) return;

  const t = (now - segment.startMs) / segment.durationMs;
  if (t >= 1) {
    finishSegment({
      lat: segment.to.lat,
      lng: segment.to.lng,
      accuracy: segment.to.accuracy,
      speed: segment.to.speed,
      course: segment.to.course,
    });
    // If target moved again during the last frame, start a new segment.
    if (
      target &&
      metersBetween(pose!, target) >= AVATAR_WALK_IGNORE_M
    ) {
      beginSegment(pose!, target, { mode: 'walking' });
    }
    return;
  }

  progress = t;
  pose = mixPose(segment.from, segment.to, t);
  pathBearingDeg = segment.pathBearingDeg;
  phase = 'walking';
  emit();
  raf = requestAnimationFrame(tick);
}

function beginSegment(
  from: UserCoords,
  to: UserCoords,
  opts?: SetAvatarWalkTargetOptions,
) {
  const distanceM = metersBetween(from, to);
  if (distanceM < AVATAR_WALK_IGNORE_M) {
    finishSegment({
      lat: to.lat,
      lng: to.lng,
      accuracy: to.accuracy,
      speed: to.speed,
      course: to.course,
    });
    return;
  }

  const durationMs = resolveDurationMs(distanceM, opts);
  segment = {
    from: { ...from },
    to: { ...to },
    startMs: performance.now(),
    durationMs,
    pathBearingDeg: bearingDeg(from, to),
  };
  lastWalkBearingDeg = segment.pathBearingDeg;
  phase = 'walking';
  progress = 0;
  pathBearingDeg = segment.pathBearingDeg;
  pose = { ...from };
  emit();
  stopRaf();
  raf = requestAnimationFrame(tick);
}

function snapTo(next: UserCoords) {
  stopRaf();
  segment = null;
  pose = {
    lat: next.lat,
    lng: next.lng,
    accuracy: next.accuracy,
    speed: next.speed,
    course: next.course,
  };
  target = pose;
  phase = 'snapping';
  progress = 1;
  pathBearingDeg = null;
  emit();
  // Return to idle next frame so consumers can distinguish a one-shot snap.
  phase = 'idle';
  emit();
}

/**
 * Push a new GPS/target fix. Retargets from the *current interpolated pose*
 * (never from the old target) so the avatar never flashes/teleports.
 *
 * Passing null does **not** clear pose anymore — use {@link clearAvatarWalk}
 * only when Find Me fully stops. Sticky pose survives GPS gaps / refresh.
 */
export function setAvatarWalkTarget(
  next: UserCoords | null,
  opts?: SetAvatarWalkTargetOptions,
): void {
  if (next == null) {
    return;
  }

  const nextTarget = {
    lat: next.lat,
    lng: next.lng,
    accuracy: next.accuracy,
    speed: next.speed,
    course: next.course,
  };

  // Same destination already in flight — do not restart the segment (avoids
  // React effect ↔ emit feedback loops).
  if (
    target &&
    metersBetween(target, nextTarget) < AVATAR_WALK_IGNORE_M &&
    (phase === 'walking' || phase === 'idle') &&
    opts?.snap !== true
  ) {
    target = nextTarget;
    return;
  }

  target = nextTarget;

  if (pose == null || opts?.snap === true) {
    snapTo(target);
    return;
  }

  const distanceM = metersBetween(pose, target);
  if (distanceM < AVATAR_WALK_IGNORE_M) {
    // Absorb jitter into target without moving.
    return;
  }

  if (distanceM >= AVATAR_WALK_SNAP_M) {
    if (opts?.mode === 'movingFast') {
      // Vehicle/bike jump — short 300ms ease so the reposition reads as fast
      // motion rather than an abrupt teleport.
      beginSegment(pose, target, { ...opts, forceDurationMs: 300 });
      return;
    }
    // Clear relocation (user walked away, drove overnight) — snap instantly.
    if (opts?.forceDurationMs == null && opts?.mode !== 'walking') {
      snapTo(target);
      return;
    }
  }

  // Retarget mid-stride from wherever we are now.
  beginSegment(pose, target, opts);
}

/**
 * Free Mode direct drive — the controller integrates position itself
 * (meters → lat/lng each frame) and pushes the exact pose here. No lerp
 * segment: the pose IS the truth. Phase is 'walking' while driven so
 * path-bearing yaw matches GPS walking.
 *
 * `silent: true` updates the snapshot without waking subscribers — Free Mode
 * owns paint + chase in the same rAF so emit fan-out cannot desync them.
 */
export function driveAvatarPose(
  next: UserCoords,
  headingDeg: number | null,
  opts?: { silent?: boolean },
): void {
  stopRaf();
  segment = null;
  pose = {
    lat: next.lat,
    lng: next.lng,
    accuracy: next.accuracy,
    speed: next.speed,
    course: next.course,
  };
  target = pose;
  phase = 'walking';
  progress = 1;
  pathBearingDeg = headingDeg;
  if (headingDeg != null) {
    lastWalkBearingDeg = headingDeg;
    lastDrivenYawDeg = headingDeg;
  }
  if (opts?.silent) {
    snapshot = {
      pose,
      target,
      phase,
      progress,
      pathBearingDeg,
    };
    return;
  }
  emit();
}

export type EndAvatarDriveOpts = {
  /** Update snapshot without waking subscribers (release ownership withdraw). */
  silent?: boolean;
  /** Latch this as sticky yaw before clearing pathBearingDeg. */
  freezeYawDeg?: number | null;
};

/**
 * End a direct drive (input released) — idle, keep pose + sticky yaw.
 * Does NOT invent a new facing: freezes the last driven yaw so any later
 * consumer recomputes the same mesh orientation as the terminal frame.
 */
export function endAvatarDrive(opts?: EndAvatarDriveOpts): void {
  if (segment) return; // a lerp segment owns the phase — don't clobber it
  if (phase === 'idle' && opts?.freezeYawDeg == null) return;

  if (typeof opts?.freezeYawDeg === 'number' && Number.isFinite(opts.freezeYawDeg)) {
    lastDrivenYawDeg = opts.freezeYawDeg;
    lastWalkBearingDeg = opts.freezeYawDeg;
  } else if (pathBearingDeg != null) {
    lastDrivenYawDeg = pathBearingDeg;
  }

  phase = 'idle';
  pathBearingDeg = null;
  if (opts?.silent) {
    snapshot = {
      pose,
      target,
      phase,
      progress,
      pathBearingDeg,
    };
    return;
  }
  emit();
}

/** Clear presentation state (Find Me stop / leave Game). */
export function clearAvatarWalk(): void {
  stopRaf();
  segment = null;
  pose = null;
  target = null;
  phase = 'idle';
  progress = 0;
  pathBearingDeg = null;
  lastWalkBearingDeg = null;
  lastDrivenYawDeg = null;
  emit();
}
