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
 * Boundary layers are NOT loaded automatically - they only load when user explicitly toggles them on
 * This prevents unnecessary API calls and improves initial page load performance
 */
export function useBoundaryLayers(mapData: MapData | null) {
  const [layers, setLayers] = useState<BoundaryLayersState>({
    showDistricts: false,
    showCTU: false,
    showStateBoundary: false,
    showCountyBoundaries: false,
  });

  // Initialize with all layers disabled - do NOT read from persisted settings
  // Layers will only be enabled when user explicitly toggles them on
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

    // Always start with all layers disabled, regardless of saved settings
    // User must explicitly toggle them on
    setLayers({
      showDistricts: false,
      showCTU: false,
      showStateBoundary: false,
      showCountyBoundaries: false,
    });
  }, [mapData?.id]); // Only reset when map changes, not when settings change

  // Sync boundary state with map via events
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('map-boundaries-change', {
      detail: layers,
    }));
  }, [layers]);

  return layers;
}
