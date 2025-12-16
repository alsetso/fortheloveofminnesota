'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { Map as MapboxMap, Marker, Popup, MapMouseEvent } from 'mapbox-gl';
import { loadMapboxGL } from '../utils/mapboxLoader';
import { MAP_CONFIG } from '../config';
import { validateMapConfig, validateCoordinateObject } from '../utils/mapValidation';

export interface UseMapProps {
  mapContainer: React.RefObject<HTMLDivElement | null>;
  onMapReady?: (map: MapboxMap) => void;
  onMapClick?: (coordinates: { lat: number; lng: number }, mapInstance?: MapboxMap | null) => void;
}

export interface UseMapReturn {
  map: MapboxMap | null;
  mapLoaded: boolean;
  mapInfo: {
    zoom: number;
    center: { lat: number; lng: number };
    cursor: { lat: number; lng: number };
    bearing: number;
    pitch: number;
  };
  addMarker: (id: string, coordinates: { lat: number; lng: number }, options?: { color?: string; element?: HTMLElement; popupContent?: string }) => Promise<void>;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  updateMarkerPopup: (id: string, popupContent: string) => void;
  flyTo: (coordinates: { lat: number; lng: number }, zoom?: number) => void;
  changeMapStyle: (styleKey: 'streets' | 'satellite' | 'light' | 'dark' | 'outdoors') => Promise<void>;
  triggerGeolocate: () => void;
}

/**
 * Consolidated map hook with all essential functionality
 */
export function useMap({ mapContainer, onMapReady, onMapClick }: UseMapProps): UseMapReturn {
  const map = useRef<MapboxMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const mapInitializedRef = useRef(false);
  
  const onMapReadyRef = useRef(onMapReady);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInfo, setMapInfo] = useState({
    zoom: 5,
    center: { lat: 46.7296, lng: -94.6859 },
    cursor: { lat: 0, lng: 0 },
    bearing: 0,
    pitch: 0,
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current || mapInitializedRef.current) return;

    const configValidation = validateMapConfig();
    if (!configValidation.valid) {
      console.error('Map config invalid:', configValidation.error);
      return;
    }

    mapInitializedRef.current = true;

    const setupMap = async () => {
      try {
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) {
          mapInitializedRef.current = false;
          return;
        }

        const container = mapContainer.current;

        // Wait for container dimensions
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          await new Promise(resolve => {
            const checkDimensions = () => {
              if (container.offsetWidth > 0 && container.offsetHeight > 0) {
                resolve(undefined);
              } else {
                requestAnimationFrame(checkDimensions);
              }
            };
            requestAnimationFrame(checkDimensions);
          });
        }

        // Create map instance
        const mapInstance = new mapbox.Map({
          container,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        let loadHandlerCalled = false;
        mapInstance.on('load', () => {
          if (loadHandlerCalled) return;
          loadHandlerCalled = true;
          mapInstance.resize();
          setMapLoaded(true);
          onMapReadyRef.current?.(mapInstance);
        });

        // Track map info
        const updateMapInfo = () => {
          if (!mapInstance || mapInstance.removed) return;
          const center = mapInstance.getCenter();
          setMapInfo({
            zoom: mapInstance.getZoom(),
            center: { lat: center.lat, lng: center.lng },
            cursor: { lat: 0, lng: 0 },
            bearing: mapInstance.getBearing(),
            pitch: mapInstance.getPitch(),
          });
        };

        mapInstance.on('zoom', updateMapInfo);
        mapInstance.on('move', updateMapInfo);
        mapInstance.on('rotate', updateMapInfo);
        mapInstance.on('pitch', updateMapInfo);

        // Handle map clicks
        const handleClick = (e: MapMouseEvent) => {
          // Check if click is on marker or popup
          const target = e.originalEvent?.target as HTMLElement;
          if (target?.closest('.mapboxgl-marker') || target?.closest('.mapboxgl-popup')) {
            return;
          }
          onMapClickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }, mapInstance);
        };

        mapInstance.on('click', handleClick);

        map.current = mapInstance;

        // Cleanup
        return () => {
          mapInstance.off('zoom', updateMapInfo);
          mapInstance.off('move', updateMapInfo);
          mapInstance.off('rotate', updateMapInfo);
          mapInstance.off('pitch', updateMapInfo);
          mapInstance.off('click', handleClick);
        };
      } catch (err) {
        console.error('Error initializing map:', err);
        mapInitializedRef.current = false;
      }
    };

    setupMap();

    return () => {
      // Clear all markers
      markers.current.forEach(marker => marker.remove());
      markers.current.clear();

      // Destroy map
      if (map.current && !map.current.removed) {
        map.current.remove();
        map.current = null;
      }
      setMapLoaded(false);
      mapInitializedRef.current = false;
    };
  }, [mapContainer]);

  // Marker operations
  const addMarker = useCallback(async (
    id: string,
    coordinates: { lat: number; lng: number },
    options: { color?: string; element?: HTMLElement; popupContent?: string } = {}
  ) => {
    if (!map.current || map.current.removed || !validateCoordinateObject(coordinates)) return;

    try {
      const mapbox = await loadMapboxGL();

      // Remove existing marker
      const existingMarker = markers.current.get(id);
      if (existingMarker) {
        existingMarker.remove();
        markers.current.delete(id);
      }

      // Create marker options
      const markerOptions: { anchor: string; element?: HTMLElement; color?: string } = { anchor: 'center' };
      if (options.element) {
        markerOptions.element = options.element;
      } else if (options.color) {
        markerOptions.color = options.color;
      }

      // Create marker
      const marker = new mapbox.Marker(markerOptions).setLngLat([coordinates.lng, coordinates.lat]);

      // Add popup if provided
      if (options.popupContent) {
        const popup = new mapbox.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false,
          className: 'pin-popup-container',
          maxWidth: '300px',
        }).setHTML(options.popupContent);
        marker.setPopup(popup);
      }

      marker.addTo(map.current);
      markers.current.set(id, marker);
    } catch (err) {
      console.error('Error adding marker:', err);
    }
  }, []);

  const removeMarker = useCallback((id: string) => {
    const marker = markers.current.get(id);
    if (marker) {
      marker.remove();
      markers.current.delete(id);
    }
  }, []);

  const clearMarkers = useCallback(() => {
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();
  }, []);

  const updateMarkerPopup = useCallback((id: string, popupContent: string) => {
    const marker = markers.current.get(id);
    if (!marker) return;

    const popup = marker.getPopup();
    if (popup) {
      popup.setHTML(popupContent);
    } else {
      const mapbox = await import('mapbox-gl');
      const newPopup = new mapbox.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
        className: 'pin-popup-container',
        maxWidth: '300px',
      }).setHTML(popupContent);
      marker.setPopup(newPopup);
    }
  }, []);

  // Navigation
  const flyTo = useCallback((coordinates: { lat: number; lng: number }, zoom?: number) => {
    if (!map.current || map.current.removed) return;
    map.current.flyTo({
      center: [coordinates.lng, coordinates.lat],
      zoom: zoom || MAP_CONFIG.ADDRESS_ZOOM,
      duration: 1000,
    });
  }, []);

  // Style changes
  const changeMapStyle = useCallback(async (styleKey: 'streets' | 'satellite' | 'light' | 'dark' | 'outdoors') => {
    if (!map.current || map.current.removed) {
      throw new Error('Map not initialized');
    }

    const styleUrl = MAP_CONFIG.STRATEGIC_STYLES[styleKey];
    if (!styleUrl) {
      throw new Error(`Invalid style key: ${styleKey}`);
    }

    const currentCenter = map.current.getCenter();
    const currentZoom = map.current.getZoom();

    return new Promise<void>((resolve, reject) => {
      try {
        map.current!.setStyle(styleUrl);
        map.current!.once('styledata', () => {
          if (map.current && !map.current.removed) {
            map.current.setCenter(currentCenter);
            map.current.setZoom(currentZoom);
            resolve();
          }
        });
        map.current!.once('error', (e) => {
          reject(new Error(`Failed to load style: ${e.error?.message || 'Unknown error'}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  // Stub for compatibility
  const triggerGeolocate = useCallback(() => {
    // Geolocate functionality removed - kept for API compatibility
  }, []);

  return {
    map: map.current,
    mapLoaded,
    mapInfo,
    addMarker,
    removeMarker,
    clearMarkers,
    updateMarkerPopup,
    flyTo,
    changeMapStyle,
    triggerGeolocate,
  };
}
