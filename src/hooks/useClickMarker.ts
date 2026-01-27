import { useRef, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface UseClickMarkerOptions {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  getMap?: () => MapboxMapInstance | null;
}

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Optimized hook for managing click marker (white circle with black dot)
 * - Reuses DOM elements when possible (updates position instead of recreating)
 * - Uses CSS classes for better performance
 * - Lazy loads mapbox-gl
 * - Handles cleanup automatically
 */
export function useClickMarker({ map, mapLoaded, getMap }: UseClickMarkerOptions) {
  const markerRef = useRef<any>(null);
  const markerElementRef = useRef<HTMLDivElement | null>(null);
  const mapboxRef = useRef<any>(null);

  // Ensure CSS styles are injected (only once)
  const ensureStyles = useCallback(() => {
    const styleId = 'click-marker-styles';
    if (document.head.querySelector(`#${styleId}`)) {
      return; // Styles already exist
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .click-marker {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #ffffff;
        border: 2px solid rgba(0, 0, 0, 0.3);
        cursor: pointer;
        pointer-events: none;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .click-marker-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #000000;
        position: absolute;
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Create marker element (reused across calls)
  const createMarkerElement = useCallback((): HTMLDivElement => {
    if (markerElementRef.current) {
      return markerElementRef.current;
    }

    ensureStyles();

    const el = document.createElement('div');
    el.className = 'click-marker';

    const dot = document.createElement('div');
    dot.className = 'click-marker-dot';
    el.appendChild(dot);

    markerElementRef.current = el;
    return el;
  }, [ensureStyles]);

  // Set marker at coordinates
  const setMarker = useCallback(
    async (coordinates: Coordinates) => {
      // Get current map instance (use getter if provided, otherwise use prop)
      const currentMap = getMap ? getMap() : map;
      
      if (!currentMap || !mapLoaded || (currentMap as any).removed) {
        return;
      }

      try {
        // Lazy load mapbox-gl
        if (!mapboxRef.current) {
          const mapbox = await import('mapbox-gl');
          mapboxRef.current = mapbox;
        }

        const mapbox = mapboxRef.current;
        const mapboxMap = currentMap as any;

        // Reuse existing marker if it exists, just update position
        if (markerRef.current) {
          markerRef.current.setLngLat([coordinates.lng, coordinates.lat]);
          return;
        }

        // Create new marker with reused element
        const element = createMarkerElement();
        markerRef.current = new mapbox.Marker({
          element: element,
          anchor: 'center',
        })
          .setLngLat([coordinates.lng, coordinates.lat])
          .addTo(mapboxMap);
      } catch (err) {
        console.error('[useClickMarker] Error setting marker:', err);
      }
    },
    [map, mapLoaded, createMarkerElement, getMap]
  );

  // Remove marker
  const removeMarker = useCallback(() => {
    if (markerRef.current) {
      try {
        markerRef.current.remove();
      } catch (err) {
        // Ignore cleanup errors
      }
      markerRef.current = null;
    }
    // Keep element in ref for reuse, just remove from map
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    removeMarker();
    markerElementRef.current = null;
    mapboxRef.current = null;
  }, [removeMarker]);

  return {
    setMarker,
    removeMarker,
    cleanup,
  };
}
