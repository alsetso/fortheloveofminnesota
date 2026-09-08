/**
 * Map interaction mode — SSOT for how clicks / misses behave.
 *
 * `browse` preserves today’s default (pins → territories → drop point).
 * Other modes tighten the surface while a feature owns the map.
 *
 * Do not reuse Presence tokens (`live` / `scout`) here — this is tap policy,
 * not avatar drive.
 */

export type MapInteractionMode =
  /** Default browse: pins, territories, empty-ground drop. */
  | 'browse'
  /** Boundaries painted / Controls: hit territories + pins; miss does not drop. */
  | 'explore'
  /** Mentions focus: pins only; miss does not drop. */
  | 'mentions'
  /** Find Me sharing: pins + territories ok; empty ground may drop a selected point. */
  | 'locate'
  /** Route focus: pins + territories ok; miss does not drop. */
  | 'route'
  /** Selected-point / compose: prefer drop; territory hits soft (details still ok). */
  | 'compose';

type Listener = () => void;

let mode: MapInteractionMode = 'browse';
let snapshot: { mode: MapInteractionMode } = { mode };
const listeners = new Set<Listener>();

function emit() {
  snapshot = { mode };
  for (const fn of listeners) fn();
}

export function getMapInteractionMode(): MapInteractionMode {
  return mode;
}

export function getMapInteractionModeSnapshot(): { mode: MapInteractionMode } {
  return snapshot;
}

export function subscribeMapInteractionMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMapInteractionMode(next: MapInteractionMode): void {
  if (next === mode) return;
  mode = next;
  emit();
}

/** Human label for chrome / debug. */
export function mapInteractionModeLabel(m: MapInteractionMode = mode): string {
  switch (m) {
    case 'browse':
      return 'Browse map';
    case 'explore':
      return 'Explore boundaries';
    case 'mentions':
      return 'Community pins';
    case 'locate':
      return 'Find me';
    case 'route':
      return 'Route';
    case 'compose':
      return 'Place pin';
  }
}
