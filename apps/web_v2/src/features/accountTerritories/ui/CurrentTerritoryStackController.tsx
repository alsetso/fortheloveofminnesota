'use client';

/**
 * Keeps the live territory stack in sync with Find Me while signed in.
 * Unlock celebrations are queued into TerritoryUnlockModal via sync.
 */

import { useEffect, useRef } from 'react';
import { useAuthSafe } from '@/features/auth';
import {
  syncCurrentTerritoryStack,
  territoryStackGridKey,
} from '@/features/accountTerritories/db/syncCurrentTerritoryStack';
import { useFindMeCoordsPassive } from '@/map/location/camera/useFindMeCoords';

export function CurrentTerritoryStackController() {
  const { account } = useAuthSafe();
  const { coords } = useFindMeCoordsPassive();
  const gridKey = coords ? territoryStackGridKey(coords.lat, coords.lng) : null;
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  useEffect(() => {
    if (!account?.id || !gridKey) return;
    const at = coordsRef.current;
    if (!at) return;

    const controller = new AbortController();
    void syncCurrentTerritoryStack(at.lat, at.lng, {
      signal: controller.signal,
      postPresence: true,
    });

    return () => controller.abort();
  }, [account?.id, gridKey]);

  return null;
}
