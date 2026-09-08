/**
 * cameraIntentStore — lightweight serializer for camera commands.
 *
 * Prevents simultaneous flyTo calls (GPS follow tick + pin drop jank) by
 * declaring which "intent" currently owns the camera. Each intent can be
 * granted or cancelled; any lower-priority intent that tries to move the
 * camera while a higher-priority intent holds is silently suppressed.
 *
 * Priority (highest → lowest):
 *   'pinned'  — user explicitly tapped a map pin or feature
 *   'follow'  — GPS follow-me tick (useMapCameraController / useFollowCamera)
 *   'none'    — no active intent (map is freely navigable)
 *
 * Usage:
 *   // Grab intent before issuing a camera command:
 *   if (!acquireCameraIntent('follow')) return;
 *   followToFindMe(map, coords, opts);
 *
 *   // Release when done:
 *   releaseCameraIntent('follow');
 *
 *   // For fire-and-forget (pin drop): acquireExclusive auto-releases after durationMs.
 *   acquireExclusiveCameraIntent('pinned', 2500);
 */

export type CameraIntent = 'none' | 'follow' | 'pinned';

const PRIORITY: Record<CameraIntent, number> = {
  none: 0,
  follow: 1,
  pinned: 2,
};

let currentIntent: CameraIntent = 'none';
let exclusiveTimerId: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

/** Read the current camera intent. */
export function getCameraIntent(): CameraIntent {
  return currentIntent;
}

/** Subscribe to intent changes (useSyncExternalStore-compatible). */
export function subscribeCameraIntent(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Try to acquire a camera intent. Returns true if granted.
 * Fails silently if a higher-priority intent is already active.
 */
export function acquireCameraIntent(intent: CameraIntent): boolean {
  if (PRIORITY[intent] < PRIORITY[currentIntent]) return false;
  if (currentIntent !== intent) {
    currentIntent = intent;
    notify();
  }
  return true;
}

/**
 * Acquire exclusive camera intent for a fixed duration (ms).
 * After the duration, intent automatically resets to 'none'.
 * Any existing exclusive timer is cancelled first.
 */
export function acquireExclusiveCameraIntent(
  intent: CameraIntent,
  durationMs: number,
): void {
  if (exclusiveTimerId !== null) {
    clearTimeout(exclusiveTimerId);
    exclusiveTimerId = null;
  }
  currentIntent = intent;
  notify();
  exclusiveTimerId = setTimeout(() => {
    exclusiveTimerId = null;
    currentIntent = 'none';
    notify();
  }, durationMs);
}

/** Release an intent — only clears if the caller is the current owner. */
export function releaseCameraIntent(intent: CameraIntent): void {
  if (currentIntent !== intent) return;
  if (exclusiveTimerId !== null) {
    clearTimeout(exclusiveTimerId);
    exclusiveTimerId = null;
  }
  currentIntent = 'none';
  notify();
}

/** Force-reset intent to none (e.g. on map mode change, style reload). */
export function resetCameraIntent(): void {
  if (exclusiveTimerId !== null) {
    clearTimeout(exclusiveTimerId);
    exclusiveTimerId = null;
  }
  currentIntent = 'none';
  notify();
}

/** Returns true if the given intent would be granted right now. */
export function canAcquireCameraIntent(intent: CameraIntent): boolean {
  return PRIORITY[intent] >= PRIORITY[currentIntent];
}
