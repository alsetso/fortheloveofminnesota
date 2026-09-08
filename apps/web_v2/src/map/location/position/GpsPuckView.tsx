'use client';

/**
 * Story / atlas — GPS puck only.
 * Blue viewport-stable dot + meter-true accuracy circle. No face, no 3D.
 */

import { useEffect, useRef } from 'react';
import { useMapContext } from '@/map/MapProvider';
import { useFindMe } from '@/map/location/camera/useFindMe';
import { useFindMeCoords } from '@/map/location/camera/useFindMeCoords';
import { getFindMeLastCoords } from '@/map/location/device/findMeLastCoords';
import {
  hideAccuracyCircle,
  refreshAccuracyRadius,
  showAccuracyCircle,
} from '@/map/location/device/userAccuracyLayer';
import { detachPlayerAvatarRuntime } from '@/map/location/player/playerAvatarRuntime';
import {
  clearUserMapPosition,
  removeUserMapPositionLayers,
  syncUserMapPosition,
} from '@/map/location/position/paintUserMapPosition';

export function GpsPuckView() {
  const { map, ready } = useMapContext();
  const { phase } = useFindMe();
  const { displayCoords, coords } = useFindMeCoords();
  const gps = displayCoords ?? coords;
  const active = phase === 'active' || phase === 'finding';
  const live = gps ?? (phase === 'finding' ? getFindMeLastCoords() : null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    detachPlayerAvatarRuntime({
      disposeModel: true,
      clearPose: true,
      blankFeature: true,
    });
  }, []);

  useEffect(() => {
    if (!map || !ready) return;
    if (!active || !live) {
      clearUserMapPosition(map);
      hideAccuracyCircle(map);
      return;
    }
    syncUserMapPosition(map, live, {
      variant: 'dot',
      pulse: false,
      dotVisible: true,
      haloVisible: false,
    });
    showAccuracyCircle(map, live);

    const onZoom = () => {
      const next = liveRef.current;
      if (next) refreshAccuracyRadius(map, next);
    };
    map.on('zoom', onZoom);
    return () => {
      map.off('zoom', onZoom);
    };
  }, [map, ready, active, live, live?.lat, live?.lng, live?.accuracy]);

  useEffect(() => {
    return () => {
      const m = mapRef.current;
      if (!m) return;
      hideAccuracyCircle(m);
      clearUserMapPosition(m);
      removeUserMapPositionLayers(m);
    };
  }, [map]);

  return null;
}
