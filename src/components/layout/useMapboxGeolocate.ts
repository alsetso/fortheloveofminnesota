import { useEffect, useRef, useCallback } from 'react';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface UseMapboxGeolocateOptions {
  map: MapboxMapInstance | null;
  enabled: boolean;
  buttonEl: HTMLButtonElement | null;
}

/**
 * Uses Mapbox's built-in GeolocateControl for user location tracking
 * Only adds control to map when enabled (prevents auto permission prompt)
 */
export function useMapboxGeolocate({ map, enabled, buttonEl }: UseMapboxGeolocateOptions) {
  const isEnabledRef = useRef(false);
  const controlRef = useRef<any>(null);
  const mapRef = useRef<MapboxMapInstance | null>(null);
  
  // Keep map ref updated
  useEffect(() => {
    mapRef.current = map;
  }, [map]);
  
  // Helper to get or create control
  const getOrCreateControl = useCallback(async () => {
    if (controlRef.current) return controlRef.current;
    if (!mapRef.current || (mapRef.current as any).removed) return null;

    const mapboxgl = await import('mapbox-gl');
    const control = new mapboxgl.default.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      },
      trackUserLocation: true, // Uses watchPosition under the hood
      showUserHeading: true,
      showAccuracyCircle: true,
      fitBoundsOptions: { maxZoom: 15 },
    });

    // Hide the default button - we use our custom button instead
    control.on('add', () => {
      const container = (control as any)._container;
      if (container) {
        container.style.display = 'none';
      }
    });

    controlRef.current = control;
    return control;
  }, []);

  useEffect(() => {
    console.log('[useMapboxGeolocate] useEffect - map:', map, 'buttonEl:', buttonEl, 'enabled:', enabled);
    
    if (!map || (map as any).removed) {
      console.log('[useMapboxGeolocate] No map or map removed, cleaning up');
      // Cleanup if map removed
      if (controlRef.current && map && (map as any).hasControl) {
        try {
          const mapboxMap = map as any;
          if (mapboxMap.hasControl(controlRef.current)) {
            mapboxMap.removeControl(controlRef.current);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      controlRef.current = null;
      isEnabledRef.current = false;
      return;
    }
    
    // Don't require buttonEl for the hook to work - we can still trigger without it
    if (!buttonEl) {
      console.log('[useMapboxGeolocate] buttonEl not available yet, skipping enable/disable');
      return;
    }

    const mapboxMap = map as any;

    const enable = async () => {
      const control = await getOrCreateControl();
      if (!control || !mapboxMap.hasControl) return;
      
      if (!mapboxMap.hasControl(control)) {
        mapboxMap.addControl(control, 'top-right');
      }

      isEnabledRef.current = true;
      buttonEl.setAttribute('aria-pressed', 'true');
      buttonEl.classList.add('bg-blue-50', 'border-blue-300');
      buttonEl.classList.remove('bg-white/95', 'border-gray-200');

      // Trigger the permission prompt + first fix + fly to location
      try {
        control.trigger();
      } catch {
        // Ignore if already triggered or error
      }
    };

    const disable = () => {
      if (!controlRef.current || !mapboxMap.hasControl) return;
      
      if (mapboxMap.hasControl(controlRef.current)) {
        mapboxMap.removeControl(controlRef.current);
      }

      isEnabledRef.current = false;
      buttonEl.setAttribute('aria-pressed', 'false');
      buttonEl.classList.remove('bg-blue-50', 'border-blue-300');
      buttonEl.classList.add('bg-white/95', 'border-gray-200');
    };

    // Handle enable/disable based on prop
    if (enabled && !isEnabledRef.current) {
      enable();
    } else if (!enabled && isEnabledRef.current) {
      disable();
    }

    return () => {
      if (controlRef.current && mapboxMap.hasControl) {
        try {
          if (mapboxMap.hasControl(controlRef.current)) {
            mapboxMap.removeControl(controlRef.current);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      isEnabledRef.current = false;
    };
  }, [map, enabled, buttonEl, getOrCreateControl]);
  
  // Return trigger function for manual triggering
  const trigger = useCallback(async () => {
    console.log('[useMapboxGeolocate] trigger() called');
    const currentMap = mapRef.current;
    console.log('[useMapboxGeolocate] currentMap:', currentMap);
    console.log('[useMapboxGeolocate] currentMap.removed:', (currentMap as any)?.removed);
    
    if (!currentMap || (currentMap as any).removed) {
      console.warn('[useMapboxGeolocate] No valid map instance');
      return;
    }
    
    const mapboxMap = currentMap as any;
    console.log('[useMapboxGeolocate] mapboxMap.hasControl:', mapboxMap.hasControl);
    
    const control = await getOrCreateControl();
    console.log('[useMapboxGeolocate] control:', control);
    
    if (!control) {
      console.warn('[useMapboxGeolocate] Failed to get or create control');
      return;
    }
    
    if (!mapboxMap.hasControl) {
      console.warn('[useMapboxGeolocate] mapboxMap.hasControl is not a function');
      return;
    }

    // Add control if not already added
    const hasControl = mapboxMap.hasControl(control);
    console.log('[useMapboxGeolocate] hasControl:', hasControl);
    
    if (!hasControl) {
      console.log('[useMapboxGeolocate] Adding control to map...');
      mapboxMap.addControl(control, 'top-right');
    }

    // Trigger geolocation (requests permission and flies to location)
    try {
      console.log('[useMapboxGeolocate] Calling control.trigger()...');
      control.trigger();
      console.log('[useMapboxGeolocate] control.trigger() completed');
    } catch (err) {
      console.error('[useMapboxGeolocate] Error triggering:', err);
    }
  }, [getOrCreateControl]);
  
  console.log('[useMapboxGeolocate] Returning trigger function');
  return { trigger };
}
