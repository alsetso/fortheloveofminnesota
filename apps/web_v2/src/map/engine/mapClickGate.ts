/**
 * Suppress the synthetic `click` that browsers fire after a drag gesture
 * (e.g. one-finger orbit). Mapbox already suppresses click after its own
 * dragPan/dragRotate; custom pointer handlers must opt in here.
 */

let suppressUntilMs = 0;

/** Ignore map clicks until `ms` from now (default covers pointerup → click). */
export function suppressNextMapClick(ms = 450): void {
  const until = Date.now() + ms;
  if (until > suppressUntilMs) suppressUntilMs = until;
}

export function shouldIgnoreMapClick(): boolean {
  return Date.now() < suppressUntilMs;
}
