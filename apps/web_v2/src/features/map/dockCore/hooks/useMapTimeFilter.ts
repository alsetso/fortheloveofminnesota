'use client';

import { useSyncExternalStore } from 'react';
import {
  getMapTimeFilterSnapshot,
  subscribeMapTimeFilter,
} from '@/features/map/dockCore/store/mapTimeFilterStore';

const EMPTY = getMapTimeFilterSnapshot();

export function useMapTimeFilter() {
  return useSyncExternalStore(
    subscribeMapTimeFilter,
    getMapTimeFilterSnapshot,
    () => EMPTY,
  );
}
