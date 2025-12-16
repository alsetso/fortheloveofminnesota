'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { UseMapReturn } from '../types';
import { initializeMap, destroyMap } from '../controllers/mapInitializationController';
import { registerMapEvents, unregisterMapEvents } from '../controllers/mapEventsController';
import { trackMapInfo } from '../controllers/mapInfoController';
import { createMarkerController } from '../controllers/markerController';
import { createPopupController } from '../controllers/popupController';
import { changeMapStyle } from '../controllers/styleController';
import { loadMapboxGL } from '../utils/mapboxLoader';
import { MAP_CONFIG } from '../config';

interface UseMapControllerProps {
  mapContainer: React.RefObject<HTMLDivElement | null>;
  onMapReady?: (map: import('mapbox-gl').Map) => void;
  onMapClick?: (coordinates: { lat: number; lng: number }, mapInstance?: import('mapbox-gl').Map | null) => void;
}

/**
 * Minimal orchestrator hook that delegates all map logic to controllers
 */
export function useMapController({ mapContainer, onMapReady, onMapClick }: UseMapControllerProps): UseMapReturn {
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const markerControllerRef = useRef<ReturnType<typeof createMarkerController> | null>(null);
  const popupControllerRef = useRef<ReturnType<typeof createPopupController> | null>(null);
  const eventHandlersRef = useRef<ReturnType<typeof registerMapEvents> | null>(null);
  const infoSubscriptionRef = useRef<ReturnType<typeof trackMapInfo> | null>(null);
  const mapInitializedRef = useRef(false);
  
  const onMapReadyRef = useRef(onMapReady);
  const onMapClickRef = useRef(onMapClick);

  // Keep callback refs in sync
  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [userLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapInfo, setMapInfo] = useState({
    zoom: 5,
    center: { lat: 46.7296, lng: -94.6859 },
    cursor: { lat: 0, lng: 0 },
    bearing: 0,
    pitch: 0
  });

  // Initialize map and wire controllers
  useEffect(() => {
    // Prevent multiple initializations
    if (!mapContainer.current || map.current || mapInitializedRef.current) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    // Mark as initializing to prevent loops
    mapInitializedRef.current = true;

    const setupMap = async () => {
      try {
        // Load Mapbox GL
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) {
          mapInitializedRef.current = false;
          return;
        }

        // Initialize map via controller
        const mapInstance = await initializeMap({
          container: mapContainer.current,
          onLoad: () => {
            setMapLoaded(true);
            onMapReadyRef.current?.(mapInstance);
          }
        });

        map.current = mapInstance;

        // Create controllers with map instance
        markerControllerRef.current = createMarkerController(mapInstance);
        popupControllerRef.current = createPopupController(mapInstance);

        // Register event handlers via controller
        eventHandlersRef.current = registerMapEvents({
          map: mapInstance,
          markers: markerControllerRef.current.getMarkers(),
          onMapClick: (coordinates) => {
            onMapClickRef.current?.(coordinates, mapInstance);
          }
        });

        // Start tracking map info via controller
        infoSubscriptionRef.current = trackMapInfo({
          map: mapInstance,
          onUpdate: (info) => {
            setMapInfo(info);
          }
        });
      } catch (err) {
        console.error('Error initializing map:', err);
        mapInitializedRef.current = false;
      }
    };

    setupMap();

    // Cleanup on unmount
    return () => {
      if (eventHandlersRef.current) {
        unregisterMapEvents(eventHandlersRef.current);
        eventHandlersRef.current = null;
      }
      if (infoSubscriptionRef.current) {
        infoSubscriptionRef.current.unsubscribe();
        infoSubscriptionRef.current = null;
      }
      if (markerControllerRef.current) {
        markerControllerRef.current.clearAllMarkers();
        markerControllerRef.current = null;
      }
      popupControllerRef.current = null;
      if (map.current) {
        destroyMap(map.current);
        map.current = null;
        setMapLoaded(false);
      }
      mapInitializedRef.current = false;
    };
  }, [mapContainer]);

  // Marker operations - delegated to markerController
  const addMarker = useCallback(async (
    id: string,
    coordinates: { lat: number; lng: number },
    options: { color?: string; element?: HTMLElement; popupContent?: string } = {}
  ) => {
    if (!map.current || !markerControllerRef.current || !popupControllerRef.current) return;

    await markerControllerRef.current.createMarker(id, coordinates, {
      ...options,
      onPopupCreate: (popup, markerId) => {
        popupControllerRef.current?.setupPopupListeners(popup, markerId);
      }
    });
  }, []);

  const removeMarker = useCallback((id: string) => {
    if (!markerControllerRef.current) return;
    markerControllerRef.current.removeMarker(id);
  }, []);

  const clearMarkers = useCallback(() => {
    if (!markerControllerRef.current) return;
    markerControllerRef.current.clearAllMarkers();
  }, []);

  const updateMarkerPopup = useCallback((id: string, popupContent: string) => {
    if (!markerControllerRef.current || !popupControllerRef.current) return;

    const marker = markerControllerRef.current.getMarker(id);
    if (!marker) return;

    popupControllerRef.current.updatePopupContent(marker, popupContent, id);
  }, []);

  // Navigation operations
  const flyTo = useCallback((coordinates: { lat: number; lng: number }, zoom?: number) => {
    if (!map.current) return;
    map.current.flyTo({
      center: [coordinates.lng, coordinates.lat],
      zoom: zoom || MAP_CONFIG.ADDRESS_ZOOM,
      duration: 1000,
    });
  }, []);

  // Style operations - delegated to styleController
  const handleChangeMapStyle = useCallback(async (styleKey: keyof typeof MAP_CONFIG.STRATEGIC_STYLES): Promise<void> => {
    if (!map.current) {
      throw new Error('Map not initialized');
    }
    return changeMapStyle(map.current, styleKey);
  }, []);

  // Stub functions for compatibility (maintain existing API)
  const triggerGeolocate = useCallback(() => {
    // GeolocateControl removed - function kept for compatibility
  }, []);

  const stopGeolocate = useCallback(() => {
    // GeolocateControl removed - function kept for compatibility
  }, []);

  const addAddressPin = useCallback(() => {}, []);
  const removeAddressPin = useCallback(() => {}, []);
  const addUserMarker = useCallback(() => {}, []);
  const removeUserMarker = useCallback(() => {}, []);
  const lockInteractions = useCallback(() => {}, []);
  const unlockInteractions = useCallback(() => {}, []);
  const setCursorStyle = useCallback(() => {}, []);
  const followUser = useCallback(() => {}, []);
  const updateUserLocation = useCallback(() => {}, []);
  const findUserLocation = useCallback(() => {}, []);
  const zoomToMinnesota = useCallback(() => {}, []);
  const flyFromGlobeToMinnesota = useCallback(() => {}, []);
  const zoomToStrategic = useCallback(() => {}, []);

  return {
    mapLoaded,
    userLocation,
    isTracking: false,
    isInteractionsLocked: false,
    mapInfo,
    findUserLocation,
    addAddressPin,
    removeAddressPin,
    addUserMarker,
    removeUserMarker,
    lockInteractions,
    unlockInteractions,
    setCursorStyle,
    flyTo,
    followUser,
    updateUserLocation,
    triggerGeolocate,
    stopGeolocate,
    addMarker,
    removeMarker,
    clearMarkers,
    updateMarkerPopup,
    zoomToMinnesota,
    flyFromGlobeToMinnesota,
    zoomToStrategic,
    changeMapStyle: handleChangeMapStyle,
    map: map.current,
  };
}

