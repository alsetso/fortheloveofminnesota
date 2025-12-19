'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface UrlMapStateOptions {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  /** Debounce delay for URL updates on map move (ms) */
  debounceMs?: number;
  /** Whether to sync map movements back to URL */
  syncMapMovement?: boolean;
  /** Callback when flying to coordinates from URL */
  onFlyToCoordinates?: (lat: number, lng: number, zoom?: number) => void;
  /** Callback when a pin should be selected from URL */
  onSelectPin?: (pinId: string) => void;
  /** Callback to open sidebar */
  onOpenSidebar?: () => void;
}

interface UrlMapState {
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  pinId: string | null;
}

/**
 * Hook for bidirectional URL <-> Map state synchronization.
 * 
 * Supports:
 * - `?lat=X&lng=Y` - Fly to coordinates
 * - `?lat=X&lng=Y&zoom=Z` - Fly to coordinates at specific zoom
 * - `?pin=ID` - Select and fly to a pin
 * 
 * URL is updated when:
 * - User moves the map (if syncMapMovement enabled)
 * - Pin is clicked (via updateUrlForPin)
 * - Location is selected (via updateUrlForLocation)
 */
export function useUrlMapState({
  map,
  mapLoaded,
  debounceMs = 1000,
  syncMapMovement = false,
  onFlyToCoordinates,
  onSelectPin,
  onOpenSidebar,
}: UrlMapStateOptions) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hasProcessedInitialParams = useRef(false);
  const moveEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavigatingRef = useRef(false);

  // Parse current URL state
  const getUrlState = useCallback((): UrlMapState => {
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const zoomParam = searchParams.get('zoom');
    const pinIdParam = searchParams.get('pin');

    return {
      lat: latParam ? parseFloat(latParam) : null,
      lng: lngParam ? parseFloat(lngParam) : null,
      zoom: zoomParam ? parseFloat(zoomParam) : null,
      pinId: pinIdParam,
    };
  }, [searchParams]);

  // Update URL without triggering navigation
  const updateUrl = useCallback((params: Partial<UrlMapState>, replace = true) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    
    if (params.lat !== undefined) {
      if (params.lat !== null && !isNaN(params.lat)) {
        url.searchParams.set('lat', params.lat.toFixed(5));
      } else {
        url.searchParams.delete('lat');
      }
    }
    
    if (params.lng !== undefined) {
      if (params.lng !== null && !isNaN(params.lng)) {
        url.searchParams.set('lng', params.lng.toFixed(5));
      } else {
        url.searchParams.delete('lng');
      }
    }
    
    if (params.zoom !== undefined) {
      if (params.zoom !== null && !isNaN(params.zoom)) {
        url.searchParams.set('zoom', params.zoom.toFixed(1));
      } else {
        url.searchParams.delete('zoom');
      }
    }
    
    if (params.pinId !== undefined) {
      if (params.pinId !== null) {
        url.searchParams.set('pin', params.pinId);
      } else {
        url.searchParams.delete('pin');
      }
    }

    const newUrl = url.pathname + url.search;
    if (replace) {
      window.history.replaceState({}, '', newUrl || '/');
    } else {
      window.history.pushState({}, '', newUrl || '/');
    }
  }, []);

  // Clear all map-related URL params
  const clearUrlParams = useCallback(() => {
    updateUrl({ lat: null, lng: null, zoom: null, pinId: null });
  }, [updateUrl]);

  // Update URL for a specific location
  const updateUrlForLocation = useCallback((lat: number, lng: number, zoom?: number) => {
    updateUrl({
      lat,
      lng,
      zoom: zoom ?? null,
      pinId: null, // Clear pin when selecting a location
    });
  }, [updateUrl]);

  // Update URL for a specific pin
  const updateUrlForPin = useCallback((pinId: string) => {
    // When selecting a pin, clear lat/lng since pin takes precedence
    updateUrl({
      lat: null,
      lng: null,
      zoom: null,
      pinId,
    });
  }, [updateUrl]);

  // Clear pin from URL (called when popup closes)
  const clearPinFromUrl = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('pin')) {
      url.searchParams.delete('pin');
      window.history.replaceState({}, '', url.pathname + url.search || '/');
    }
  }, []);

  // Get shareable URL for current map view
  const getShareableUrl = useCallback((includeZoom = true): string => {
    if (!map || !mapLoaded) return window.location.origin + pathname;

    const center = map.getCenter();
    const zoom = map.getZoom();
    
    const url = new URL(window.location.origin + pathname);
    url.searchParams.set('lat', center.lat.toFixed(5));
    url.searchParams.set('lng', center.lng.toFixed(5));
    if (includeZoom) {
      url.searchParams.set('zoom', zoom.toFixed(1));
    }
    
    return url.toString();
  }, [map, mapLoaded, pathname]);

  // Get shareable URL for a pin
  const getShareablePinUrl = useCallback((pinId: string): string => {
    const url = new URL(window.location.origin + pathname);
    url.searchParams.set('pin', pinId);
    return url.toString();
  }, [pathname]);

  // Process initial URL params on mount
  useEffect(() => {
    if (!mapLoaded || !map || hasProcessedInitialParams.current) return;

    const { lat, lng, zoom, pinId } = getUrlState();

    // Pin takes precedence
    if (pinId) {
      hasProcessedInitialParams.current = true;
      // Give PinsLayer time to load, then select the pin
      setTimeout(() => {
        if (onSelectPin) {
          onSelectPin(pinId);
        } else {
          window.dispatchEvent(new CustomEvent('select-pin-by-id', {
            detail: { pinId }
          }));
        }
      }, 1000);
      return;
    }

    // Handle coordinates
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      hasProcessedInitialParams.current = true;
      isNavigatingRef.current = true;

      const targetZoom = zoom !== null && !isNaN(zoom) ? zoom : 15;

      map.flyTo({
        center: [lng, lat],
        zoom: targetZoom,
        duration: 1500,
      });

      // Notify location sidebar after flight completes
      setTimeout(() => {
        isNavigatingRef.current = false;
        window.dispatchEvent(new CustomEvent('show-location', {
          detail: { lat, lng }
        }));
        onOpenSidebar?.();
        onFlyToCoordinates?.(lat, lng, targetZoom);
      }, 1600);
    } else {
      hasProcessedInitialParams.current = true;
    }
  }, [mapLoaded, map, getUrlState, onSelectPin, onFlyToCoordinates, onOpenSidebar]);

  // Sync map movements to URL (debounced)
  useEffect(() => {
    if (!map || !mapLoaded || !syncMapMovement) return;

    const handleMoveEnd = () => {
      // Don't update URL during programmatic navigation
      if (isNavigatingRef.current) return;

      // Clear any pending timeout
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }

      moveEndTimeoutRef.current = setTimeout(() => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        
        // Only update if there's no pin selected (pin URLs are more specific)
        const currentPinId = searchParams.get('pin');
        if (!currentPinId) {
          updateUrl({
            lat: center.lat,
            lng: center.lng,
            zoom,
          });
        }
      }, debounceMs);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
      map.off('moveend', handleMoveEnd);
    };
  }, [map, mapLoaded, syncMapMovement, debounceMs, updateUrl, searchParams]);

  return {
    // Current URL state
    urlState: getUrlState(),
    // URL manipulation
    updateUrl,
    updateUrlForLocation,
    updateUrlForPin,
    clearPinFromUrl,
    clearUrlParams,
    // Shareable URLs
    getShareableUrl,
    getShareablePinUrl,
    // Navigation state
    isNavigating: isNavigatingRef.current,
  };
}

