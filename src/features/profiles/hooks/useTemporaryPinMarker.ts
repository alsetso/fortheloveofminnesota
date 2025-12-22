'use client';

import { useRef, useCallback } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface UseTemporaryPinMarkerOptions {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
}

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Hook for managing temporary pin marker on map
 * Creates a pulsing red marker that appears when user clicks map to create a pin
 */
export function useTemporaryPinMarker({ map, mapLoaded }: UseTemporaryPinMarkerOptions) {
  const temporaryMarkerRef = useRef<any>(null);

  // Add temporary pin marker on map
  const addTemporaryPin = useCallback(async (coordinates: Coordinates) => {
    if (!map || !mapLoaded || (map as any).removed) return;

    try {
      const mapbox = await loadMapboxGL();

      // Remove existing temporary marker if any
      if (temporaryMarkerRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }

      // Create temporary marker element with heart image
      const el = document.createElement('div');
      el.className = 'temporary-pin-marker';
      el.style.cssText = `
        width: 32px;
        height: 32px;
        cursor: pointer;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const img = document.createElement('img');
      img.src = '/heart.png';
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
      `;
      el.appendChild(img);

      // Create marker
      const marker = new mapbox.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(map as any);

      temporaryMarkerRef.current = marker;
    } catch (err) {
      console.error('[useTemporaryPinMarker] Error creating temporary pin:', err);
    }
  }, [map, mapLoaded]);

  // Remove temporary pin marker
  const removeTemporaryPin = useCallback(() => {
    if (temporaryMarkerRef.current) {
      temporaryMarkerRef.current.remove();
      temporaryMarkerRef.current = null;
    }
  }, []);

  // Update temporary pin color based on visibility (no-op since we use heart image)
  const updateTemporaryPinColor = useCallback((visibility: 'public' | 'only_me') => {
    // Heart image doesn't change based on visibility
  }, []);

  return {
    addTemporaryPin,
    removeTemporaryPin,
    updateTemporaryPinColor,
  };
}
