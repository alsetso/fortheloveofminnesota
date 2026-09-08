'use client';

/**
 * Campaign / Game — compiled 3D player + ground-plane feet disc.
 * Story never mounts this; it uses GpsPuckView.
 */

import { useEffect, useRef, useState } from 'react';
import { useMapContext } from '@/map/MapProvider';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import { waitForAvatarStoreAttempted } from '@/features/avatar/avatarStore';
import { useFindMe } from '@/map/location/camera/useFindMe';
import { useFindMeCoords } from '@/map/location/camera/useFindMeCoords';
import {
  getAvatarPresentationCoords,
  getAvatarWalkSnapshot,
  subscribeAvatarWalk,
} from '@/map/location/player/avatarWalkController';
import { usePositionMode } from '@/map/location/positionMode/usePositionMode';
import {
  attachPlayerAvatarRuntime,
  detachPlayerAvatarRuntime,
  getAvatarRenderError,
  hidePlayerAvatar,
  prefetchPlayerAvatar,
  pushPlayerAvatarTarget,
  subscribeAvatarRenderError,
} from '@/map/location/player/playerAvatarRuntime';
import {
  clearUserMapPosition,
  removeUserMapPositionLayers,
  syncUserMapPosition,
  syncUserMapPositionCoords,
  type UserMapPositionVariant,
} from '@/map/location/position/paintUserMapPosition';

export function AvatarPositionView() {
  const { map, ready } = useMapContext();
  const { phase } = useFindMe();
  const { displayCoords, coords, mode } = useFindMeCoords();

  const { mode: positionMode } = usePositionMode();
  const isScout = positionMode === 'scout';

  const [avatarError, setAvatarError] = useState(() => getAvatarRenderError());
  const effectiveVariant: UserMapPositionVariant = avatarError ? 'dot' : 'avatar';
  const dotVariant: UserMapPositionVariant = isScout ? 'dot' : effectiveVariant;

  const gps = displayCoords ?? coords;
  const active = isScout || phase === 'active' || phase === 'finding';

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const sawPoseRef = useRef(false);
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    return subscribeAvatarRenderError(() => {
      setAvatarError(getAvatarRenderError());
    });
  }, []);

  useEffect(() => {
    if (effectiveVariant === 'avatar') prefetchPlayerAvatar();
  }, [effectiveVariant]);

  useEffect(() => {
    if (effectiveVariant !== 'avatar') return;
    if (isScout && active) {
      hidePlayerAvatar();
    }
  }, [isScout, effectiveVariant, active]);

  useEffect(() => {
    if (!map || !ready || effectiveVariant !== 'avatar') return;
    let cancelled = false;
    void Promise.all([
      waitForMapStyleReady(map, { timeoutMs: 8_000 }),
      waitForAvatarStoreAttempted(3_000),
    ])
      .then(() => {
        if (cancelled) return;
        attachPlayerAvatarRuntime(map);
      })
      .catch(() => {
        if (!cancelled) attachPlayerAvatarRuntime(map);
      });
    return () => {
      cancelled = true;
    };
  }, [map, ready, effectiveVariant]);

  useEffect(() => {
    if (effectiveVariant !== 'avatar') {
      detachPlayerAvatarRuntime({
        disposeModel: true,
        clearPose: true,
        blankFeature: true,
      });
      return;
    }
    return () => {
      hidePlayerAvatar();
      detachPlayerAvatarRuntime({
        disposeModel: false,
        clearPose: false,
        blankFeature: false,
      });
    };
  }, [map, effectiveVariant]);

  useEffect(() => {
    if (effectiveVariant !== 'avatar') return;
    if (isScout) return;
    if (!active) {
      if (phase === 'idle' || phase === 'error') {
        hidePlayerAvatar();
        sawPoseRef.current = false;
      }
      return;
    }
    if (!gps) return;

    const snap = !sawPoseRef.current || getAvatarWalkSnapshot().pose == null;
    pushPlayerAvatarTarget(gps, { mode: modeRef.current, snap });
    if (getAvatarWalkSnapshot().pose) sawPoseRef.current = true;
  }, [effectiveVariant, active, phase, gps, gps?.lat, gps?.lng, isScout]);

  useEffect(() => {
    if (!map || !ready) return;
    if (!active) {
      clearUserMapPosition(map);
      return;
    }
    const cachedFallback = phase === 'finding' ? getFindMeLastCoords() : null;
    const live = getAvatarPresentationCoords() ?? gps ?? cachedFallback;
    if (!live) {
      clearUserMapPosition(map);
      return;
    }
    const isPlayer = effectiveVariant === 'avatar';
    syncUserMapPosition(map, live, {
      variant: dotVariant,
      pulse: false,
      dotVisible: true,
      haloVisible: !isScout,
    });

    if (!isPlayer) return;

    let lastLat = live.lat;
    let lastLng = live.lng;
    return subscribeAvatarWalk(() => {
      const pose = getAvatarPresentationCoords();
      if (!pose) return;
      if (
        Math.abs(pose.lat - lastLat) < 1e-9 &&
        Math.abs(pose.lng - lastLng) < 1e-9
      ) {
        return;
      }
      lastLat = pose.lat;
      lastLng = pose.lng;
      try {
        syncUserMapPositionCoords(map, pose);
      } catch {
        /* Mapbox style can be null mid dock snap / resize */
      }
    });
  }, [
    map,
    ready,
    active,
    phase,
    gps,
    gps?.lat,
    gps?.lng,
    effectiveVariant,
    dotVariant,
    isScout,
  ]);

  useEffect(() => {
    return () => {
      const m = mapRef.current;
      if (!m) return;
      clearUserMapPosition(m);
      removeUserMapPositionLayers(m);
    };
  }, [map]);

  return null;
}
