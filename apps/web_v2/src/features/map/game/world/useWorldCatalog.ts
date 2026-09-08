'use client';

import { useSyncExternalStore } from 'react';
import type { WorldModelSpec } from '@/features/map/game/world/catalog';
import {
  getWorldCatalog,
  subscribeWorldCatalog,
} from '@/features/map/game/world/catalogStore';

export function useWorldCatalog(): WorldModelSpec[] {
  return useSyncExternalStore(
    subscribeWorldCatalog,
    getWorldCatalog,
    getWorldCatalog,
  );
}
