'use client';

import { isSaveableTerritoryDockKind } from '@/features/accountTerritories/store/constants';
import {
  useCurrentTerritoryStack,
} from '@/features/accountTerritories/store/currentTerritoryStackStore';
import type { TerritoryAtPointItem } from '@/lib/territory/territoryAtPointTypes';

export type LiveLocationTerritories = {
  /** The live position the current jurisdictions were resolved against. */
  coords: { lat: number; lng: number } | null;
  /** Saveable jurisdictions at the live position (home-eligible kinds only). */
  jurisdictions: TerritoryAtPointItem[];
  loading: boolean;
  error: string | null;
};

/**
 * Derives saveable jurisdictions from the shared currentTerritoryStackStore —
 * the same data that CurrentTerritoryStackController resolves at ~110 m grids.
 *
 * No duplicate network request: the territory stack is already fetched by
 * CurrentTerritoryStackController (always mounted in AppShell). This hook
 * just filters to home-eligible kinds and exposes the loading/error state.
 */
export function useLiveLocationTerritories(enabled: boolean): LiveLocationTerritories {
  const stack = useCurrentTerritoryStack();

  if (!enabled) {
    return { coords: null, jurisdictions: [], loading: false, error: null };
  }

  if (!stack.ready) {
    return { coords: null, jurisdictions: [], loading: stack.loading, error: null };
  }

  const jurisdictions = (stack.jurisdictions ?? []).filter((j) =>
    isSaveableTerritoryDockKind(j.kind),
  );

  return {
    coords: stack.coords,
    jurisdictions,
    loading: false,
    error:
      stack.coords !== null && jurisdictions.length === 0
        ? 'No saveable territories at this location.'
        : stack.error,
  };
}
