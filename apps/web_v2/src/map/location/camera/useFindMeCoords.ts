'use client';

import { useSyncExternalStore } from 'react';
import {
  getFindMeCoordsSnapshot,
  subscribeFindMeCoords,
  subscribePassiveFindMeCoords,
  type FindMeCoordsSnapshot,
} from '@/map/location/camera/findMeCoordsStore';

const EMPTY: FindMeCoordsSnapshot = {
  coords: null,
  displayCoords: null,
  lookupCoords: null,
  mode: 'walking',
  modeKnown: false,
  hasLiveFix: false,
};

function getServerSnapshot(): FindMeCoordsSnapshot {
  return EMPTY;
}

/** Latest Find Me fix (null when idle / cleared). Includes display pose + mode. */
export function useFindMeCoords(): FindMeCoordsSnapshot {
  return useSyncExternalStore(
    subscribeFindMeCoords,
    getFindMeCoordsSnapshot,
    getServerSnapshot,
  );
}

/**
 * Coarse Find Me coords — only re-renders when raw position moves >=25m or
 * on the first fix of a session. Use for Today / territories / nearby
 * to avoid re-rendering on every 5s GPS tick.
 */
export function useFindMeCoordsPassive(): FindMeCoordsSnapshot {
  return useSyncExternalStore(
    subscribePassiveFindMeCoords,
    getFindMeCoordsSnapshot,
    getServerSnapshot,
  );
}
