/**
 * resolvePresenceMode — the single decision point for presence + starting
 * coordinates. EVERY entry path (cold boot, Live toggle, Scout toggle) goes
 * through this function; no other module may branch on geolocation results
 * to pick a mode.
 *
 * Decision table:
 *
 *   request 'scout'                 → scout @ current pose / persisted / Capitol
 *   request 'scout' + spawn capitol → scout @ Capitol lawn (Campaign respawn)
 *   request 'auto', persisted scout → scout (no geolocation call — instant boot)
 *   request 'auto' | 'live'         → attempt Live:
 *     1. Reuse an in-session GPS fix already in findMeCoordsStore (MN)
 *        — critical for Scout → Live; do not require a fresh getUserPosition
 *     2. Else fetch a new geolocation fix:
 *          inside MN → live @ fix
 *          permission / timeout / error / outside MN → scout
 *
 * /game cold open uses `request: 'scout'` so the map starts free-roam.
 * Find Me (user tap) uses `request: 'live'` for Play (GPS follow).
 * Campaign still boots Scout @ Capitol.
 *
 * `allowPrompt: false` means: never pop the OS sheet (silent grant may
 * succeed). `allowPrompt: true` may prompt (boot or user gesture).
 */

import {
  getUserPosition,
  isGeolocationSupported,
  queryGeolocationPermission,
  type UserCoords,
} from '@/map/location/device/geolocation';
import { isDespia } from '@/lib/despia/despia';
import { isInMinnesota } from '@/map/location/device/minnesotaBounds';
import { getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import { CAPITOL_SPAWN } from '@/map/location/positionMode/positionConstants';
import type {
  LiveKind,
  PresenceMode,
} from '@/map/location/positionMode/positionModeStore';
import {
  getLastKnownAvatarPosition,
  getPersistedPresenceMode,
  type PersistedLatLng,
} from '@/map/location/positionMode/positionPersistence';

export type ResolvePresenceOptions = {
  /**
   * 'auto'  — cold boot: honor the persisted mode preference.
   * 'live'  — user toggled to Live: re-run permission + boundary checks.
   * 'scout' — user toggled to Scout: no geolocation, keep current pose.
   */
  request?: 'auto' | 'live' | 'scout';
  /** Allow the OS permission prompt. Only true on a user gesture. */
  allowPrompt?: boolean;
  /** Live avatar pose — preferred starting coords when resolving to scout. */
  currentPose?: PersistedLatLng | null;
  /**
   * Campaign respawn — ignore pose / persist, always the Capitol lawn.
   * Story and /game keep last-known.
   */
  spawn?: 'capitol';
  /** Budget for the geolocation attempt before falling back to scout. */
  timeoutMs?: number;
};

export type ScoutReason =
  | 'preferred'
  | 'permission'
  | 'geolocation-failed'
  | 'outside-minnesota';

export type ResolvedPresence = {
  mode: PresenceMode;
  /** Drive flavor under Live; ignored while Scout. */
  liveKind: LiveKind;
  /** Starting avatar coordinates — always present, always intentional. */
  coords: PersistedLatLng;
  /** The live fix when mode is 'live'. */
  fix?: UserCoords;
  /** Why scout was chosen — UI copy only; handling is identical for all. */
  scoutReason?: ScoutReason;
};

/** Default geolocation budget — keeps the boot veil short. */
const RESOLVE_GPS_BUDGET_MS = 8_000;

/**
 * Driving under Live — SCAFFOLDED, NOT IMPLEMENTED.
 *
 * The next pass will inspect `fix.speed` against a driving threshold (see
 * MAP_CONFIG.VEHICLE_SPEED_MPS ≈ 50 mph and the LOCOMOTION hysteresis
 * machine) and return `{ mode: 'live', liveKind: 'driving', coords, fix }`.
 * Driving is entered automatically by speed — never manually — and only from
 * a live GPS fix. It is not a peer of Live/Scout.
 */
function maybeResolveDriving(fix: UserCoords): ResolvedPresence | null {
  void fix;
  return null;
}

/**
 * In-session GPS already accepted by Find Me — not the Scout avatar persist.
 * After Scout the avatar may sit at Capitol; lastKnownAvatarPosition is that
 * pose and must NOT be used to re-enter Live.
 */
function existingSessionGpsFix(): UserCoords | null {
  const snap = getFindMeCoordsSnapshot();
  const fix = snap.coords;
  if (!fix) return null;
  if (!isInMinnesota(fix.lat, fix.lng)) return null;
  // Prefer a confirmed live fix; still accept coords if the store was seeded.
  if (snap.hasLiveFix || Number.isFinite(fix.lat)) return fix;
  return null;
}

function liveFromFix(fix: UserCoords): ResolvedPresence {
  const driving = maybeResolveDriving(fix);
  if (driving) return driving;
  return {
    mode: 'live',
    liveKind: 'gps',
    coords: { lat: fix.lat, lng: fix.lng },
    fix,
  };
}

/** Scout starting coords: live pose → persisted position → Capitol lawn. */
function scoutCoords(currentPose?: PersistedLatLng | null): PersistedLatLng {
  if (currentPose && isInMinnesota(currentPose.lat, currentPose.lng)) {
    return currentPose;
  }
  const persisted = getLastKnownAvatarPosition();
  if (persisted && isInMinnesota(persisted.lat, persisted.lng)) {
    return persisted;
  }
  return { lat: CAPITOL_SPAWN.lat, lng: CAPITOL_SPAWN.lng };
}

function scout(
  reason: ScoutReason,
  currentPose?: PersistedLatLng | null,
): ResolvedPresence {
  return {
    mode: 'scout',
    liveKind: 'gps',
    coords: scoutCoords(currentPose),
    scoutReason: reason,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('resolvePresenceMode: geolocation budget exceeded')),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function resolvePresenceMode(
  options: ResolvePresenceOptions = {},
): Promise<ResolvedPresence> {
  const request = options.request ?? 'auto';
  const allowPrompt = options.allowPrompt === true;
  const timeoutMs = options.timeoutMs ?? RESOLVE_GPS_BUDGET_MS;

  if (request === 'scout') {
    if (options.spawn === 'capitol') {
      return {
        mode: 'scout',
        liveKind: 'gps',
        coords: { lat: CAPITOL_SPAWN.lat, lng: CAPITOL_SPAWN.lng },
        scoutReason: 'preferred',
      };
    }
    return scout('preferred', options.currentPose);
  }

  // Cold boot honors an explicit Scout preference — instant, no geolocation.
  if (request === 'auto' && getPersistedPresenceMode() === 'scout') {
    return scout('preferred', options.currentPose);
  }

  // Scout → Live: reuse the GPS we already have. A fresh getUserPosition can
  // fail/timeout while a watch is active; that must not trap the user in Scout.
  const sessionFix = existingSessionGpsFix();
  if (request === 'live' && sessionFix) {
    return liveFromFix(sessionFix);
  }

  if (!isGeolocationSupported()) {
    if (sessionFix) return liveFromFix(sessionFix);
    return scout('geolocation-failed', options.currentPose);
  }

  try {
    if (!allowPrompt) {
      // Skip only when the browser has already said no. Safari often reports
      // `unknown` (no Permissions API) or `prompt` (Ask every visit) even
      // when a silent getCurrentPosition would succeed — those still try.
      // `prompt` + allowPrompt false refuses so silent paths never OS-prompt.
      const permission = await queryGeolocationPermission();
      if (permission === 'denied' && !isDespia()) {
        if (sessionFix) return liveFromFix(sessionFix);
        return scout('permission', options.currentPose);
      }
      if (permission === 'prompt' && !isDespia()) {
        if (sessionFix) return liveFromFix(sessionFix);
        return scout('permission', options.currentPose);
      }
    }

    const fix = await withTimeout(getUserPosition(), timeoutMs);

    if (!isInMinnesota(fix.lat, fix.lng)) {
      if (sessionFix) return liveFromFix(sessionFix);
      return scout('outside-minnesota', options.currentPose);
    }

    return liveFromFix(fix);
  } catch {
    // Denied mid-prompt, timeout, position unavailable, insecure context.
    // Prefer an existing in-session GPS fix over trapping the user in Scout.
    if (sessionFix) return liveFromFix(sessionFix);
    return scout('geolocation-failed', options.currentPose);
  }
}

/** UI copy for a failed Live switch. One message per reason; same handling. */
export function scoutNoticeFor(reason: ScoutReason | undefined): string | null {
  switch (reason) {
    case 'permission':
    case 'geolocation-failed':
      return 'Your account is only eligible for Scout mode right now.';
    case 'outside-minnesota':
      return "You're outside Minnesota, so Play is unavailable — enjoy Scout.";
    default:
      return null;
  }
}

// ── Deprecated aliases ───────────────────────────────────────────────────────

/** @deprecated Use ResolvePresenceOptions */
export type ResolvePositionModeOptions = ResolvePresenceOptions;
/** @deprecated Use ScoutReason */
export type FreeModeReason = ScoutReason;
/** @deprecated Use ResolvedPresence */
export type ResolvedPositionMode = ResolvedPresence;
/** @deprecated Use resolvePresenceMode */
export const resolvePositionMode = resolvePresenceMode;
/** @deprecated Use scoutNoticeFor */
export const freeModeNoticeFor = scoutNoticeFor;
