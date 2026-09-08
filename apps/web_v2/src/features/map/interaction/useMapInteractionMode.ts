'use client';

import { useSyncExternalStore } from 'react';
import {
  getMapInteractionModeSnapshot,
  subscribeMapInteractionMode,
  type MapInteractionMode,
} from '@/features/map/interaction/mapInteractionMode';

const SERVER_SNAP = { mode: 'browse' as MapInteractionMode };

/** Subscribe to the active map interaction mode. */
export function useMapInteractionMode(): MapInteractionMode {
  return useSyncExternalStore(
    subscribeMapInteractionMode,
    () => getMapInteractionModeSnapshot().mode,
    () => SERVER_SNAP.mode,
  );
}
