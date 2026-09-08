'use client';

/**
 * Keeps live experience-zone membership + approach proximity in sync with Find Me.
 * Mounts app-wide beside CurrentTerritoryStackController — no passport writes.
 */

import { useEffect, useRef } from 'react';
import {
  experienceZoneGridKey,
  syncCurrentExperienceZone,
} from '@/features/experienceZones/db/syncCurrentExperienceZone';
import { syncNearbyExperienceZones } from '@/features/experienceZones/db/syncNearbyExperienceZones';
import { useFindMeCoordsPassive } from '@/map/location/camera/useFindMeCoords';

export function CurrentExperienceZoneController() {
  const { coords } = useFindMeCoordsPassive();
  const gridKey = coords ? experienceZoneGridKey(coords.lat, coords.lng) : null;
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  useEffect(() => {
    if (!gridKey) return;
    const at = coordsRef.current;
    if (!at) return;

    const controller = new AbortController();
    void (async () => {
      const inside = await syncCurrentExperienceZone(at.lat, at.lng, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      await syncNearbyExperienceZones(at.lat, at.lng, {
        signal: controller.signal,
        inside: inside.zones.length > 0,
      });
    })();

    return () => controller.abort();
  }, [gridKey]);

  return null;
}
