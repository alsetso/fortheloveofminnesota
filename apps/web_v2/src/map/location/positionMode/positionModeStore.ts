/**
 * PresenceMode — the single authority for how the player inhabits `/game`.
 *
 * ┌─────────┬──────────────────────────────────────────────────────────────┐
 * │ live    │ Geolocation granted AND fix inside Minnesota. Avatar locked  │
 * │         │ to the real position. LiveKind (`gps` | `driving`) is the    │
 * │         │ drive flavor under Live — driving is scaffolded only.        │
 * ├─────────┼──────────────────────────────────────────────────────────────┤
 * │ scout   │ Avatar driven by WASD / pad (desktop + Free Move). Entered   │
 * │         │ deliberately, or as the fall-through when permission fails,  │
 * │         │ geolocation errors, or coordinates are outside Minnesota.    │
 * └─────────┴──────────────────────────────────────────────────────────────┘
 *
 * Product language matches the enum: Live | Scout. There is no third product
 * mode — driving is not a peer of Live/Scout.
 *
 * The legacy `mapModeStore` is a deprecated shim that mirrors this store
 * (follow ↔ Live, scout ↔ Scout). Do not add new mapMode callers.
 *
 * Module-scope store (same pattern as findMeCoordsStore) so frame-loop
 * consumers read synchronously without a React render round-trip.
 */

import { getPersistedPresenceMode } from '@/map/location/positionMode/positionPersistence';

/** Product presence axis — binary. */
export type PresenceMode = 'live' | 'scout';

/**
 * Drive flavor under Live only. Driving is speed-entered (scaffolded) and
 * never restored from persistence.
 */
export type LiveKind = 'gps' | 'driving';

/** Boot lifecycle — drives the loading veil during the async resolve gap. */
export type PresenceBootStatus = 'resolving' | 'ready';

export type PresenceSnapshot = {
  mode: PresenceMode;
  /** Meaningful when `mode === 'live'`; ignored while Scout. */
  liveKind: LiveKind;
  status: PresenceBootStatus;
  /** Transient user-facing message (e.g. GPS switch failed). */
  notice: string | null;
};

/**
 * Initial mode comes from the persisted value so the store holds a named
 * mode at every instant — `status: 'resolving'` marks it as provisional
 * until resolvePresenceMode() confirms on boot.
 */
let mode: PresenceMode = 'scout';
let liveKind: LiveKind = 'gps';
let status: PresenceBootStatus = 'resolving';
let notice: string | null = null;
let hydrated = false;

let snapshot: PresenceSnapshot = { mode, liveKind, status, notice };
/** Stable SSR snapshot — must never hydrate or allocate, or React 19 throws. */
const SERVER_SNAPSHOT: PresenceSnapshot = {
  mode: 'scout',
  liveKind: 'gps',
  status: 'resolving',
  notice: null,
};
const listeners = new Set<() => void>();
let noticeTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  snapshot = { mode, liveKind, status, notice };
  for (const l of listeners) l();
}

function hydrateOnce(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const persisted = getPersistedPresenceMode();
  if (persisted && persisted !== mode) {
    mode = persisted;
    liveKind = 'gps';
    snapshot = { mode, liveKind, status, notice };
  }
}

export function getPresenceMode(): PresenceMode {
  return mode;
}

export function getLiveKind(): LiveKind {
  return liveKind;
}

/** Pure — never hydrate here. React 19 caches this result per render. */
export function getPresenceSnapshot(): PresenceSnapshot {
  return snapshot;
}

/** Apply persisted mode after mount, then notify subscribers. */
export function hydratePresenceStore(): void {
  hydrateOnce();
  emit();
}

export function getPresenceServerSnapshot(): PresenceSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribePresence(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setPresenceMode(next: PresenceMode, nextLiveKind: LiveKind = 'gps'): void {
  if (next === mode && (next === 'scout' || nextLiveKind === liveKind)) return;
  mode = next;
  liveKind = next === 'live' ? nextLiveKind : 'gps';
  emit();
}

/** Set Live drive flavor — no-op while Scout. */
export function setLiveKind(next: LiveKind): void {
  if (mode !== 'live' || next === liveKind) return;
  liveKind = next;
  emit();
}

export function setPresenceBootStatus(next: PresenceBootStatus): void {
  if (next === status) return;
  status = next;
  emit();
}

/** Show a notice. `ttlMs > 0` auto-clears; `0` stays until the next set. */
export function setPresenceNotice(next: string | null, ttlMs = 5_000): void {
  if (noticeTimer) {
    clearTimeout(noticeTimer);
    noticeTimer = null;
  }
  notice = next;
  emit();
  if (next != null && ttlMs > 0) {
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      notice = null;
      emit();
    }, ttlMs);
  }
}

// ── Deprecated aliases (Position* → Presence*) ───────────────────────────────

/** @deprecated Use PresenceMode */
export type PositionMode = PresenceMode;
/** @deprecated Use PresenceBootStatus */
export type PositionBootStatus = PresenceBootStatus;
/** @deprecated Use PresenceSnapshot */
export type PositionModeSnapshot = PresenceSnapshot;

/** @deprecated Use getPresenceMode */
export const getPositionMode = getPresenceMode;
/** @deprecated Use getPresenceSnapshot */
export const getPositionModeSnapshot = getPresenceSnapshot;
/** @deprecated Use getPresenceServerSnapshot */
export const getPositionModeServerSnapshot = getPresenceServerSnapshot;
/** @deprecated Use subscribePresence */
export const subscribePositionMode = subscribePresence;
/** @deprecated Use hydratePresenceStore */
export const hydratePositionModeStore = hydratePresenceStore;
/** @deprecated Use setPresenceMode */
export function setPositionMode(next: PresenceMode): void {
  setPresenceMode(next);
}
/** @deprecated Use setPresenceBootStatus */
export const setPositionBootStatus = setPresenceBootStatus;
/** @deprecated Use setPresenceNotice */
export const setPositionNotice = setPresenceNotice;
