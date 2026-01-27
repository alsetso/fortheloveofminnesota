'use client';

import { useState, useEffect } from 'react';
import type { MapData } from '@/types/map';

interface BoundaryLayersState {
  showDistricts: boolean;
  showCTU: boolean;
  showStateBoundary: boolean;
  showCountyBoundaries: boolean;
}

/**
 * Hook to manage boundary layer visibility state
 * Syncs with persisted map_layers settings
 */
export function useBoundaryLayers(mapData: MapData | null) {
  const [layers, setLayers] = useState<BoundaryLayersState>({
    showDistricts: false,
    showCTU: false,
    showStateBoundary: false,
    showCountyBoundaries: false,
  });

  // Keep boundary toggles in sync with persisted map_layers
  useEffect(() => {
    if (!mapData) {
      setLayers({
        showDistricts: false,
        showCTU: false,
        showStateBoundary: false,
        showCountyBoundaries: false,
      });
      return;
    }

    const mapLayers = mapData.settings?.appearance?.map_layers || {};
    setLayers({
      showDistricts: Boolean(mapLayers.congressional_districts),
      showCTU: Boolean(mapLayers.ctu_boundaries),
      showStateBoundary: Boolean(mapLayers.state_boundary),
      showCountyBoundaries: Boolean(mapLayers.county_boundaries),
    });
  }, [mapData?.settings?.appearance?.map_layers]);

  // Sync boundary state with map via events
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('map-boundaries-change', {
      detail: layers,
    }));
  }, [layers]);

  return layers;
}
