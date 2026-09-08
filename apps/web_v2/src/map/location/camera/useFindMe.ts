'use client';

/**
 * useFindMe — thin coordinator. Composes:
 *
 *   useCompassHeading       device heading + compassMode derivation
 *   useMapCameraController  Live follow | Scout free | pin yield (Phase 2 owner)
 *
 * GPS session (phase, start/stop) comes from UserLocationProvider (shared or
 * embedded) and is threaded into the sub-hooks. This file owns:
 *   - Context creation / provider
 *   - Public type surface (UseFindMeReturn, FindMeProviderOptions)
 *   - PositionMode / Live-follow subscription for compass + orbit
 *   - Shared refs: lockToUserRef, allowCompassRef, isOrbitingRef
 *   - lockFrameRef / liveDisplayCoordsRef wrappers (break circular dependency)
 */

import {
  createContext,
  createElement,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useMapContext } from '@/map/MapProvider';
import {
  getPositionModeSnapshot,
  getPositionModeServerSnapshot,
  subscribePositionMode,
} from '@/map/location/positionMode/positionModeStore';
import { isLiveFollowCamera } from '@/map/location/camera/mapCameraAuthority';
import {
  useEmbeddedUserLocationSession,
  useUserLocationOptional,
  type UseUserLocationReturn,
  type UserLocationPhase,
} from '@/map/location/UserLocationProvider';
import type { GeolocationErrorType, UserCoords } from '@/map/location/device/geolocation';
import { useCompassHeading } from '@/map/location/camera/useCompassHeading';
import { useMapCameraController } from '@/map/location/camera/useMapCameraController';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { FindMeOptions } from '@/map/location/camera/findMeTypes';
export type { FindMeOptions } from '@/map/location/camera/findMeTypes';

export type FindMePhase = UserLocationPhase;

export type FindMeProviderOptions = {
  /**
   * Quiet auto-attach Follow Me when the map is ready.
   * Consumer map: true. Explore: false (statewide freecam).
   */
  autoResume?: boolean;
  /**
   * Device-heading / gyroscope rotate-around-you.
   * Consumer map: true (toggleable). Explore: false.
   */
  allowCompass?: boolean;
  /**
   * Pin the camera to the user (disable dragPan) and enable one-finger orbit.
   * Game: true. Explore atlas: false — pan freely even if GPS is already live
   * from another surface.
   */
  lockToUser?: boolean;
};

export type UseFindMeReturn = {
  phase: FindMePhase;
  errorMessage: string | null;
  errorType: GeolocationErrorType | null;
  canFindMe: boolean;
  canOpenSettings: boolean;
  /**
   * True while in Live (follow) mode, heading permitted, and user hasn't
   * explicitly toggled it off. Derived from PositionMode + compassPref.
   */
  compassMode: boolean;
  /** Toggle heading-up on/off while in Live mode (persists across mode transitions). */
  setCompassMode: (on: boolean) => void;
  /** False on surfaces that never want gyro heading (e.g. Explore). */
  allowCompass: boolean;
  /** Smoothed device heading degrees, or null. */
  heading: number | null;
  /** Start location sharing (no-op while finding/active). */
  findMe: (opts?: FindMeOptions) => void;
  /**
   * Reinforce locked Follow Me frame (no-op unless active).
   * While locked, camera already tracks GPS — this re-applies center/zoom/bearing.
   */
  recenterFindMe: () => void;
  /** Stop location sharing and unlock pan/rotate. */
  stopFindMe: () => void;
  /**
   * Exit Live follow: unlock the camera frame and disable gyro, but keep the
   * GPS session alive so the user dot remains visible in Scout / atlas.
   * Use this instead of stopFindMe when leaving Live without killing location.
   */
  unlockCamera: () => void;
};

const FindMeContext = createContext<UseFindMeReturn | null>(null);

function useFindMeSession({
  autoResume = true,
  allowCompass = true,
  lockToUser = true,
  location,
}: FindMeProviderOptions & { location: UseUserLocationReturn }): UseFindMeReturn {
  const { map, ready } = useMapContext();

  const allowCompassRef = useRef(allowCompass);
  allowCompassRef.current = allowCompass;
  const lockToUserRef = useRef(lockToUser);
  lockToUserRef.current = lockToUser;

  /** Reactive Live/Scout — drives orbit gesture and compassMode derivation. */
  useSyncExternalStore(
    subscribePositionMode,
    getPositionModeSnapshot,
    getPositionModeServerSnapshot,
  );
  const liveFollow = isLiveFollowCamera(lockToUser);

  /**
   * Shared orbit ref — both hooks need to read/write the same value:
   *   useMapCameraController writes true/false on orbit start/end.
   *   useCompassHeading reads it to skip compass rotation during orbit.
   */
  const isOrbitingRef = useRef(false);

  /**
   * Ref wrappers that break the circular dependency between compass and camera:
   *   useCompassHeading needs lockFrame and liveDisplayCoords from the camera controller.
   *   The camera controller needs compassModeRef and headingRef from useCompassHeading.
   *
   * We pass the ref wrappers to compass first (they start as no-ops), run the
   * camera hook, then assign the real implementations. Since React effects run
   * after paint, both hooks' effects always see the final implementations.
   */
  const lockFrameRef = useRef<(m: MapboxMap) => void>(() => {});
  const liveDisplayCoordsRef = useRef<() => UserCoords | null>(() => null);

  // ── Compass heading (runs first — camera needs its refs) ─────────────────────
  const compass = useCompassHeading({
    allowCompass,
    allowCompassRef,
    liveFollow,
    phase: location.phase,
    lockToUserRef,
    isOrbitingRef,
    ready,
    map,
    lockFrame: (m) => lockFrameRef.current(m),
    liveDisplayCoords: () => liveDisplayCoordsRef.current(),
  });

  // ── Map camera controller (runs second — assigns the real lockFrame impl) ────
  const camera = useMapCameraController({
    map,
    ready,
    autoResume,
    lockToUser,
    lockToUserRef,
    location,
    compassModeRef: compass.compassModeRef,
    headingRef: compass.headingRef,
    beginHeadingIfNeeded: compass.beginHeadingIfNeeded,
    stopHeading: compass.stopHeading,
    isOrbitingRef,
  });

  // Assign real implementations — effects in both hooks see these on every render.
  lockFrameRef.current = camera.lockFrame;
  liveDisplayCoordsRef.current = camera.liveDisplayCoords;

  return {
    phase: location.phase,
    errorMessage: location.errorMessage,
    errorType: location.errorType,
    canFindMe: Boolean(ready && map && location.canLocate),
    canOpenSettings: location.canOpenSettings,
    compassMode: compass.compassMode,
    setCompassMode: compass.setCompassMode,
    allowCompass,
    heading: compass.heading,
    findMe: camera.findMe,
    recenterFindMe: camera.recenterFindMe,
    stopFindMe: camera.stopFindMe,
    unlockCamera: camera.unlockCamera,
  };
}

/** Single Find Me session for rails + Explore dock. */
export function FindMeProvider({
  children,
  autoResume = true,
  allowCompass = true,
  lockToUser = true,
}: { children: ReactNode } & FindMeProviderOptions) {
  const shared = useUserLocationOptional();
  const embedded = useEmbeddedUserLocationSession({
    autoStart: !shared && autoResume,
    enabled: !shared,
  });
  const location = shared ?? embedded;
  const value = useFindMeSession({ autoResume, allowCompass, lockToUser, location });
  return createElement(FindMeContext.Provider, { value }, children);
}

export function useFindMe(): UseFindMeReturn {
  const ctx = useContext(FindMeContext);
  if (!ctx) throw new Error('useFindMe must be used within FindMeProvider');
  return ctx;
}
