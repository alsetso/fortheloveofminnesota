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

      // Create temporary marker element with pulsing animation
      const el = document.createElement('div');
      el.className = 'temporary-pin-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #ef4444;
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        cursor: pointer;
        pointer-events: none;
      `;

      // Add animation keyframes if not already added
      if (!document.getElementById('temporary-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'temporary-marker-styles';
        style.textContent = `
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            }
            50% {
              box-shadow: 0 0 0 12px rgba(239, 68, 68, 0);
            }
          }
        `;
        document.head.appendChild(style);
      }

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

  // Update temporary pin color based on visibility
  const updateTemporaryPinColor = useCallback((visibility: 'public' | 'only_me') => {
    if (!temporaryMarkerRef.current) return;
    
    const markerElement = temporaryMarkerRef.current.getElement();
    if (!markerElement) return;

    // Update background color based on visibility
    // Public: red (#ef4444), Private: gray (#6b7280)
    const backgroundColor = visibility === 'public' ? '#ef4444' : '#6b7280';
    const shadowColor = visibility === 'public' 
      ? 'rgba(239, 68, 68, 0.7)' 
      : 'rgba(107, 114, 128, 0.7)';

    markerElement.style.backgroundColor = backgroundColor;
    markerElement.style.boxShadow = `0 0 0 0 ${shadowColor}`;
  }, []);

  return {
    addTemporaryPin,
    removeTemporaryPin,
    updateTemporaryPinColor,
  };
}
