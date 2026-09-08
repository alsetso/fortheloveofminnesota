import { MAP_CONFIG } from '@/map/config';
import { despiaCall, getDespia, isDespia } from '@/lib/despia/despia';
import {
  despiaParamsForMode,
  type DespiaWatchParams,
  type LocomotionMode,
} from '@/map/location/device/locomotion';

/**
 * Live / one-shot user fix.
 * `lat`/`lng` are always present; speed / accuracy / course when the source provides them.
 */
export type UserCoords = {
  lat: number;
  lng: number;
  /** Horizontal accuracy radius in metres (lower is better). */
  accuracy?: number | null;
  /** Ground speed in m/s. */
  speed?: number | null;
  /** Direction of travel, degrees clockwise from north (Mapbox bearing). */
  course?: number | null;
};

export type GeolocationErrorType =
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unknown';

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export class UserGeolocationError extends Error {
  readonly type: GeolocationErrorType;

  constructor(type: GeolocationErrorType, message: string) {
    super(message);
    this.name = 'UserGeolocationError';
    this.type = type;
  }
}

export function isGeolocationSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isDespia()) return true;
  return 'geolocation' in navigator;
}

/**
 * Best-effort permission probe. Safari / some WebViews omit geolocation from
 * Permissions API — treat that as `unknown` and just call getCurrentPosition.
 */
export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function deniedMessage(): string {
  return isDespia()
    ? 'Location access denied. Open Settings to enable Location, then try again.'
    : 'Location permission denied. Enable location access in your browser or system settings, then try again.';
}

function mapBrowserError(error: GeolocationPositionError): UserGeolocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new UserGeolocationError('permission_denied', deniedMessage());
    case error.POSITION_UNAVAILABLE:
      return new UserGeolocationError(
        'position_unavailable',
        'Location unavailable. Check GPS or network and try again.',
      );
    case error.TIMEOUT:
      return new UserGeolocationError('timeout', 'Location request timed out. Try again.');
    default:
      return new UserGeolocationError('unknown', 'Could not find your location.');
  }
}

function optionalNonNeg(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

function optionalFinite(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function toCoords(position: GeolocationPosition): UserCoords {
  const { coords } = position;
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: optionalFinite(coords.accuracy),
    speed: optionalNonNeg(coords.speed),
    course: optionalNonNeg(coords.heading),
  };
}

type DespiaLocationFix = {
  latitude?: number;
  longitude?: number;
  horizontalAccuracy?: number | null;
  speed?: number | null;
  course?: number | null;
  timestamp?: number;
  gpsTimestamp?: number;
  active?: boolean;
  battery?: number;
};

declare global {
  interface Window {
    onLocationChange?: ((data: DespiaLocationFix) => void) | null;
  }
}

function despiaFixToCoords(fix: DespiaLocationFix): UserCoords | null {
  if (
    typeof fix.latitude !== 'number' ||
    typeof fix.longitude !== 'number' ||
    !Number.isFinite(fix.latitude) ||
    !Number.isFinite(fix.longitude)
  ) {
    return null;
  }
  return {
    lat: fix.latitude,
    lng: fix.longitude,
    accuracy: optionalFinite(fix.horizontalAccuracy),
    speed: optionalNonNeg(fix.speed),
    course: optionalNonNeg(fix.course),
  };
}

/**
 * Despia one-shot GPS — While-Using only (`location://simple`).
 * https://setup.despia.com/native-features/gps-location.md
 */
async function getDespiaPosition(): Promise<UserCoords> {
  const raw = await despiaCall('location://simple', ['locationSession']);
  if (raw == null) {
    throw new UserGeolocationError(
      'unsupported',
      'Native location is not available on this device.',
    );
  }

  const session = (raw as { locationSession?: DespiaLocationFix[] }).locationSession;
  const fix = Array.isArray(session) ? session[0] : undefined;
  const coords = fix ? despiaFixToCoords(fix) : null;
  if (!coords) {
    throw new UserGeolocationError('permission_denied', deniedMessage());
  }
  return coords;
}

async function getBrowserPosition(options: PositionOptions): Promise<UserCoords> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.reject(
      new UserGeolocationError('unsupported', 'Geolocation is not supported in this browser.'),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toCoords(position)),
      (error) => reject(mapBrowserError(error)),
      options,
    );
  });
}

async function getBrowserPositionWithSoftRetry(
  options: PositionOptions,
): Promise<UserCoords> {
  try {
    return await getBrowserPosition(options);
  } catch (err) {
    if (
      !(err instanceof UserGeolocationError) ||
      (err.type !== 'timeout' && err.type !== 'position_unavailable')
    ) {
      throw err;
    }
    // One soft retry with a longer window — still from the original user gesture chain.
    return getBrowserPosition(MAP_CONFIG.GEOLOCATION_RETRY_OPTIONS);
  }
}

/**
 * One-shot location. Must run from a user gesture.
 * Despia prefers native GPS; browsers use geolocation (+ one soft retry on timeout).
 */
export async function getUserPosition(
  options: PositionOptions = MAP_CONFIG.GEOLOCATION_OPTIONS,
): Promise<UserCoords> {
  if (!isGeolocationSupported()) {
    throw new UserGeolocationError(
      'unsupported',
      'Geolocation is not supported in this browser.',
    );
  }

  if (isDespia()) {
    try {
      return await getDespiaPosition();
    } catch (err) {
      // If the native bridge is missing in a Despia UA, fall through to browser GPS.
      if (err instanceof UserGeolocationError && err.type === 'unsupported') {
        return getBrowserPositionWithSoftRetry(options);
      }
      throw err;
    }
  }

  return getBrowserPositionWithSoftRetry(options);
}

export type WatchUserPositionResult = {
  stop: () => void;
};

type DespiaWatchListener = {
  onPosition: (coords: UserCoords) => void;
  onError?: (error: UserGeolocationError) => void;
};

/** Shared native session — multiple watchers fan out from one `onLocationChange`. */
const despiaWatchListeners = new Set<DespiaWatchListener>();
let despiaSessionDesired = false;
let despiaSessionStartPromise: Promise<void> | null = null;
let lastDespiaStreamAt = 0;
let despiaFallbackTimer: ReturnType<typeof setInterval> | null = null;
let despiaFallbackInFlight = false;
let activeDespiaParams: DespiaWatchParams = {
  bufferSeconds: MAP_CONFIG.DESPIA_LOCATION_WATCH.bufferSeconds,
  movementCm: MAP_CONFIG.DESPIA_LOCATION_WATCH.movementCm,
};
let despiaAdaptTimer: ReturnType<typeof setTimeout> | null = null;

/** If continuous stream is silent this long, fall back to one-shot poll. */
const DESPIA_STREAM_STALE_MS = 12_000;
const DESPIA_FALLBACK_POLL_MS = 8_000;
const DESPIA_ADAPT_DEBOUNCE_MS = 1_500;

// On foreground restore, the native onLocationChange hook can be silently dropped.
// Re-arm the session immediately so position resumes without waiting for the stale poll.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!despiaSessionDesired || despiaWatchListeners.size === 0) return;
    lastDespiaStreamAt = 0; // treat as stale so fallback fires immediately
    installDespiaLocationHook();
    void startDespiaContinuousSession().catch(() => {});
  });
}

function fanOutDespiaPosition(coords: UserCoords) {
  for (const listener of despiaWatchListeners) {
    listener.onPosition(coords);
  }
}

function fanOutDespiaError(error: UserGeolocationError) {
  for (const listener of despiaWatchListeners) {
    listener.onError?.(error);
  }
}

function installDespiaLocationHook() {
  if (typeof window === 'undefined') return;
  window.onLocationChange = (data: DespiaLocationFix) => {
    if (despiaWatchListeners.size === 0) return;
    // Final event when tracking stops — ignore (we already tore down).
    if (data.active === false) return;
    const coords = despiaFixToCoords(data);
    if (!coords) return;
    lastDespiaStreamAt = Date.now();
    fanOutDespiaPosition(coords);
  };
}

function clearDespiaLocationHook() {
  if (typeof window === 'undefined') return;
  if (window.onLocationChange) {
    window.onLocationChange = null;
  }
}

function stopDespiaFallbackPoll() {
  if (despiaFallbackTimer == null) return;
  clearInterval(despiaFallbackTimer);
  despiaFallbackTimer = null;
  despiaFallbackInFlight = false;
}

function ensureDespiaFallbackPoll() {
  if (despiaFallbackTimer != null) return;
  despiaFallbackTimer = setInterval(() => {
    if (!despiaSessionDesired || despiaWatchListeners.size === 0) return;
    if (Date.now() - lastDespiaStreamAt < DESPIA_STREAM_STALE_MS) return;
    if (despiaFallbackInFlight) return;
    despiaFallbackInFlight = true;
    void getDespiaPosition()
      .then((coords) => {
        if (!despiaSessionDesired || despiaWatchListeners.size === 0) return;
        fanOutDespiaPosition(coords);
      })
      .catch((err) => {
        if (!despiaSessionDesired) return;
        if (err instanceof UserGeolocationError) fanOutDespiaError(err);
      })
      .finally(() => {
        despiaFallbackInFlight = false;
      });
  }, DESPIA_FALLBACK_POLL_MS);
}

async function startDespiaContinuousSession(): Promise<void> {
  installDespiaLocationHook();
  ensureDespiaFallbackPoll();

  const despia = await getDespia();
  if (!despia) {
    throw new UserGeolocationError(
      'unsupported',
      'Native location is not available on this device.',
    );
  }

  // Already tracking (e.g. prior watch still warm) — just keep the hook.
  const runtime = despia as typeof despia & { locationTracking?: boolean };
  if (runtime.locationTracking === true) {
    return;
  }

  const { bufferSeconds, movementCm } = activeDespiaParams;
  await despiaCall(`location://?buffer=${bufferSeconds}&movement=${movementCm}`);
}

/**
 * Retune continuous GPS for locomotion mode (debounced).
 * Stop + restart native session with mode buffer/movement when params change.
 */
export function adaptDespiaLocationWatch(mode: LocomotionMode): void {
  if (!isDespia() || !despiaSessionDesired) return;
  const next = despiaParamsForMode(mode);
  if (
    next.bufferSeconds === activeDespiaParams.bufferSeconds &&
    next.movementCm === activeDespiaParams.movementCm
  ) {
    return;
  }

  if (despiaAdaptTimer != null) clearTimeout(despiaAdaptTimer);
  despiaAdaptTimer = setTimeout(() => {
    despiaAdaptTimer = null;
    if (!despiaSessionDesired) return;
    activeDespiaParams = { ...next };
    void (async () => {
      const despia = await getDespia();
      const runtime = despia as (typeof despia & { locationTracking?: boolean }) | null;
      if (runtime?.locationTracking === true) {
        try {
          await despiaCall('stoplocation://', ['locationSession']);
        } catch {
          /* best-effort */
        }
      }
      if (!despiaSessionDesired) return;
      try {
        await startDespiaContinuousSession();
      } catch {
        /* fallback poll covers gaps */
      }
    })();
  }, DESPIA_ADAPT_DEBOUNCE_MS);
}

async function ensureDespiaWatchSession(): Promise<void> {
  if (!despiaSessionDesired) return;
  if (despiaSessionStartPromise) {
    await despiaSessionStartPromise;
    return;
  }
  despiaSessionStartPromise = startDespiaContinuousSession()
    .catch((err) => {
      if (err instanceof UserGeolocationError) {
        fanOutDespiaError(err);
      } else {
        fanOutDespiaError(
          new UserGeolocationError('unknown', 'Could not start native location tracking.'),
        );
      }
      // Fallback poll still runs via ensureDespiaFallbackPoll.
    })
    .finally(() => {
      despiaSessionStartPromise = null;
    });
  await despiaSessionStartPromise;
}

async function releaseDespiaWatchSession(): Promise<void> {
  if (despiaWatchListeners.size > 0) return;
  despiaSessionDesired = false;
  if (despiaAdaptTimer != null) {
    clearTimeout(despiaAdaptTimer);
    despiaAdaptTimer = null;
  }
  stopDespiaFallbackPoll();
  clearDespiaLocationHook();
  lastDespiaStreamAt = 0;
  activeDespiaParams = {
    bufferSeconds: MAP_CONFIG.DESPIA_LOCATION_WATCH.bufferSeconds,
    movementCm: MAP_CONFIG.DESPIA_LOCATION_WATCH.movementCm,
  };

  const despia = await getDespia();
  const runtime = despia as (typeof despia & { locationTracking?: boolean }) | null;
  if (runtime?.locationTracking === true) {
    try {
      await despiaCall('stoplocation://', ['locationSession']);
    } catch {
      /* best-effort stop */
    }
  }
}

/**
 * Continuous updates while location sharing is active.
 * Browser: watchPosition.
 * Despia: shared continuous `location://` + `onLocationChange` (speed/accuracy/course),
 * with one-shot poll fallback if the stream goes quiet.
 */
export function watchUserPosition(
  onPosition: (coords: UserCoords) => void,
  onError?: (error: UserGeolocationError) => void,
  options: PositionOptions = MAP_CONFIG.GEOLOCATION_WATCH_OPTIONS,
): WatchUserPositionResult {
  if (isDespia()) {
    const listener: DespiaWatchListener = { onPosition, onError };
    despiaWatchListeners.add(listener);
    despiaSessionDesired = true;
    void ensureDespiaWatchSession();

    return {
      stop: () => {
        despiaWatchListeners.delete(listener);
        void releaseDespiaWatchSession();
      },
    };
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    onError?.(
      new UserGeolocationError('unsupported', 'Geolocation is not supported in this browser.'),
    );
    return { stop: () => undefined };
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => onPosition(toCoords(position)),
    (error) => onError?.(mapBrowserError(error)),
    options,
  );

  return {
    stop: () => {
      navigator.geolocation.clearWatch(watchId);
    },
  };
}
