'use client';

/**
 * Object Radar — Game feature root.
 *
 * Owns origin sync + still-out warmth + Minimaps sheet.
 * ObjectMiniMap is mounted by GameMinimapRail (dock left-rail column).
 *
 * Origin:
 *   Live  — Presence avatar / Find Me (player-centered range dial)
 *   Scout — main-map viewport center (surface-down camera footprint)
 */

import { useEffect } from 'react';
import {
  getObjectRadarState,
  hydrateObjectRadarStore,
  objectRadarActions,
} from '@/features/map/game/objectRadar/objectRadarStore';
import {
  destroyObjectRadarMap,
  ensureObjectRadarMap,
} from '@/features/map/game/objectRadar/services/objectRadarMapEngine';
import { readStillOutObjects } from '@/features/map/game/objectRadar/services/loadStillOutObjects';
import { MinimapsShell } from '@/features/map/game/minimaps/MinimapsShell';
import { useMapContext } from '@/map/MapProvider';
import { subscribeWorldPlacements } from '@/features/map/game/world/placementsStore';
import {
  getPresenceOrigin,
  isPresenceScout,
  subscribePresenceOrigin,
} from '@/map/location/positionMode/playerPresenceOrigin';
import { subscribePresence } from '@/map/location/positionMode/positionModeStore';

export { OBJECT_RADAR_MAP_STYLE } from '@/features/map/game/objectRadar/constants';

export function ObjectRadar() {
  const { map: mainMap, ready: mainMapReady } = useMapContext();

  useEffect(() => {
    hydrateObjectRadarStore();
    void ensureObjectRadarMap();
    return () => destroyObjectRadarMap();
  }, []);

  // Live: Presence origin. Scout: main-map viewport center.
  // Bearing drives the MiniMap compass wedge (camera-forward).
  useEffect(() => {
    const pushOrigin = () => {
      if (isPresenceScout()) {
        if (!mainMapReady || !mainMap) return;
        const c = mainMap.getCenter();
        objectRadarActions.setOrigin({
          lng: c.lng,
          lat: c.lat,
          bearing: mainMap.getBearing(),
        });
        return;
      }
      const { lng, lat } = getPresenceOrigin();
      const bearing =
        mainMapReady && mainMap
          ? mainMap.getBearing()
          : getObjectRadarState().origin.bearing;
      objectRadarActions.setOrigin({ lng, lat, bearing });
    };
    pushOrigin();
    const u1 = subscribePresenceOrigin(pushOrigin);
    const u2 = subscribePresence(pushOrigin);
    return () => {
      u1();
      u2();
    };
  }, [mainMap, mainMapReady]);

  useEffect(() => {
    if (!mainMap || !mainMapReady) return;

    const pushFromMainMap = () => {
      if (isPresenceScout()) {
        const c = mainMap.getCenter();
        objectRadarActions.setOrigin({
          lng: c.lng,
          lat: c.lat,
          bearing: mainMap.getBearing(),
        });
        return;
      }
      // Live: bearing only — position comes from Presence origin.
      const { lng, lat } = getPresenceOrigin();
      objectRadarActions.setOrigin({
        lng,
        lat,
        bearing: mainMap.getBearing(),
      });
    };

    // Scout needs move (pan/zoom) so the dial tracks the viewport footprint.
    // Live only needs rotate/move for the compass wedge.
    mainMap.on('rotate', pushFromMainMap);
    mainMap.on('move', pushFromMainMap);
    pushFromMainMap();
    return () => {
      mainMap.off('rotate', pushFromMainMap);
      mainMap.off('move', pushFromMainMap);
    };
  }, [mainMap, mainMapReady]);

  // Distance-gated refetch is handled by WorldModelsLayer via PlacementStreamService.
  // ObjectRadar stays in sync via the subscribeWorldPlacements subscription below.

  useEffect(() => {
    objectRadarActions.setStillOut(readStillOutObjects());
    return subscribeWorldPlacements(() => {
      objectRadarActions.setStillOut(readStillOutObjects());
    });
  }, []);

  return <MinimapsShell />;
}
