'use client';

import { useSyncExternalStore } from 'react';
import {
  getPresenceServerSnapshot,
  getPresenceSnapshot,
  subscribePresence,
  type PresenceSnapshot,
} from '@/map/location/positionMode/positionModeStore';

/** Reactive read of the presence store (Live / Scout). */
export function usePresence(): PresenceSnapshot {
  return useSyncExternalStore(
    subscribePresence,
    getPresenceSnapshot,
    getPresenceServerSnapshot,
  );
}

/** @deprecated Use usePresence */
export const usePositionMode = usePresence;
