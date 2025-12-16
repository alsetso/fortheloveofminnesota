'use client';

import { useCallback } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { flyTo, fitBounds, zoomTo, panTo } from '../utils/mapHelpers';

export interface UseMapNavigationOptions {
  map: MapboxMap | null;
}

export interface UseMapNavigationReturn {
  flyTo: (coordinates: { lat: number; lng: number }, zoom?: number) => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: { padding?: number; duration?: number }
  ) => void;
  zoomTo: (zoom: number, duration?: number) => void;
  panTo: (coordinates: { lat: number; lng: number }, duration?: number) => void;
}

/**
 * Hook for map navigation operations
 */
export function useMapNavigation(
  options: UseMapNavigationOptions
): UseMapNavigationReturn {
  const { map } = options;

  const handleFlyTo = useCallback(
    (coordinates: { lat: number; lng: number }, zoom?: number) => {
      if (!map || map.removed) return;
      flyTo(map, coordinates, zoom);
    },
    [map]
  );

  const handleFitBounds = useCallback(
    (
      bounds: [[number, number], [number, number]],
      options?: { padding?: number; duration?: number }
    ) => {
      if (!map || map.removed) return;
      fitBounds(map, bounds, options);
    },
    [map]
  );

  const handleZoomTo = useCallback(
    (zoom: number, duration?: number) => {
      if (!map || map.removed) return;
      zoomTo(map, zoom, duration);
    },
    [map]
  );

  const handlePanTo = useCallback(
    (coordinates: { lat: number; lng: number }, duration?: number) => {
      if (!map || map.removed) return;
      panTo(map, coordinates, duration);
    },
    [map]
  );

  return {
    flyTo: handleFlyTo,
    fitBounds: handleFitBounds,
    zoomTo: handleZoomTo,
    panTo: handlePanTo,
  };
}



