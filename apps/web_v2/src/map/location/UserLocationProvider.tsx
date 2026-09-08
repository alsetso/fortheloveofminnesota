'use client';

/**
 * App-wide GPS session — shared by Today / Map / Tools.
 * Writes findMeCoordsStore + last-known coords. Map chrome (GL puck / blue dot,
 * camera lock) lives in FindMeProvider and attaches when the map is mounted.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isDespia } from '@/lib/despia/despia';
import { haptic } from '@/lib/despia/haptics';
import { openAppSettings } from '@/lib/despia/openAppSettings';
import {
  clearFindMeCoords,
  setFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { getPositionMode } from '@/map/location/positionMode/positionModeStore';
import { persistAvatarPositionThrottled } from '@/map/location/positionMode/positionPersistence';
import { setFindMeSharingPreferred } from '@/map/location/device/findMeSharingPreference';
import {
  getUserPosition,
  isGeolocationSupported,
  queryGeolocationPermission,
  UserGeolocationError,
  watchUserPosition,
  adaptDespiaLocationWatch,
  type GeolocationErrorType,
  type UserCoords,
} from '@/map/location/device/geolocation';
import {
  FIND_ME_OUTSIDE_MN_MESSAGE,
  isWithinMinnesota,
} from '@/map/location/device/minnesotaGate';

export type UserLocationPhase = 'idle' | 'finding' | 'active' | 'error';

export type UserLocationStartOptions = {
  /** Skip status toasts (silent resume). Default false. */
  quiet?: boolean;
  /**
   * Soft resume: never trigger a fresh OS permission prompt.
   * Uses last-known coords when permission isn't already granted.
   * Despia / granted → refresh GPS + watch as usual.
   */
  avoidPrompt?: boolean;
  /**
   * Re-run even when already finding/active — upgrades a soft cache-only
   * session into a live watch after Find Me or splash refresh.
   */
  force?: boolean;
};

export type UseUserLocationReturn = {
  phase: UserLocationPhase;
  errorMessage: string | null;
  errorType: GeolocationErrorType | null;
  canLocate: boolean;
  canOpenSettings: boolean;
  start: (opts?: UserLocationStartOptions) => void;
  stop: () => void;
};

const UserLocationContext = createContext<UseUserLocationReturn | null>(null);

function rememberCoords(
  coords: UserCoords,
  opts?: { fromCache?: boolean; snapDisplay?: boolean },
) {
  const result = setFindMeCoords(coords, opts);
  // Persist lastKnownAvatarPosition (throttled, never per-frame) — but only
  // while GPS owns the avatar. In Free Mode the controller owns the persisted
  // position; a background GPS fix must not clobber it.
  if (result.accepted && getPositionMode() !== 'scout') {
    persistAvatarPositionThrottled({ lat: coords.lat, lng: coords.lng });
  }
  if (result.modeChanged) {
    adaptDespiaLocationWatch(result.mode);
  }
}

export type UserLocationProviderOptions = {
  /** Quiet auto-start on mount. App tabs: true. */
  autoStart?: boolean;
};

function useUserLocationSession({
  autoStart = true,
  enabled = true,
}: UserLocationProviderOptions & { enabled?: boolean } = {}): UseUserLocationReturn {
  const [phase, setPhase] = useState<UserLocationPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<GeolocationErrorType | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const errorTypeRef = useRef(errorType);
  errorTypeRef.current = errorType;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stopWatchRef = useRef<(() => void) | null>(null);
  const startAbortRef = useRef<AbortController | null>(null);
  const resumeStartedRef = useRef(false);

  const clearWatch = useCallback(() => {
    startAbortRef.current?.abort();
    startAbortRef.current = null;
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  }, []);

  // Note: lastKnownAvatarPosition is deliberately NOT cleared on stop/deny —
  // Free Mode restores from it, and losing it would dump the user at the
  // Capitol spawn instead of where they left off.
  const clearSharingPreference = useCallback(() => {
    setFindMeSharingPreferred(false);
  }, []);

  const clearSession = useCallback(() => {
    clearWatch();
    clearFindMeCoords();
  }, [clearWatch]);

  const setFailure = useCallback(
    (type: GeolocationErrorType, message: string) => {
      clearSession();
      clearSharingPreference();
      setErrorType(type);
      setErrorMessage(message);
      setPhase('error');
      haptic.findMe.error();
    },
    [clearSession, clearSharingPreference],
  );

  useEffect(() => {
    if (!enabled) return;
    return () => {
      clearSession();
    };
  }, [enabled, clearSession]);

  const stop = useCallback(() => {
    if (!enabledRef.current) return;
    if (phaseRef.current !== 'active' && phaseRef.current !== 'finding') return;
    haptic.findMe.stop();
    clearSession();
    clearSharingPreference();
    setPhase('idle');
    setErrorMessage(null);
    setErrorType(null);
  }, [clearSession, clearSharingPreference]);

  const beginWatch = useCallback(
    (coords: UserCoords, opts?: { fromCache?: boolean }) => {
      rememberCoords(coords, {
        snapDisplay: true,
        fromCache: opts?.fromCache === true,
      });
      stopWatchRef.current?.();
      const { stop: stopWatch } = watchUserPosition(
        (next) => {
          if (!isWithinMinnesota(next)) return;
          rememberCoords(next);
        },
        (watchErr) => {
          if (watchErr.type === 'permission_denied') {
            setFailure(watchErr.type, watchErr.message);
          }
        },
      );
      stopWatchRef.current = stopWatch;
      setErrorType(null);
      setErrorMessage(null);
      setPhase('active');
      setFindMeSharingPreferred(true);
    },
    [setFailure],
  );

  const start = useCallback(
    (opts?: UserLocationStartOptions) => {
      if (!enabledRef.current) return;
      const quiet = opts?.quiet === true;
      const avoidPrompt = opts?.avoidPrompt === true;
      const force = opts?.force === true;

      if (!force && (phaseRef.current === 'finding' || phaseRef.current === 'active')) {
        return;
      }

      if (!isGeolocationSupported()) {
        if (avoidPrompt) {
          const cached = getFindMeLastCoords();
          if (cached && isWithinMinnesota(cached)) {
            // Still poll/watch if the runtime supports it later.
            beginWatch(cached, { fromCache: true });
            return;
          }
          setPhase('idle');
          return;
        }
        setFailure('unsupported', 'Geolocation is not supported in this browser.');
        return;
      }

      const priorErrorType = errorTypeRef.current;

      startAbortRef.current?.abort();
      const ac = new AbortController();
      startAbortRef.current = ac;

      // Soft resume only: paint last-known immediately. Never re-seed cache on
      // a forced refresh — that snaps the camera back to the old city.
      const cached = getFindMeLastCoords();
      if (!force && cached && isWithinMinnesota(cached)) {
        rememberCoords(cached, { fromCache: true });
      }

      setPhase('finding');
      setErrorMessage(null);
      setErrorType(null);

      void (async () => {
        try {
          // User-gesture refresh (Find Me tap): call GPS immediately so Chrome
          // still treats this as a gesture. Awaiting Permissions API first
          // drops the gesture and returns a stale IP/Wi-Fi fix.
          if (force && !avoidPrompt) {
            const coords = await getUserPosition();
            if (ac.signal.aborted) return;
            if (!isWithinMinnesota(coords)) {
              setFailure('unknown', FIND_ME_OUTSIDE_MN_MESSAGE);
              return;
            }
            beginWatch(coords);
            if (!quiet) haptic.findMe.success();
            return;
          }

          const permission = await queryGeolocationPermission();
          if (ac.signal.aborted) return;

          const canFetchWithoutPrompt =
            isDespia() || permission === 'granted';

          if (permission === 'denied') {
            if (avoidPrompt) {
              if (cached && isWithinMinnesota(cached)) {
                // Stale-but-usable: no live watch if permission is hard-denied.
                rememberCoords(cached, { fromCache: true });
                setPhase('active');
                return;
              }
              setPhase('idle');
              return;
            }
            if (isDespia()) {
              await openAppSettings();
            }
            setFailure(
              'permission_denied',
              isDespia()
                ? 'Location access denied. Enable Location in Settings, then try again.'
                : 'Location permission denied. Enable location access in your browser or system settings, then try again.',
            );
            return;
          }

          if (!canFetchWithoutPrompt && avoidPrompt) {
            // prompt / unknown — do not call getCurrentPosition / watch (would re-prompt).
            if (cached && isWithinMinnesota(cached)) {
              rememberCoords(cached, { fromCache: true });
              setPhase('active');
              return;
            }
            setPhase('idle');
            return;
          }

          if (
            priorErrorType === 'permission_denied' &&
            permission === 'unknown' &&
            isDespia() &&
            !avoidPrompt
          ) {
            await openAppSettings();
          }

          const coords = await getUserPosition();
          if (ac.signal.aborted) return;

          if (!isWithinMinnesota(coords)) {
            if (avoidPrompt && cached && isWithinMinnesota(cached)) {
              beginWatch(cached, { fromCache: true });
              return;
            }
            setFailure('unknown', FIND_ME_OUTSIDE_MN_MESSAGE);
            return;
          }

          beginWatch(coords);
          if (!quiet) haptic.findMe.success();
        } catch (err) {
          if (ac.signal.aborted) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;

          // Soft path: keep last-known + start watch/poll instead of failing boot.
          if (avoidPrompt) {
            const fallback = getFindMeLastCoords();
            if (fallback && isWithinMinnesota(fallback)) {
              beginWatch(fallback, { fromCache: true });
              return;
            }
            setPhase('idle');
            return;
          }

          const typed =
            err instanceof UserGeolocationError
              ? err
              : new UserGeolocationError('unknown', 'Could not find your location.');

          if (typed.type === 'permission_denied' && isDespia()) {
            void openAppSettings();
          }

          setFailure(typed.type, typed.message);
        }
      })();
    },
    [setFailure, beginWatch],
  );

  const startRef = useRef(start);
  startRef.current = start;

  // Quiet soft auto-start — never re-prompt; AuthBootstrap / Find Me can upgrade.
  useEffect(() => {
    if (!enabled || !autoStart) {
      resumeStartedRef.current = false;
      return;
    }
    if (resumeStartedRef.current) return;
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'error') return;
    resumeStartedRef.current = true;
    startRef.current({ quiet: true, avoidPrompt: true });
  }, [enabled, autoStart]);

  return useMemo(
    () => ({
      phase,
      errorMessage,
      errorType,
      canLocate: enabled && isGeolocationSupported(),
      canOpenSettings: isDespia() && errorType === 'permission_denied',
      start,
      stop,
    }),
    [phase, errorMessage, errorType, enabled, start, stop],
  );
}

/** Shared location session for Today / Map / Tools. */
export function UserLocationProvider({
  children,
  autoStart = true,
}: { children: ReactNode } & UserLocationProviderOptions) {
  const value = useUserLocationSession({ autoStart, enabled: true });
  return createElement(UserLocationContext.Provider, { value }, children);
}

export function useUserLocation(): UseUserLocationReturn {
  const ctx = useContext(UserLocationContext);
  if (!ctx) throw new Error('useUserLocation must be used within UserLocationProvider');
  return ctx;
}

export function useUserLocationOptional(): UseUserLocationReturn | null {
  return useContext(UserLocationContext);
}

/** Embedded session for surfaces outside AppShell (e.g. Explore). */
export function useEmbeddedUserLocationSession(
  options: UserLocationProviderOptions & { enabled?: boolean } = {},
): UseUserLocationReturn {
  return useUserLocationSession(options);
}
