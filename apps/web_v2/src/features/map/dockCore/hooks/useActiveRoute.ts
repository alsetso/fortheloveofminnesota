'use client';

import { useSyncExternalStore } from 'react';
import {
  getActiveRouteSnapshot,
  subscribeActiveRoute,
  type ActiveRouteSession,
} from '@/features/map/dockCore/store/activeRouteStore';

const EMPTY = { route: null as ActiveRouteSession | null };

export function useActiveRoute(): { route: ActiveRouteSession | null } {
  return useSyncExternalStore(
    subscribeActiveRoute,
    getActiveRouteSnapshot,
    () => EMPTY,
  );
}
