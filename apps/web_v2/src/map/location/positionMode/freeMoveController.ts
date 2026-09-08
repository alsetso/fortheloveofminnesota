/**
 * Free Mode movement — continuous, input-held locomotion for the avatar.
 *
 * Input: keyboard WASD / arrows via attachFreeMoveKeyboard (desktop).
 * Pad vector APIs remain for optional callers; no on-screen stick in chrome.
 *
 * Each animation frame while input is held (one owned rAF):
 *   1. Input is camera-relative using the chase bearing we own.
 *   2. Integrate meters → lat/lng, clamp to Minnesota.
 *   3. Silent pose write → chase jumpTo → feet + model paint → one repaint.
 *   4. Persist lastKnownAvatarPosition on a 500 ms throttle; flush on release.
 *
 * Release is a withdrawal of ownership — not a handoff. The last held frame
 * IS the terminal frame: no jumpTo, no setData, no emit fan-out on stop.
 * `chaseOwned` stays true through the stop-grace window so idle subscribers
 * cannot reframe from torn-down state.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import type { UserCoords } from '@/map/location/device/geolocation';
import { clampToMinnesota } from '@/map/location/device/minnesotaBounds';
import { thirdPersonCameraCenter } from '@/map/location/camera/flyToFindMe';
import {
  driveAvatarPose,
  endAvatarDrive,
  getAvatarPresentationCoords,
  getLastWalkBearing,
} from '@/map/location/player/avatarWalkController';
import { paintPlayerAvatarNow } from '@/map/location/player/playerAvatarRuntime';
import { syncUserMapPositionCoords } from '@/map/location/position/paintUserMapPosition';
import { noteCampaignChaseBearing } from '@/map/location/positionMode/campaignChaseCamera';
import {
  CAMPAIGN_BEARING_LERP,
  CAMPAIGN_LOOK_AHEAD_M,
  CAMPAIGN_PITCH,
  CAMPAIGN_ZOOM,
  CAPITOL_SPAWN,
  FREE_MOVE_INPUT_DEADZONE,
  FREE_MOVE_INPUT_RELEASE_DEADZONE,
  FREE_MOVE_STOP_GRACE_MS,
  freeMoveSpeedMpsForZoom,
} from '@/map/location/positionMode/positionConstants';
import { getPositionMode } from '@/map/location/positionMode/positionModeStore';
import {
  flushAvatarPositionPersist,
  getLastKnownAvatarPosition,
  persistAvatarPositionThrottled,
} from '@/map/location/positionMode/positionPersistence';

export type FreeMoveVector = { x: number; y: number };

/** Meters per degree of latitude (WGS-84 mean). */
const METERS_PER_DEG_LAT = 111_320;
/** Cap dt so a background-tab resume doesn't teleport the avatar. */
const MAX_FRAME_DT_MS = 100;

export type FreeMoveTune = {
  /** Ground speed override (m/s). When set, zoom scaling is skipped. */
  speedMps?: number;
  /**
   * 0–1 blend toward stick heading, expressed as α at 60fps.
   * Scaled by dt each frame so 60Hz and 120Hz feel the same. Omit = instant.
   */
  turnLerp?: number;
};

type PresentedFrame = {
  lat: number;
  lng: number;
  camBearing: number;
  yawDeg: number;
};

let map: MapboxMap | null = null;
let padVector: FreeMoveVector = { x: 0, y: 0 };
const keysDown = new Set<string>();
let raf = 0;
let lastFrameMs = 0;
let moving = false;
/**
 * True while Free Mode owns camera+paint — includes the post-release grace
 * so idle subscribers cannot reframe from torn-down drive state.
 */
let chaseOwned = false;
let chaseOwnedTimer: ReturnType<typeof setTimeout> | null = null;
let tune: FreeMoveTune = {};
let facingDeg: number | null = null;
/** Camera bearing we drive — stick is relative to this, not a lagged map read. */
let chaseBearingDeg: number | null = null;
/** Exact last presented frame — terminal state on release. */
let lastPresentedFrame: PresentedFrame | null = null;
/** Hysteresis — once engaged, stay until below the release deadzone. */
let inputEngaged = false;
/** Timestamp when effective input first went silent; null while active. */
let inputSilentSinceMs: number | null = null;

function lerpAngleDeg(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/** α@60fps → dt-scaled blend so turn rate is frame-rate independent. */
function frameLerp(alphaAt60: number, dtS: number): number {
  if (alphaAt60 >= 1) return 1;
  if (alphaAt60 <= 0 || dtS <= 0) return 0;
  return 1 - Math.pow(1 - alphaAt60, dtS * 60);
}

function keyboardVector(): FreeMoveVector {
  const x =
    (keysDown.has('KeyD') || keysDown.has('ArrowRight') ? 1 : 0) -
    (keysDown.has('KeyA') || keysDown.has('ArrowLeft') ? 1 : 0);
  const y =
    (keysDown.has('KeyW') || keysDown.has('ArrowUp') ? 1 : 0) -
    (keysDown.has('KeyS') || keysDown.has('ArrowDown') ? 1 : 0);
  return { x, y };
}

/**
 * Pad wins while above the active deadzone; otherwise keys.
 * Enter at FREE_MOVE_INPUT_DEADZONE, exit at RELEASE — no edge chatter.
 * Normalized to len ≤ 1 (diagonals).
 */
function effectiveVector(): FreeMoveVector {
  const threshold = inputEngaged
    ? FREE_MOVE_INPUT_RELEASE_DEADZONE
    : FREE_MOVE_INPUT_DEADZONE;
  const padLen = Math.hypot(padVector.x, padVector.y);
  const raw = padLen > threshold ? padVector : keyboardVector();
  const len = Math.hypot(raw.x, raw.y);
  if (len <= threshold) {
    inputEngaged = false;
    return { x: 0, y: 0 };
  }
  inputEngaged = true;
  if (len <= 1) return raw;
  return { x: raw.x / len, y: raw.y / len };
}

function currentPose(): UserCoords {
  const live = getAvatarPresentationCoords();
  if (live) return live;
  const persisted = getLastKnownAvatarPosition();
  const seed = persisted ?? CAPITOL_SPAWN;
  return { lat: seed.lat, lng: seed.lng, accuracy: null, speed: null, course: null };
}

function clearChaseOwnedTimer(): void {
  if (chaseOwnedTimer) {
    clearTimeout(chaseOwnedTimer);
    chaseOwnedTimer = null;
  }
}

function claimChaseOwnership(): void {
  clearChaseOwnedTimer();
  chaseOwned = true;
}

/** Keep ownership through grace after stop so idle hooks cannot reframe. */
function releaseChaseOwnershipAfterGrace(): void {
  clearChaseOwnedTimer();
  chaseOwnedTimer = setTimeout(() => {
    chaseOwnedTimer = null;
    chaseOwned = false;
  }, FREE_MOVE_STOP_GRACE_MS);
}

/**
 * Hard chase — jumpTo every drive tick with full camera state.
 * No style/mode guards: this loop only runs while Free Mode owns the map.
 */
function chaseJumpTo(
  m: MapboxMap,
  coords: UserCoords,
  headingDeg: number,
  dtS: number,
): void {
  if (chaseBearingDeg == null) {
    chaseBearingDeg = headingDeg;
  } else {
    chaseBearingDeg = lerpAngleDeg(
      chaseBearingDeg,
      headingDeg,
      frameLerp(CAMPAIGN_BEARING_LERP, dtS),
    );
  }
  noteCampaignChaseBearing(chaseBearingDeg);

  const lookAt = thirdPersonCameraCenter(
    coords.lng,
    coords.lat,
    chaseBearingDeg,
    CAMPAIGN_LOOK_AHEAD_M,
  );

  try {
    m.stop();
  } catch {
    /* no in-flight ease */
  }

  m.jumpTo({
    center: [lookAt.lng, lookAt.lat],
    bearing: chaseBearingDeg,
    pitch: CAMPAIGN_PITCH,
    zoom: CAMPAIGN_ZOOM,
  });
}

/** Camera first, then mesh — one repaint at the end. Latches terminal frame. */
function presentFrame(
  m: MapboxMap,
  coords: UserCoords,
  headingDeg: number,
  dtS: number,
): void {
  chaseJumpTo(m, coords, headingDeg, dtS);
  try {
    syncUserMapPositionCoords(m, coords);
  } catch {
    /* style race */
  }
  paintPlayerAvatarNow({ skipRepaint: true });
  m.triggerRepaint?.();

  lastPresentedFrame = {
    lat: coords.lat,
    lng: coords.lng,
    camBearing: chaseBearingDeg ?? headingDeg,
    yawDeg: headingDeg,
  };
}

/**
 * Withdraw ownership. Last held frame is already terminal — no jumpTo,
 * no setData, no subscriber wake from torn-down yaw.
 */
function stopLoop(): void {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  inputSilentSinceMs = null;
  inputEngaged = false;

  if (!moving) {
    releaseChaseOwnershipAfterGrace();
    return;
  }

  const final = lastPresentedFrame;
  if (final) {
    noteCampaignChaseBearing(final.camBearing);
  } else if (chaseBearingDeg != null) {
    noteCampaignChaseBearing(chaseBearingDeg);
  }

  claimChaseOwnership();
  moving = false;

  endAvatarDrive({
    silent: true,
    freezeYawDeg: final?.yawDeg ?? facingDeg ?? chaseBearingDeg,
  });
  flushAvatarPositionPersist();
  releaseChaseOwnershipAfterGrace();
}

function frame(now: number): void {
  raf = 0;
  const m = map;
  if (!m || getPositionMode() !== 'scout') {
    stopLoop();
    return;
  }

  const v = effectiveVector();
  if (v.x === 0 && v.y === 0) {
    if (inputSilentSinceMs == null) inputSilentSinceMs = now;
    if (now - inputSilentSinceMs >= FREE_MOVE_STOP_GRACE_MS) {
      stopLoop();
      return;
    }
    // Hold pose through the grace window — loop stays warm for a quick resume.
    lastFrameMs = now;
    raf = requestAnimationFrame(frame);
    return;
  }
  inputSilentSinceMs = null;

  const dtS = Math.min(MAX_FRAME_DT_MS, Math.max(0, now - lastFrameMs)) / 1000;
  lastFrameMs = now;

  const pose = currentPose();

  // Camera-relative stick: up = into the chase frame we own.
  if (chaseBearingDeg == null) {
    chaseBearingDeg = m.getBearing();
  }
  const screenHeadingRad = Math.atan2(v.x, v.y);
  const stickHeadingDeg =
    ((screenHeadingRad + (chaseBearingDeg * Math.PI) / 180) * 180) / Math.PI;
  const targetHeadingDeg = (stickHeadingDeg + 360) % 360;

  if (facingDeg == null) {
    facingDeg = getLastWalkBearing() ?? targetHeadingDeg;
  }
  facingDeg =
    tune.turnLerp != null
      ? lerpAngleDeg(facingDeg, targetHeadingDeg, frameLerp(tune.turnLerp, dtS))
      : targetHeadingDeg;
  const facingRad = (facingDeg * Math.PI) / 180;

  const speedMps = tune.speedMps ?? freeMoveSpeedMpsForZoom(m.getZoom());
  const stepM = Math.min(1, Math.hypot(v.x, v.y)) * speedMps * dtS;

  const dNorthM = stepM * Math.cos(facingRad);
  const dEastM = stepM * Math.sin(facingRad);
  const latRad = (pose.lat * Math.PI) / 180;
  const next = clampToMinnesota(
    pose.lat + dNorthM / METERS_PER_DEG_LAT,
    pose.lng + dEastM / (METERS_PER_DEG_LAT * Math.cos(latRad)),
  );

  const nextCoords: UserCoords = {
    lat: next.lat,
    lng: next.lng,
    accuracy: null,
    speed: speedMps,
    course: facingDeg,
  };

  claimChaseOwnership();
  moving = true;
  driveAvatarPose(nextCoords, facingDeg, { silent: true });
  persistAvatarPositionThrottled(next);
  presentFrame(m, nextCoords, facingDeg, dtS);

  raf = requestAnimationFrame(frame);
}

function kickLoop(): void {
  if (raf || !map || getPositionMode() !== 'scout') return;
  const v = effectiveVector();
  if (v.x === 0 && v.y === 0) return;
  lastFrameMs = performance.now();
  inputSilentSinceMs = null;
  if (chaseBearingDeg == null) {
    chaseBearingDeg = map.getBearing();
  }
  claimChaseOwnership();
  raf = requestAnimationFrame(frame);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function attachFreeMove(m: MapboxMap, next: FreeMoveTune = {}): void {
  map = m;
  tune = next;
  facingDeg = getLastWalkBearing();
  chaseBearingDeg = m.getBearing();
  noteCampaignChaseBearing(chaseBearingDeg);
}

export function detachFreeMove(): void {
  stopLoop();
  clearChaseOwnedTimer();
  chaseOwned = false;
  padVector = { x: 0, y: 0 };
  keysDown.clear();
  tune = {};
  facingDeg = null;
  chaseBearingDeg = null;
  lastPresentedFrame = null;
  map = null;
}

/** True while held input is actively integrating this frame. */
export function isFreeMoving(): boolean {
  return moving;
}

/**
 * True while Free Mode owns camera+paint, including the post-release grace.
 * Idle chase / queuePaint must gate on this — not only {@link isFreeMoving}.
 */
export function isChaseOwned(): boolean {
  return chaseOwned || moving;
}

export function setFreeMovePadVector(v: FreeMoveVector): void {
  padVector = v;
  kickLoop();
}

export function clearFreeMovePad(): void {
  padVector = { x: 0, y: 0 };
}

const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
    target.isContentEditable
  );
}

/** Desktop keyboard movement — WASD + arrows. Returns a detach fn. */
export function attachFreeMoveKeyboard(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (!MOVE_CODES.has(e.code)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    if (getPositionMode() !== 'scout') return;
    // Arrows would otherwise scroll / pan the Mapbox canvas.
    e.preventDefault();
    keysDown.add(e.code);
    kickLoop();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keysDown.delete(e.code);
  };
  const onBlur = () => {
    keysDown.clear();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    keysDown.clear();
  };
}
