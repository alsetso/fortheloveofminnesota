'use client';

/**
 * useFollowCamera — camera lock / unlock, frame handlers, re-pin, auto-resume.
 *
 * Internal implementation for useMapCameraController. Prefer that façade from
 * FindMe / Game. Posture gates live in mapCameraAuthority (Live / Scout / pin).
 *
 * Owns:
 *   - camera ref management (pendingCamera, pendingZoom, pendingBearing)
 *   - orbit gesture (useUserOrbitGesture)
 *   - Follow Me GPS tick → camera easing
 *   - Avatar walk subscription → pin-find-me-center
 *   - Selected-point yield / re-lock
 *   - Live center hold (move / zoom) + zoomend / pitchend / moveend re-pin
 *   - style.load re-lock
 *   - autoResume (default Follow Me on map boot)
 *   - accuracy circle management
 *   - findMe / stopFindMe / unlockCamera / recenterFindMe callbacks
 */

import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
} from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { clearPointAtLocationCache } from '@/features/map/dockCore/store/pointAtLocationCache';
import { clearActiveRoute } from '@/features/map/dockCore/store/activeRouteStore';
import { clearRouteGeometry } from '@/lib/geo/nearby/routeLineStore';
import { isMapStyleReady, waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  getFindMeCoordsSnapshot,
  getFindMeDisplayCoords,
  subscribeFindMeCoords,
} from '@/map/location/camera/findMeCoordsStore';
import {
  clearSelectedPointCoords,
  subscribeSelectedPointCoords,
  getSelectedPointCoordsSnapshot,
} from '@/map/location/camera/selectedPointCoordsStore';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import {
  followToFindMe,
  holdFindMeCenter,
  jumpToFindMe,
  moveCameraToFindMe,
  pinFindMeCenter,
  resolveLookAheadM,
  setFindMeFrameLocked,
  type FindMeCameraMode,
  type FindMeCameraOptions,
} from '@/map/location/camera/flyToFindMe';
import {
  followPolicyForMode,
  metersBetween,
  resolveFacingHeading,
  resolveFollowDecision,
} from '@/map/location/device/locomotion';
import {
  getAvatarPresentationCoords,
  getAvatarWalkSnapshot,
  subscribeAvatarWalk,
} from '@/map/location/player/avatarWalkController';
import { isWithinMinnesota } from '@/map/location/device/minnesotaGate';
import {
  gpsOwnsCamera,
  isLiveFollowCamera,
} from '@/map/location/camera/mapCameraAuthority';
import { usePositionMode } from '@/map/location/positionMode/usePositionMode';
import { useUserOrbitGesture } from '@/map/location/camera/useUserOrbitGesture';
import {
  hideAccuracyCircle,
  refreshAccuracyRadius,
  showAccuracyCircle,
  updateAccuracyCircle,
} from '@/map/location/device/userAccuracyLayer';
import type { UseUserLocationReturn } from '@/map/location/UserLocationProvider';
import type { UserCoords } from '@/map/location/device/geolocation';
import type { FindMeOptions } from '@/map/location/camera/findMeTypes';
import {
  acquireCameraIntent,
  acquireExclusiveCameraIntent,
  releaseCameraIntent,
  resetCameraIntent,
} from '@/map/location/camera/cameraIntentStore';

function liveDisplayCoords(): UserCoords | null {
  return (
    getAvatarPresentationCoords() ??
    getFindMeDisplayCoords(getFindMeCoordsSnapshot())
  );
}

function sameLatLng(a: UserCoords, b: UserCoords): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

export type UseFollowCameraParams = {
  map: MapboxMap | null;
  ready: boolean;
  autoResume: boolean;
  lockToUser: boolean;
  lockToUserRef: MutableRefObject<boolean>;
  location: UseUserLocationReturn;
  /** @deprecated Kept for API stability; Live/Scout comes from PositionMode. */
  mapMode?: 'follow' | 'scout';
  compassModeRef: MutableRefObject<boolean>;
  headingRef: MutableRefObject<number | null>;
  beginHeadingIfNeeded: () => Promise<void>;
  stopHeading: () => void;
  /** Shared with useCompassHeading — single source of orbit state. */
  isOrbitingRef: MutableRefObject<boolean>;
};

export type UseFollowCameraReturn = {
  findMe: (opts?: FindMeOptions) => void;
  recenterFindMe: () => void;
  stopFindMe: () => void;
  unlockCamera: () => void;
  /** Live display coords for compass rotation. */
  liveDisplayCoords: () => UserCoords | null;
  /** lockFrame for compass rotation effect. */
  lockFrame: (m: MapboxMap) => void;
};

export function useFollowCamera({
  map,
  ready,
  autoResume,
  lockToUser,
  lockToUserRef,
  location,
  mapMode: _mapMode,
  compassModeRef,
  headingRef,
  beginHeadingIfNeeded,
  stopHeading,
  isOrbitingRef,
}: UseFollowCameraParams): UseFollowCameraReturn {
  const mapRef = useRef(map);
  mapRef.current = map;
  const phaseRef = useRef(location.phase);
  phaseRef.current = location.phase;

  const pendingCameraRef = useRef<FindMeCameraMode | 'none' | null>(null);
  const pendingZoomOverrideRef = useRef<number | null>(null);
  const pendingBearingOverrideRef = useRef<number | null>(null);
  const lastFollowedRef = useRef<UserCoords | null>(null);
  const isFrameLockedRef = useRef(false);
  const resumeStartedRef = useRef(false);
  const attachAbortRef = useRef<AbortController | null>(null);

  const syncAccuracy = useCallback((m: NonNullable<typeof map>, coords: UserCoords) => {
    if (!isMapStyleReady(m)) return;
    updateAccuracyCircle(m, coords);
  }, []);

  const { mode: positionMode } = usePositionMode();

  useUserOrbitGesture(map, {
    enabled:
      location.phase === 'active' &&
      isLiveFollowCamera(lockToUser) &&
      gpsOwnsCamera(lockToUser),
    onOrbitStart: () => { isOrbitingRef.current = true; },
    onOrbitEnd: () => { isOrbitingRef.current = false; },
    around: liveDisplayCoords,
  });
  const cameraOpts = useCallback((): FindMeCameraOptions => {
    const snap = getFindMeCoordsSnapshot();
    const bearingOverride = pendingBearingOverrideRef.current;
    pendingBearingOverrideRef.current = null;
    return {
      compassMode: compassModeRef.current,
      bearing: bearingOverride ?? resolveFacingHeading(
        snap.mode,
        snap.coords?.course,
        headingRef.current,
      ),
    };
  }, [compassModeRef, headingRef]);

  const lockFrame = useCallback((m: NonNullable<typeof map>) => {
    if (!lockToUserRef.current) {
      if (isFrameLockedRef.current) {
        setFindMeFrameLocked(m, false, { allowRotate: false, allowPitch: false });
        isFrameLockedRef.current = false;
      }
      return;
    }
    if (!isFrameLockedRef.current) {
      setFindMeFrameLocked(m, true, { compassMode: compassModeRef.current });
      isFrameLockedRef.current = true;
    }
  }, [lockToUserRef, compassModeRef]);

  const clearMapChrome = useCallback(() => {
    attachAbortRef.current?.abort();
    attachAbortRef.current = null;
    stopHeading();
    resetCameraIntent();
    const m = mapRef.current;
    if (m) {
      setFindMeFrameLocked(m, false, { allowRotate: lockToUserRef.current });
      isFrameLockedRef.current = false;
      hideAccuracyCircle(m);
    }
    lastFollowedRef.current = null;
    clearPointAtLocationCache();
    clearRouteGeometry();
    clearActiveRoute();
  }, [stopHeading, lockToUserRef]);

  // Explore / freecam: force-unlock leftover Game handlers on mount.
  useEffect(() => {
    if (lockToUser || !map || !ready) return;
    setFindMeFrameLocked(map, false, { allowRotate: false, allowPitch: false });
    isFrameLockedRef.current = false;
  }, [lockToUser, map, ready]);

  // Map unmount / style teardown.
  useEffect(() => {
    return () => { clearMapChrome(); };
  }, [clearMapChrome]);

  useEffect(() => {
    if (ready && map) return;
    clearMapChrome();
  }, [ready, map, clearMapChrome]);

  const stopFindMe = useCallback(() => {
    clearMapChrome();
    location.stop();
  }, [clearMapChrome, location]);

  const unlockCamera = useCallback(() => {
    clearMapChrome();
  }, [clearMapChrome]);

  const recenterFindMe = useCallback(() => {
    if (phaseRef.current !== 'active') return;
    const m = mapRef.current;
    if (!m || !ready || !isMapStyleReady(m)) return;
    const snap = getFindMeCoordsSnapshot();
    const coords = snap.coords ?? getFindMeDisplayCoords(snap);
    if (!coords) return;
    moveCameraToFindMe(m, coords, 'ease', cameraOpts());
    lockFrame(m);
  }, [ready, cameraOpts, lockFrame]);

  const attachToCoords = useCallback(
    async (
      coords: UserCoords,
      camera: FindMeCameraMode | 'none',
      signal: AbortSignal,
    ) => {
      const m = mapRef.current;
      if (!m || !ready) return;
      try {
        await waitForMapStyleReady(m, { signal });
      } catch (err) {
        // AbortError is expected — a newer attach superseded this one.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        throw err;
      }
      if (signal.aborted) return;
      const liveMap = mapRef.current;
      if (!liveMap || !isMapStyleReady(liveMap)) return;

      if (!lockToUserRef.current) {
        syncAccuracy(liveMap, coords);
        showAccuracyCircle(liveMap, coords);
        setFindMeFrameLocked(liveMap, false, { allowRotate: false, allowPitch: false });
        lastFollowedRef.current = coords;
        return;
      }

      if (camera !== 'none') {
        const prev = lastFollowedRef.current;
        const policy = followPolicyForMode(getFindMeCoordsSnapshot().mode);
        const shouldMove =
          camera !== 'ease' ||
          !prev ||
          metersBetween(prev, coords) >= policy.minDeltaM;
        if (shouldMove) {
          const overrideZoom = pendingZoomOverrideRef.current ?? undefined;
          pendingZoomOverrideRef.current = null;
          moveCameraToFindMe(liveMap, coords, camera, { ...cameraOpts(), overrideZoom });
        }
      }

      syncAccuracy(liveMap, coords);
      lockFrame(liveMap);
      lastFollowedRef.current = coords;
    },
    [ready, cameraOpts, lockFrame, syncAccuracy, lockToUserRef],
  );

  const findMe = useCallback(
    (opts?: FindMeOptions) => {
      const camera: FindMeCameraMode | 'none' = opts?.camera ?? 'fly';
      const quiet = opts?.quiet === true;
      const avoidPrompt = opts?.avoidPrompt === true;
      const m = mapRef.current;
      if (!m || !ready) return;

      clearSelectedPointCoords();
      pendingCameraRef.current = camera;
      if (opts?.zoom != null) pendingZoomOverrideRef.current = opts.zoom;
      if (opts?.bearing != null) pendingBearingOverrideRef.current = opts.bearing;
      void beginHeadingIfNeeded();

      const snap = getFindMeCoordsSnapshot();
      // Prefer any in-session coords (Scout → Live reuses the prior GPS fix
      // before the watch restarts). Do not require hasLiveFix — soft-resume
      // / seeded fixes still need an immediate frame lock.
      const coords = snap.coords ?? getFindMeDisplayCoords(snap);
      if (coords) {
        attachAbortRef.current?.abort();
        const ac = new AbortController();
        attachAbortRef.current = ac;
        void attachToCoords(coords, camera, ac.signal);
      }

      location.start({ quiet, avoidPrompt, force: true });
    },
    [ready, beginHeadingIfNeeded, location, attachToCoords],
  );

  const findMeRef = useRef(findMe);
  findMeRef.current = findMe;

  // When GPS phase changes — attach or clear.
  useEffect(() => {
    if (!ready || !map) return;
    if (!gpsOwnsCamera(lockToUserRef.current)) return;
    if (location.phase !== 'active' && location.phase !== 'finding') {
      if (location.phase === 'idle' || location.phase === 'error') {
        clearMapChrome();
      }
      return;
    }

    const phaseSnap = getFindMeCoordsSnapshot();
    const coords = phaseSnap.coords ?? getFindMeDisplayCoords(phaseSnap);
    if (!coords) return;
    if (!phaseSnap.hasLiveFix && location.phase === 'finding') return;

    const camera = pendingCameraRef.current ?? 'ease';
    pendingCameraRef.current = null;

    attachAbortRef.current?.abort();
    const ac = new AbortController();
    attachAbortRef.current = ac;

    const prev = lastFollowedRef.current;
    if (!prev) {
      void attachToCoords(coords, camera === 'none' ? 'jump' : camera, ac.signal);
      return;
    }

    if (sameLatLng(prev, coords)) return;

    const deltaM = metersBetween(prev, coords);
    const decision = resolveFollowDecision({
      mode: phaseSnap.mode,
      deltaM,
      isOrbiting: isOrbitingRef.current,
    });
    if (!decision.shouldMoveCamera) {
      void syncAccuracy(map, coords);
      lastFollowedRef.current = coords;
      return;
    }

    void (async () => {
      if (!isMapStyleReady(map)) {
        try {
          await waitForMapStyleReady(map, { signal: ac.signal });
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          throw err;
        }
        if (ac.signal.aborted) return;
      }
      syncAccuracy(map, coords);
      if (ac.signal.aborted) return;
      if (!lockToUserRef.current) {
        setFindMeFrameLocked(map, false, { allowRotate: false, allowPitch: false });
        lastFollowedRef.current = coords;
        return;
      }
      const useJump = decision.useJump || deltaM >= 500;
      const currentZoom = map.getZoom();
      if (useJump) {
        jumpToFindMe(map, coords, { ...cameraOpts(), preserveZoom: true });
      } else {
        followToFindMe(map, coords, {
          ...cameraOpts(),
          durationMs: decision.durationMs,
          lookAheadM: resolveLookAheadM(phaseSnap.coords?.speed, currentZoom),
        });
      }
      lockFrame(map);
      lastFollowedRef.current = coords;
    })();
  }, [
    location.phase,
    ready,
    map,
    attachToCoords,
    cameraOpts,
    lockFrame,
    clearMapChrome,
    syncAccuracy,
    lockToUserRef,
    positionMode,
  ]);

  // Live GPS store subscription → continuous follow camera.
  useEffect(() => {
    if (!ready || !map) return;
    if (location.phase !== 'active') return;
    if (!gpsOwnsCamera(lockToUser)) return;

    let prev = liveDisplayCoords();
    return subscribeFindMeCoords(() => {
      if (phaseRef.current !== 'active') return;
      if (!gpsOwnsCamera(lockToUserRef.current)) return;
      const snap = getFindMeCoordsSnapshot();
      const next = getAvatarPresentationCoords() ?? getFindMeDisplayCoords(snap);
      if (!next) return;

      const rawNext = snap.coords ?? next;
      if (prev && sameLatLng(prev, rawNext)) { prev = rawNext; return; }

      const deltaM = prev ? metersBetween(prev, rawNext) : Infinity;
      const decision = resolveFollowDecision({
        mode: snap.mode,
        deltaM,
        isOrbiting: isOrbitingRef.current,
      });
      prev = rawNext;

      if (!isMapStyleReady(map)) return;
      syncAccuracy(map, snap.coords ?? next);

      if (!lockToUserRef.current) {
        setFindMeFrameLocked(map, false, { allowRotate: false, allowPitch: false });
        lastFollowedRef.current = next;
        return;
      }

      if (getAvatarWalkSnapshot().phase === 'walking') {
        lastFollowedRef.current = next;
        return;
      }

      if (!isLiveFollowCamera(lockToUserRef.current)) {
        lastFollowedRef.current = next;
        return;
      }

      if (!decision.shouldMoveCamera) {
        lastFollowedRef.current = next;
        return;
      }

      // Yield to pinned intent — if a pin is active, skip follow ticks.
      if (!acquireCameraIntent('follow')) {
        lastFollowedRef.current = next;
        return;
      }

      const currentZoom = map.getZoom();
      const useJump = decision.useJump || deltaM >= 500;
      if (useJump) {
        jumpToFindMe(map, next, { ...cameraOpts(), preserveZoom: true });
      } else {
        followToFindMe(map, next, {
          ...cameraOpts(),
          durationMs: decision.durationMs,
          lookAheadM: resolveLookAheadM(snap.coords?.speed, currentZoom),
        });
      }
      releaseCameraIntent('follow');
      lockFrame(map);
      lastFollowedRef.current = next;
    });
  }, [ready, map, location.phase, cameraOpts, lockFrame, syncAccuracy, lockToUserRef, lockToUser, positionMode]);

  // Avatar walk subscription → pin-find-me-center.
  useEffect(() => {
    if (!ready || !map || !lockToUser) return;
    if (!gpsOwnsCamera(lockToUser)) return;
    if (location.phase !== 'active' && location.phase !== 'finding') return;

    return subscribeAvatarWalk(() => {
      if (phaseRef.current !== 'active' && phaseRef.current !== 'finding') return;
      if (!gpsOwnsCamera(lockToUserRef.current)) return;
      if (!lockToUserRef.current || isOrbitingRef.current) return;
      if (!isLiveFollowCamera(lockToUserRef.current)) return;
      const pose = getAvatarPresentationCoords();
      if (!pose || !isMapStyleReady(map)) return;
      pinFindMeCenter(map, pose);
      lastFollowedRef.current = pose;
    });
  }, [ready, map, lockToUser, location.phase, lockToUserRef, positionMode]);

  // Accuracy circle zoom rescaling.
  useEffect(() => {
    if (!map || !ready) return;
    if (location.phase !== 'active' && location.phase !== 'finding') return;
    const onZoom = () => {
      const coords = liveDisplayCoords();
      if (coords) refreshAccuracyRadius(map, coords);
    };
    map.on('zoom', onZoom);
    return () => { map.off('zoom', onZoom); };
  }, [map, ready, location.phase]);

  // Selected-point yield / re-lock.
  useEffect(() => {
    if (!map || !ready) return;
    return subscribeSelectedPointCoords(() => {
      const { coords } = getSelectedPointCoordsSnapshot();
      if (!lockToUserRef.current || !gpsOwnsCamera(lockToUserRef.current)) return;
      if (coords) {
        if (isFrameLockedRef.current) {
          setFindMeFrameLocked(map, false, { compassMode: compassModeRef.current });
          isFrameLockedRef.current = false;
        }
      } else {
        // Pin dismissed — release pinned intent so follow resumes immediately.
        releaseCameraIntent('pinned');
        const phase = phaseRef.current;
        if ((phase === 'active' || phase === 'finding') && isMapStyleReady(map)) {
          const snap = getFindMeCoordsSnapshot();
          const c = snap.coords ?? getFindMeDisplayCoords(snap);
          if (c) {
            lockFrame(map);
            moveCameraToFindMe(map, c, 'ease', cameraOpts());
          }
        }
      }
    });
  }, [map, ready, lockFrame, cameraOpts, lockToUserRef, compassModeRef]);

  // Live center hold — Pokemon Go posture: avatar frame never drifts.
  // Pinch/scroll use around:center; this catches residual two-finger drift
  // mid-gesture without fighting zoom (setCenter only). Only user gestures
  // (originalEvent) — never GPS easeTo / flyTo. Orbit skips — it owns
  // bearing around the avatar. Gesture-end pin restores padding.
  useEffect(() => {
    if (!map || !ready || !lockToUser) return;
    if (location.phase !== 'active') return;

    const canHold = () => {
      if (!lockToUserRef.current || !gpsOwnsCamera(lockToUserRef.current)) return false;
      if (!isFrameLockedRef.current) return false;
      if (isOrbitingRef.current) return false;
      return true;
    };

    const hold = (e: unknown) => {
      // Programmatic camera (GPS follow ease) must keep its spline.
      // Mapbox types omit originalEvent on zoom/move; runtime still sets it for gestures.
      if (!(e as { originalEvent?: Event }).originalEvent) return;
      if (!canHold()) return;
      const coords = liveDisplayCoords() ?? lastFollowedRef.current;
      if (!coords) return;
      holdFindMeCenter(map, coords);
    };

    const rePin = () => {
      if (!canHold()) return;
      const coords = liveDisplayCoords() ?? lastFollowedRef.current;
      if (!coords) return;
      pinFindMeCenter(map, coords);
    };

    map.on('move', hold);
    map.on('zoom', hold);
    map.on('zoomend', rePin);
    map.on('pitchend', rePin);
    map.on('moveend', rePin);
    return () => {
      map.off('move', hold);
      map.off('zoom', hold);
      map.off('zoomend', rePin);
      map.off('pitchend', rePin);
      map.off('moveend', rePin);
    };
  }, [map, ready, lockToUser, location.phase, lockToUserRef, isOrbitingRef]);

  // When presence enters Scout, force-unlock — GPS may still be active from
  // AuthBootstrap / prior Play, and style.load used to re-pin regardless.
  useEffect(() => {
    if (!map || !ready) return;
    if (positionMode !== 'scout') return;
    if (!lockToUserRef.current) return;
    setFindMeFrameLocked(map, false, { allowRotate: true, allowPitch: true });
    isFrameLockedRef.current = false;
  }, [map, ready, positionMode, lockToUserRef]);

  // Style.load re-lock (Mapbox resets handlers on style swap).
  useEffect(() => {
    if (!map || !ready) return;
    const reLock = () => {
      if (!lockToUserRef.current) {
        setFindMeFrameLocked(map, false, { allowRotate: false, allowPitch: false });
        isFrameLockedRef.current = false;
        return;
      }
      // Scout must stay unlocked — AuthBootstrap warms GPS so phase is often
      // already 'active' on first style.load; re-pinning here killed web pan.
      if (!isLiveFollowCamera(lockToUserRef.current)) {
        setFindMeFrameLocked(map, false, {
          allowRotate: true,
          allowPitch: true,
        });
        isFrameLockedRef.current = false;
        return;
      }
      if (phaseRef.current === 'active' || phaseRef.current === 'finding') {
        setFindMeFrameLocked(map, true, { compassMode: compassModeRef.current });
        isFrameLockedRef.current = true;
      }
    };
    map.on('style.load', reLock);
    return () => { map.off('style.load', reLock); };
  }, [map, ready, lockToUserRef, compassModeRef]);

  // Auto-resume — default Follow Me on map boot.
  useEffect(() => {
    if (!autoResume) { resumeStartedRef.current = false; return; }
    if (!ready || !map) { resumeStartedRef.current = false; return; }
    if (resumeStartedRef.current) return;

    const startFollow = () => {
      if (resumeStartedRef.current) return;
      if (!isMapStyleReady(map)) return;
      resumeStartedRef.current = true;

      // Live/Scout posture comes from PositionMode — no mapMode write.

      if (location.phase === 'active' || location.phase === 'finding') {
        const coords = liveDisplayCoords() ?? getFindMeLastCoords();
        if (coords && isWithinMinnesota(coords)) {
          pendingCameraRef.current = 'jump';
          attachAbortRef.current?.abort();
          const ac = new AbortController();
          attachAbortRef.current = ac;
          void attachToCoords(coords, 'jump', ac.signal);
        }
        if (!getFindMeCoordsSnapshot().hasLiveFix) {
          pendingCameraRef.current = 'fly';
          findMeRef.current({ camera: 'fly', quiet: true, avoidPrompt: true });
        }
        return;
      }

      const cached = getFindMeLastCoords();
      if (cached && isWithinMinnesota(cached)) {
        moveCameraToFindMe(map, cached, 'jump', cameraOpts());
        lockFrame(map);
        void syncAccuracy(map, cached);
        showAccuracyCircle(map, cached);
        lastFollowedRef.current = cached;
        pendingCameraRef.current = 'ease';
        findMeRef.current({ camera: 'ease', quiet: true });
        return;
      }

      pendingCameraRef.current = 'jump';
      findMeRef.current({ camera: 'jump', quiet: true });
    };

    if (isMapStyleReady(map)) { startFollow(); return; }

    const onStyleReady = () => startFollow();
    map.on('style.load', onStyleReady);
    map.on('idle', onStyleReady);
    return () => {
      map.off('style.load', onStyleReady);
      map.off('idle', onStyleReady);
    };
  }, [
    autoResume, ready, map, location.phase,
    cameraOpts, lockFrame, attachToCoords, syncAccuracy, lockToUserRef,
    beginHeadingIfNeeded,
  ]);

  return {
    findMe,
    recenterFindMe,
    stopFindMe,
    unlockCamera,
    liveDisplayCoords,
    lockFrame,
  };
}
