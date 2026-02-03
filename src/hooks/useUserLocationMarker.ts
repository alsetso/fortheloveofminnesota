import { useEffect, useRef, useState, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { watchGeolocation, isGeolocationSupported } from '@/utils/geolocation';

interface UseUserLocationMarkerOptions {
  map: MapboxMapInstance | null;
  enabled: boolean;
}

/**
 * Hook for displaying user location on map with iOS Maps-style blue dot
 * Uses watchPosition for continuous tracking
 */
export function useUserLocationMarker({ map, enabled }: UseUserLocationMarkerOptions) {
  const markerRef = useRef<any>(null);
  const mapboxRef = useRef<any>(null);
  const stopWatchingRef = useRef<(() => void) | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Create iOS Maps-style blue user location marker
  const createUserLocationMarker = useCallback(async (coordinates: { lat: number; lng: number }) => {
    if (!map || (map as any).removed) return;

    try {
      // Lazy load mapbox
      if (!mapboxRef.current) {
        const mapbox = await import('mapbox-gl');
        mapboxRef.current = mapbox;
      }

      const mapbox = mapboxRef.current;
      const mapboxMap = map as any;

      // Remove existing marker
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      // Create iOS Maps-style blue dot marker
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      
      // Outer pulsing circle (iOS Maps style)
      const outerCircle = document.createElement('div');
      outerCircle.className = 'user-location-outer';
      outerCircle.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: rgba(0, 122, 255, 0.2);
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation: pulse-blue 2s ease-in-out infinite;
      `;

      // Inner blue circle
      const innerCircle = document.createElement('div');
      innerCircle.className = 'user-location-inner';
      innerCircle.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #007AFF;
        border: 2px solid #ffffff;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      `;

      el.appendChild(outerCircle);
      el.appendChild(innerCircle);
      
      el.style.cssText = `
        width: 20px;
        height: 20px;
        position: relative;
        cursor: pointer;
        pointer-events: none;
      `;

      // Add pulsing animation styles if not already added
      const styleId = 'user-location-marker-style';
      if (!document.head.querySelector(`#${styleId}`)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes pulse-blue {
            0%, 100% { 
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.2;
            }
            50% { 
              transform: translate(-50%, -50%) scale(1.5);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Create marker with 'center' anchor (blue dot centered on location)
      const marker = new mapbox.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(mapboxMap);

      markerRef.current = marker;
    } catch (err) {
      console.error('[useUserLocationMarker] Error creating marker:', err);
    }
  }, [map]);

  // Watch user location when enabled
  useEffect(() => {
    if (!enabled || !map || !isGeolocationSupported()) {
      // Stop watching and remove marker
      if (stopWatchingRef.current) {
        stopWatchingRef.current();
        stopWatchingRef.current = null;
      }
      setIsTracking(false);
      setUserLocation(null);
      
      // Remove marker
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {
          // Ignore cleanup errors
        }
        markerRef.current = null;
      }
      return;
    }

    // Start watching position
    const result = watchGeolocation(
      (position) => {
        const coords = { lat: position.latitude, lng: position.longitude };
        setUserLocation(coords);
        setIsTracking(true);
        createUserLocationMarker(coords);
      },
      (error) => {
        console.error('[useUserLocationMarker] Geolocation error:', error);
        setIsTracking(false);
        // Keep marker at last known position
      },
      {
        enableHighAccuracy: true, // Use GPS for best accuracy
        timeout: 10000,
        maximumAge: 5000, // Allow 5 second cache
      }
    );

    // Store stop function for cleanup
    stopWatchingRef.current = result.stop;

    return () => {
      if (stopWatchingRef.current) {
        stopWatchingRef.current();
        stopWatchingRef.current = null;
      }
      setIsTracking(false);
      
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch {
          // Ignore cleanup errors
        }
        markerRef.current = null;
      }
    };
  }, [enabled, map, createUserLocationMarker]);

  // Update marker position when location changes
  useEffect(() => {
    if (userLocation && markerRef.current) {
      try {
        markerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      } catch {
        // Ignore update errors
      }
    }
  }, [userLocation]);

  return {
    userLocation,
    isTracking,
  };
}
