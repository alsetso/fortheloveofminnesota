'use client';

import { useSyncExternalStore } from 'react';
import {
  getMapStatusToastSnapshot,
  subscribeMapStatusToast,
  type MapStatusToastSnapshot,
} from '@/features/map/toast/mapStatusToastStore';

const EMPTY: MapStatusToastSnapshot = { rows: [], title: null };

function getServerSnapshot(): MapStatusToastSnapshot {
  return EMPTY;
}

/** Subscribe to ephemeral map status rows (Find Me, etc.). */
export function useMapStatusToast(): MapStatusToastSnapshot {
  return useSyncExternalStore(
    subscribeMapStatusToast,
    getMapStatusToastSnapshot,
    getServerSnapshot,
  );
}
