/**
 * Shared Find Me coordinates — Find Me session writes; map UI reads.
 * Cached snapshot for useSyncExternalStore.
 *
 * `coords` — raw accepted GPS (territories / presence / lookups).
 * `displayCoords` — EMA-smoothed pose for puck + Follow Me camera.
 * `lookupCoords` — first fix of a session for address / territories.
 * `mode` — stationary | walking | movingFast from speed (+ hysteresis).
 *
 * Two subscription tiers:
 *  - `subscribeFindMeCoords` — every accepted fix (puck / camera).
 *  - `subscribePassiveFindMeCoords` — first fix + moves >=PASSIVE_MIN_DELTA_M
 *    (Today / territories — avoids re-renders every 5s GPS tick).
 */

import type { UserCoords } from '@/map/location/device/geolocation';
import {
  blendDisplayPose,
  displayAlphaForMode,
  maxAccuracyMForMode,
  metersBetween,
  nextLocomotionMode,
  resolveSpeedMps,
  type LocomotionMode,
} from '@/map/location/device/locomotion';

export type FindMeCoordsSnapshot = {
  /** Raw accepted GPS fix. */
  coords: UserCoords | null;
  /** EMA display pose for map chrome (falls back to coords when null). */
  displayCoords: UserCoords | null;
  /** First fix of this Find Me session — address / territory lookups. */
  lookupCoords: UserCoords | null;
  /** Speed-based locomotion mode. */
  mode: LocomotionMode;
  /**
   * True once a real speed reading (GPS speed or displacement) has been
   * computed. The label stays hidden until this is true so the puck doesn't
   * immediately show "walking" when no movement has occurred yet.
   */
  modeKnown: boolean;
  /** True once a non-cache GPS fix has been accepted this session. */
  hasLiveFix: boolean;
};

export type SetFindMeCoordsOptions = {
  /**
   * Soft resume / cold open from cache — skip accuracy reject and snap display.
   */
  fromCache?: boolean;
  /** Force display pose = raw (first live attach). */
  snapDisplay?: boolean;
};

export type SetFindMeCoordsResult = {
  accepted: boolean;
  mode: LocomotionMode;
  modeChanged: boolean;
};

type Listener = () => void;

/** Min displacement before passive subscribers are notified. */
const PASSIVE_MIN_DELTA_M = 25;

/**
 * When GPS jumps more than this from the current display pose (user relocated —
 * e.g. drove overnight, backgrounded app), snap displayCoords to the raw fix
 * immediately instead of EMA-blending slowly toward it. Without this, stationary
 * alpha (0.08) takes ~5 minutes to converge, making recenterFindMe send the
 * camera to the wrong place.
 */
const SNAP_LARGE_DISPLACEMENT_M = 100;

let coords: UserCoords | null = null;
let displayCoords: UserCoords | null = null;
let lookupCoords: UserCoords | null = null;
let mode: LocomotionMode = 'walking';
let modeKnown = false;
let hasLiveFix = false;
let lastAcceptedAtMs: number | null = null;
let acceptedCount = 0;

let snapshot: FindMeCoordsSnapshot = {
  coords: null,
  displayCoords: null,
  lookupCoords: null,
  mode: 'walking',
  modeKnown: false,
  hasLiveFix: false,
};
const listeners = new Set<Listener>();

// Passive tier — fires on first fix and on significant displacement.
const passiveListeners = new Set<Listener>();
let lastPassiveCoords: UserCoords | null = null;

function emitPassive() {
  lastPassiveCoords = coords;
  for (const listener of passiveListeners) listener();
}

function emit(rawMoved: boolean) {
  snapshot = { coords, displayCoords, lookupCoords, mode, modeKnown, hasLiveFix };
  for (const listener of listeners) listener();

  // Notify passive subscribers only on first fix or significant movement.
  if (!rawMoved) return;
  if (
    coords == null ||
    lastPassiveCoords == null ||
    metersBetween(lastPassiveCoords, coords) >= PASSIVE_MIN_DELTA_M
  ) {
    emitPassive();
  }
}

function sameFix(a: UserCoords, b: UserCoords): boolean {
  return (
    a.lat === b.lat &&
    a.lng === b.lng &&
    a.accuracy === b.accuracy &&
    a.speed === b.speed &&
    a.course === b.course
  );
}

export function getFindMeCoordsSnapshot(): FindMeCoordsSnapshot {
  return snapshot;
}

/** Pose for puck / Follow Me — smoothed when available. */
export function getFindMeDisplayCoords(
  snap: FindMeCoordsSnapshot = snapshot,
): UserCoords | null {
  return snap.displayCoords ?? snap.coords;
}

export function subscribeFindMeCoords(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Coarse subscription — fires on the first fix of a session and whenever
 * the raw position moves >=25m. Use this for Today / territories
 * to avoid unnecessary re-renders on every 5s GPS tick.
 */
export function subscribePassiveFindMeCoords(listener: Listener): () => void {
  passiveListeners.add(listener);
  return () => {
    passiveListeners.delete(listener);
  };
}

/** Min displacement before lookupCoords (address/territory anchor) refreshes. */
const LOOKUP_REFRESH_M = 5_000;

export function setFindMeCoords(
  next: UserCoords | null,
  opts?: SetFindMeCoordsOptions,
): SetFindMeCoordsResult {
  if (next == null) {
    if (coords == null && displayCoords == null && lookupCoords == null) {
      return { accepted: false, mode, modeChanged: false };
    }
    coords = null;
    displayCoords = null;
    lookupCoords = null;
    mode = 'walking';
    modeKnown = false;
    hasLiveFix = false;
    lastAcceptedAtMs = null;
    acceptedCount = 0;
    lastPassiveCoords = null;
    emit(false);
    return { accepted: true, mode, modeChanged: false };
  }

  const now = Date.now();
  const fromCache = opts?.fromCache === true;
  const speed = resolveSpeedMps(next, coords, lastAcceptedAtMs, now);
  const prevMode = mode;
  const nextMode = fromCache ? mode : nextLocomotionMode(mode, speed);

  // Accuracy gate — never reject the first live fix or a cached soft resume.
  if (!fromCache && acceptedCount > 0) {
    const maxAcc = maxAccuracyMForMode(nextMode);
    if (
      typeof next.accuracy === 'number' &&
      Number.isFinite(next.accuracy) &&
      next.accuracy > maxAcc
    ) {
      return { accepted: false, mode: prevMode, modeChanged: false };
    }
  }

  if (coords && sameFix(next, coords) && !opts?.snapDisplay) {
    return { accepted: false, mode: prevMode, modeChanged: false };
  }

  const prevCoords = coords;
  mode = nextMode;
  const modeChanged = mode !== prevMode;
  // Mode is considered known once we have an actual speed reading.
  if (!fromCache && speed !== null) modeKnown = true;
  if (!fromCache) hasLiveFix = true;

  const snapDisplay =
    opts?.snapDisplay === true ||
    fromCache ||
    displayCoords == null ||
    acceptedCount === 0 ||
    (displayCoords != null && metersBetween(displayCoords, next) >= SNAP_LARGE_DISPLACEMENT_M);

  if (snapDisplay) {
    displayCoords = {
      lat: next.lat,
      lng: next.lng,
      accuracy: next.accuracy,
      speed: next.speed,
      course: next.course,
    };
  } else {
    displayCoords = blendDisplayPose(
      displayCoords,
      next,
      displayAlphaForMode(mode),
    );
  }

  coords = next;
  const rawMoved =
    prevCoords == null ||
    prevCoords.lat !== next.lat ||
    prevCoords.lng !== next.lng;
  lastAcceptedAtMs = fromCache ? lastAcceptedAtMs : now;
  if (!fromCache) acceptedCount += 1;
  // Lock address/territory point to first fix; refresh if user travels >5km.
  if (!lookupCoords || metersBetween(lookupCoords, next) > LOOKUP_REFRESH_M) {
    lookupCoords = next;
  }

  emit(rawMoved);
  return { accepted: true, mode, modeChanged };
}

export function clearFindMeCoords(): void {
  setFindMeCoords(null);
}
