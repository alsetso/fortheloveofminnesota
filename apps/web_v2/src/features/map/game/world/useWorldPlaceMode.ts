'use client';

import { useSyncExternalStore } from 'react';
import {
  getWorldPlaceMode,
  subscribeWorldPlaceMode,
  type WorldPlaceMode,
} from '@/features/map/game/world/placeModeStore';

export function useWorldPlaceMode(): WorldPlaceMode {
  return useSyncExternalStore(
    subscribeWorldPlaceMode,
    getWorldPlaceMode,
    () => 'off' as const,
  );
}
