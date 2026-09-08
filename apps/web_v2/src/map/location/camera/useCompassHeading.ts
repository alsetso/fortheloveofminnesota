'use client';

/**
 * useCompassHeading — device heading stream + compassMode derivation.
 *
 * Owns:
 *   - useDeviceHeading setup (permission, start/stop, smoothing)
 *   - compassPref React state (user's heading-up toggle preference)
 *   - derived compassMode (allowCompass && liveFollow && compassPref)
 *   - automatic heading start/stop in response to compassMode changes
 *   - compass rotation camera effect (map bearing follows device heading)
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useDeviceHeading } from '@/map/location/device/useDeviceHeading';
import {
  followToFindMe,
  resolveLookAheadM,
} from '@/map/location/camera/flyToFindMe';
import {
  followPolicyForMode,
  resolveFacingHeading,
} from '@/map/location/device/locomotion';
import { getFindMeCoordsSnapshot } from '@/map/location/camera/findMeCoordsStore';
import { isLiveFollowCamera } from '@/map/location/camera/mapCameraAuthority';
import type { Map as MapboxMap } from 'mapbox-gl';
import { isMapStyleReady } from '@/map/engine/mapStyleGuard';
import type { UserLocationPhase } from '@/map/location/UserLocationProvider';

export type UseCompassHeadingParams = {
  allowCompass: boolean;
  allowCompassRef: MutableRefObject<boolean>;
  /** True while Live follow posture (gps|driving + lockToUser). */
  liveFollow: boolean;
  /** Used to gate compass rotation: only rotate when active. */
  phase: UserLocationPhase;
  lockToUserRef: MutableRefObject<boolean>;
  isOrbitingRef: MutableRefObject<boolean>;
  ready: boolean;
  map: MapboxMap | null;
  /** Called after each compass rotation to re-lock the frame. */
  lockFrame: (m: MapboxMap) => void;
  /** Live display coords for the camera rotate target. */
  liveDisplayCoords: () => import('@/map/location/device/geolocation').UserCoords | null;
};

export type UseCompassHeadingReturn = {
  heading: number | null;
  compassMode: boolean;
  compassModeRef: MutableRefObject<boolean>;
  headingRef: MutableRefObject<number | null>;
  setCompassMode: (on: boolean) => void;
  beginHeadingIfNeeded: () => Promise<void>;
  stopHeading: () => void;
};

export function useCompassHeading({
  allowCompass,
  allowCompassRef,
  liveFollow,
  phase,
  lockToUserRef,
  isOrbitingRef,
  ready,
  map,
  lockFrame,
  liveDisplayCoords,
}: UseCompassHeadingParams): UseCompassHeadingReturn {
  const {
    heading,
    requestPermission: requestHeadingPermission,
    start: startHeading,
    stop: stopHeading,
  } = useDeviceHeading({
    smoothing: 0.45,
    minDeltaDegrees: 0.5,
    snapDeltaDegrees: 25,
    snapSmoothing: 0.85,
  });

  const [compassPref, setCompassPref] = useState(false);

  /** Derived — true iff Live follow, heading allowed, user hasn't toggled off. */
  const compassMode = allowCompass && liveFollow && compassPref;
  const compassModeRef = useRef(compassMode);
  compassModeRef.current = compassMode;
  const headingRef = useRef(heading);
  headingRef.current = heading;

  const beginHeadingIfNeeded = useCallback(async () => {
    if (!allowCompassRef.current) {
      stopHeading();
      return;
    }
    const granted = await requestHeadingPermission();
    if (granted) startHeading();
    else stopHeading();
  }, [allowCompassRef, requestHeadingPermission, startHeading, stopHeading]);

  /** Toggle heading-up preference — persists across mode transitions. */
  const setCompassMode = useCallback((on: boolean) => {
    setCompassPref(on);
  }, []);

  // Start/stop heading based on derived compassMode.
  useEffect(() => {
    if (compassMode) void beginHeadingIfNeeded();
    else stopHeading();
  }, [compassMode, beginHeadingIfNeeded, stopHeading]);

  // Keep heading streaming when GPS becomes active (belt-and-suspenders for GPS activation).
  useEffect(() => {
    if (!allowCompass) return;
    if (phase === 'active' || phase === 'finding') {
      void beginHeadingIfNeeded();
    }
  }, [phase, allowCompass, beginHeadingIfNeeded]);

  // Compass rotation — rotate the map camera to match device heading.
  useEffect(() => {
    if (!lockToUserRef.current) return;
    if (!isLiveFollowCamera(lockToUserRef.current)) return;
    const snap = getFindMeCoordsSnapshot();
    const activeHeading = resolveFacingHeading(
      snap.mode,
      snap.coords?.course,
      heading,
    );
    if (!allowCompass || phase !== 'active' || !compassMode || activeHeading == null) {
      return;
    }
    if (isOrbitingRef.current) return;
    if (!map || !ready || !isMapStyleReady(map)) return;
    const coords = liveDisplayCoords();
    if (!coords) return;
    followToFindMe(map, coords, {
      compassMode: true,
      bearing: activeHeading,
      durationMs: followPolicyForMode(snap.mode).durationMs,
      lookAheadM: resolveLookAheadM(snap.coords?.speed),
    });
    lockFrame(map);
  }, [heading, phase, compassMode, allowCompass, ready, lockFrame, map, lockToUserRef, isOrbitingRef, liveDisplayCoords]);

  return {
    heading,
    compassMode,
    compassModeRef,
    headingRef,
    setCompassMode,
    beginHeadingIfNeeded,
    stopHeading,
  };
}
