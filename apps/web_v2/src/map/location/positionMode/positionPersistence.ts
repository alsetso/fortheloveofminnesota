/**
 * Position persistence — the ONLY two keys this app stores between sessions
 * for map/avatar position:
 *
 *   ftlomn.position.lastKnownAvatarPosition   { lat, lng }
 *   ftlomn.position.mode                      'live' | 'scout'
 *
 * Map frame, zoom, pitch, and viewport are deliberately NOT cached — the
 * frame derives from the resolved avatar position on every load.
 *
 * Migration: reads fall back once to the legacy `ftlomn_find_me_last_coords`
 * key (pre-refactor Find Me cache) and write forward to the new key.
 *
 * Legacy mode tokens (`gps` | `free` | `driving`) normalize on read:
 *   gps | driving → live
 *   free          → scout
 * Driving is never restored as a LiveKind — speed detection enters it.
 */

import type { PresenceMode } from '@/map/location/positionMode/positionModeStore';
import { FREE_MOVE_PERSIST_THROTTLE_MS } from '@/map/location/positionMode/positionConstants';

export type PersistedLatLng = { lat: number; lng: number };

export const LAST_KNOWN_AVATAR_POSITION_KEY =
  'ftlomn.position.lastKnownAvatarPosition';
export const POSITION_MODE_KEY = 'ftlomn.position.mode';
/** Pre-refactor Find Me cache — read-only migration source. */
const LEGACY_FIND_ME_COORDS_KEY = 'ftlomn_find_me_last_coords';

function parseLatLng(raw: string | null): PersistedLatLng | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PersistedLatLng>;
    if (
      typeof data.lat !== 'number' ||
      typeof data.lng !== 'number' ||
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lng)
    ) {
      return null;
    }
    return { lat: data.lat, lng: data.lng };
  } catch {
    return null;
  }
}

export function getLastKnownAvatarPosition(): PersistedLatLng | null {
  if (typeof window === 'undefined') return null;
  try {
    const current = parseLatLng(
      localStorage.getItem(LAST_KNOWN_AVATAR_POSITION_KEY),
    );
    if (current) return current;
    const legacy = parseLatLng(localStorage.getItem(LEGACY_FIND_ME_COORDS_KEY));
    if (legacy) setLastKnownAvatarPosition(legacy);
    return legacy;
  } catch {
    return null;
  }
}

export function setLastKnownAvatarPosition(pos: PersistedLatLng): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      LAST_KNOWN_AVATAR_POSITION_KEY,
      JSON.stringify({ lat: pos.lat, lng: pos.lng }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearLastKnownAvatarPosition(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LAST_KNOWN_AVATAR_POSITION_KEY);
    localStorage.removeItem(LEGACY_FIND_ME_COORDS_KEY);
  } catch {
    /* ignore */
  }
}

// ── Throttled writer ─────────────────────────────────────────────────────────
// Movement (GPS ticks, controller frames) persists at most once per
// FREE_MOVE_PERSIST_THROTTLE_MS; flushAvatarPositionPersist() fires the final
// pending write on input release / page hide. Never writes every frame.

let lastWriteMs = 0;
let pending: PersistedLatLng | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

export function persistAvatarPositionThrottled(pos: PersistedLatLng): void {
  const now = Date.now();
  if (now - lastWriteMs >= FREE_MOVE_PERSIST_THROTTLE_MS) {
    lastWriteMs = now;
    pending = null;
    setLastKnownAvatarPosition(pos);
    return;
  }
  pending = pos;
  if (pendingTimer == null) {
    const waitMs = FREE_MOVE_PERSIST_THROTTLE_MS - (now - lastWriteMs);
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      flushAvatarPositionPersist();
    }, waitMs);
  }
}

export function flushAvatarPositionPersist(): void {
  if (pendingTimer != null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  if (pending) {
    lastWriteMs = Date.now();
    setLastKnownAvatarPosition(pending);
    pending = null;
  }
}

// ── Mode ─────────────────────────────────────────────────────────────────────

function normalizePersistedMode(raw: string | null): PresenceMode | null {
  if (raw === 'live' || raw === 'scout') return raw;
  // Legacy PositionMode tokens (pre Presence rename).
  if (raw === 'gps' || raw === 'driving') return 'live';
  if (raw === 'free') return 'scout';
  return null;
}

export function getPersistedPresenceMode(): PresenceMode | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizePersistedMode(localStorage.getItem(POSITION_MODE_KEY));
  } catch {
    return null;
  }
}

export function setPersistedPresenceMode(mode: PresenceMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POSITION_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** @deprecated Use getPersistedPresenceMode */
export const getPersistedPositionMode = getPersistedPresenceMode;
/** @deprecated Use setPersistedPresenceMode */
export const setPersistedPositionMode = setPersistedPresenceMode;
