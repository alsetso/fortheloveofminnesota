'use client';

/**
 * Campaign chase camera — one-shot boot frame only.
 *
 * While Free Mode is attached it owns every chase jumpTo. Release is a
 * withdrawal of ownership (no idle reframe). This hook only frames once on
 * enter so the scout isn't orphaned before the first stick input.
 */

import { useEffect } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { syncCampaignChaseCamera } from '@/map/location/positionMode/campaignChaseCamera';

export function useCampaignChaseCamera(
  map: MapboxMap | null,
  ready: boolean,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!map || !ready || !enabled) return;
    // One-shot boot — Free Mode owns chase after attachFreeMove.
    syncCampaignChaseCamera(map);
  }, [map, ready, enabled]);
}
