'use client';

/**
 * useExploreModeZoom — sets the initial zoom floor on map load.
 *
 * Explore (free) mode no longer exists on the game surface. We set a baseline
 * floor on mount and then defer to getCtuFloorZoom() once the CTU resolves —
 * which may lower the floor to fit the user's city/town boundary.
 *
 * useCtuZoomFloor (GameMapControllers) always runs AFTER this and overrides
 * with the computed CTU floor, so setting MAP_CONFIG.MIN_ZOOM here is purely
 * a safe pre-CTU default, not a permanent ceiling.
 */

import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { getCtuFloorZoom } from '@/features/map/territory/ctuFloorZoomStore';
import { isFindMeZoomLocked } from '@/map/location/camera/flyToFindMe';
import { applyScoutZoomLimits } from '@/map/location/camera/scoutMapGestures';
import { getPresenceMode } from '@/map/location/positionMode/positionModeStore';

export function useExploreModeZoom(map: MapboxMap | null, ready: boolean): void {
  useEffect(() => {
    if (!map || !ready) return;
    // Live close owns min/max while follow-locked — don't reopen pinch.
    if (isFindMeZoomLocked()) return;
    if (getPresenceMode() === 'scout') {
      applyScoutZoomLimits(map);
      return;
    }
    // Use CTU floor if already resolved; otherwise fall back to game default (14).
    const floor = getCtuFloorZoom() ?? MAP_CONFIG.MIN_ZOOM;
    try {
      map.setMinZoom(floor);
    } catch {
      /* map removed */
    }
  }, [map, ready]);
}
