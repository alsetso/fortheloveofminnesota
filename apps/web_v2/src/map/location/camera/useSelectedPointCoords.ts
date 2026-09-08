'use client';

import { useSyncExternalStore } from 'react';
import {
  getSelectedPointCoordsSnapshot,
  subscribeSelectedPointCoords,
  type SelectedPointCoordsSnapshot,
} from '@/map/location/camera/selectedPointCoordsStore';

const EMPTY: SelectedPointCoordsSnapshot = { coords: null };

function getServerSnapshot(): SelectedPointCoordsSnapshot {
  return EMPTY;
}

/** Latest map click / search place point (null when cleared). */
export function useSelectedPointCoords(): SelectedPointCoordsSnapshot {
  return useSyncExternalStore(
    subscribeSelectedPointCoords,
    getSelectedPointCoordsSnapshot,
    getServerSnapshot,
  );
}
