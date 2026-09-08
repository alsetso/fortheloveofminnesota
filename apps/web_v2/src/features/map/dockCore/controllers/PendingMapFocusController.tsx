'use client';

import { useEffect, useRef } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useCommitMinnesotaMapPoint } from '@/lib/geo/commitMinnesotaMapPoint';
import { takePendingMapFocus } from '@/map/location/camera/pendingMapFocus';
import { useMapContext } from '@/map/MapProvider';

/**
 * Consumes a one-shot place focus queued from `/feed` (or other non-map
 * surfaces). Runs once the map engine is ready, then opens the selected point.
 */
export function PendingMapFocusController() {
  const { map, ready } = useMapContext();
  const { commit } = useCommitMinnesotaMapPoint();
  const { openSelectedPoint } = useMapDock();
  const consumedRef = useRef(false);

  useEffect(() => {
    if (!map || !ready || consumedRef.current) return;
    const focus = takePendingMapFocus();
    if (!focus) return;
    consumedRef.current = true;
    void (async () => {
      const result = await commit(
        { lat: focus.lat, lng: focus.lng },
        { source: 'mapSearch', fly: true, label: focus.label },
      );
      if (result.ok) openSelectedPoint();
    })();
  }, [map, ready, commit, openSelectedPoint]);

  return null;
}
