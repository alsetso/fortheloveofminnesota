'use client';

import { useCallback, useEffect } from 'react';
import {
  setTerritoriesAroundMeOn,
  useTerritoriesAroundMe,
} from '@/features/map/territory/territoriesAroundMeStore';
import { useTerritoryLayers } from '@/features/map/territory/TerritoryLayersProvider';

/**
 * Single explicit owner of the "around me" vs. "boundary layers" rule:
 * only one can paint the map at a time. Previously this was split across
 * a toggle (`useTerritoriesAroundMeToggle`, clears layers before turning
 * on) and a reactive effect in `TerritoriesAroundMeController` (turns
 * around-me off when a layer comes on) — same rule, two places. Both now
 * read from here.
 */
function useExclusiveState(): { aroundMeOn: boolean; boundaryLayersOn: boolean } {
  const { on: aroundMeOn } = useTerritoriesAroundMe();
  const { activeSlugs, countyOverlays, schoolsLayer } = useTerritoryLayers();
  const boundaryLayersOn =
    activeSlugs.size > 0 ||
    countyOverlays.citiesOn ||
    countyOverlays.townsOn ||
    schoolsLayer.on;
  return { aroundMeOn, boundaryLayersOn };
}

/** Mounted once (in `TerritoriesAroundMeController`) — enforces layers-win. */
export function useEnforceAroundMeExclusive(): void {
  const { aroundMeOn, boundaryLayersOn } = useExclusiveState();
  useEffect(() => {
    if (aroundMeOn && boundaryLayersOn) setTerritoriesAroundMeOn(false);
  }, [aroundMeOn, boundaryLayersOn]);
}

/** Used by the Controls card toggle — enforces around-me-wins on enable. */
export function useAroundMeExclusiveToggle(): { on: boolean; toggle: () => void } {
  const { aroundMeOn: on } = useExclusiveState();
  const { clearAllBoundaryPaint } = useTerritoryLayers();

  const toggle = useCallback(() => {
    if (on) {
      setTerritoriesAroundMeOn(false);
      return;
    }
    clearAllBoundaryPaint();
    setTerritoriesAroundMeOn(true);
  }, [on, clearAllBoundaryPaint]);

  return { on, toggle };
}
