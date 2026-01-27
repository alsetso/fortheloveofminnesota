'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import { useClickMarker } from '@/hooks/useClickMarker';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { MapData } from '@/types/map';

interface LocationSelectPopup {
  isOpen: boolean;
  lat: number;
  lng: number;
  address: string | null;
  mapMeta: Record<string, any> | null;
}

interface UseMapClickHandlerOptions {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  mapData: MapData | null;
  account: {
    id: string;
    plan: string | null;
    subscription_status: string | null;
  } | null;
  isOwner: boolean;
  userRole: 'owner' | 'manager' | 'editor' | null;
  checkPermission: (action: 'pins' | 'areas' | 'posts' | 'clicks') => boolean | undefined;
}

/**
 * Hook to handle all map click interactions
 * Consolidates click detection, reverse geocoding, marker management, and popup state
 * 
 * Senior dev improvements:
 * - Stable handler reference stored in ref to prevent re-registration issues
 * - Debouncing to prevent rapid click conflicts
 * - Marker functions stored in refs for stability
 * - Single effect registration with minimal dependencies
 * - Proper cleanup with stable function references
 */
export function useMapClickHandler({
  map,
  mapLoaded,
  mapData,
  account,
  isOwner,
  userRole,
  checkPermission,
}: UseMapClickHandlerOptions) {
  const router = useRouter();
  const mapInstanceRef = useRef(map);
  
  // Store frequently changing values in refs to avoid re-registering click handler
  const mapDataRef = useRef(mapData);
  const accountRef = useRef(account);
  const checkPermissionRef = useRef(checkPermission);
  
  // Update refs when values change
  useEffect(() => {
    mapInstanceRef.current = map;
  }, [map]);
  
  useEffect(() => {
    mapDataRef.current = mapData;
  }, [mapData]);
  
  useEffect(() => {
    accountRef.current = account;
  }, [account]);
  
  useEffect(() => {
    checkPermissionRef.current = checkPermission;
  }, [checkPermission]);

  // Location select popup state
  const [locationSelectPopup, setLocationSelectPopup] = useState<LocationSelectPopup>({
    isOpen: false,
    lat: 0,
    lng: 0,
    address: null,
    mapMeta: null,
  });

  // State for clicked coordinates (triggers reverse geocode hook)
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const { address: reverseGeocodeAddress } = useReverseGeocode(
    clickedCoordinates?.lat || null,
    clickedCoordinates?.lng || null
  );

  // Click marker hook - store functions in refs for stability
  const clickMarkerHook = useClickMarker({
    map: mapInstanceRef.current,
    mapLoaded,
    getMap: () => mapInstanceRef.current,
  });
  const setClickMarkerRef = useRef(clickMarkerHook.setMarker);
  const removeClickMarkerRef = useRef(clickMarkerHook.removeMarker);
  const cleanupClickMarkerRef = useRef(clickMarkerHook.cleanup);
  
  // Update refs when hook returns change
  useEffect(() => {
    setClickMarkerRef.current = clickMarkerHook.setMarker;
    removeClickMarkerRef.current = clickMarkerHook.removeMarker;
    cleanupClickMarkerRef.current = clickMarkerHook.cleanup;
  }, [clickMarkerHook.setMarker, clickMarkerHook.removeMarker, clickMarkerHook.cleanup]);

  // Update location popup address when reverse geocode completes
  useEffect(() => {
    if (locationSelectPopup.isOpen && reverseGeocodeAddress !== null) {
      setLocationSelectPopup((prev) => ({
        ...prev,
        address: reverseGeocodeAddress,
      }));
    }
  }, [reverseGeocodeAddress, locationSelectPopup.isOpen]);

  // Close popup handler - removes marker when explicitly closing
  const closePopup = useCallback(() => {
    removeClickMarkerRef.current();
    setLocationSelectPopup({
      isOpen: false,
      lat: 0,
      lng: 0,
      address: null,
      mapMeta: null,
    });
    setClickedCoordinates(null);
  }, []);

  // Store handler function in ref to maintain stable reference
  const handleMapClickRef = useRef<((e: any) => Promise<void>) | null>(null);
  
  // Debounce rapid clicks to prevent handler conflicts
  const lastClickTimeRef = useRef<number>(0);
  const CLICK_DEBOUNCE_MS = 100; // Minimum time between clicks

  // Create stable click handler function - only create once
  useEffect(() => {
    if (!mapLoaded) return;
    
    const mapboxMap = mapInstanceRef.current as any;
    if (!mapboxMap || mapboxMap.removed) return;

    const handleMapClick = async (e: any) => {
      // Debounce rapid clicks
      const now = Date.now();
      if (now - lastClickTimeRef.current < CLICK_DEBOUNCE_MS) {
        return;
      }
      lastClickTimeRef.current = now;

      const map = mapInstanceRef.current as any;
      if (!map || map.removed) return;
      
      // Get current values from refs
      const currentMapData = mapDataRef.current;
      const currentAccount = accountRef.current;
      const currentCheckPermission = checkPermissionRef.current;
      
      // Check if click hit a pin or area layer - those have their own handlers
      const pinOrAreaLayers = ['map-pins-points', 'map-pins-point-label', 'map-areas-fill', 'map-areas-outline'];
      const hitRadius = 20;
      const box: [[number, number], [number, number]] = [
        [e.point.x - hitRadius, e.point.y - hitRadius],
        [e.point.x + hitRadius, e.point.y + hitRadius]
      ];
      
      let pinOrAreaFeatures: any[] = [];
      try {
        const existingLayers = pinOrAreaLayers.filter(layerId => {
          try {
            return map.getLayer(layerId) !== undefined;
          } catch {
            return false;
          }
        });
        
        if (existingLayers.length > 0) {
          pinOrAreaFeatures = map.queryRenderedFeatures(box, {
            layers: existingLayers,
          });
        }
      } catch (queryError) {
        // Silently continue if query fails
      }
      
      // If clicked on a pin or area, remove marker and don't show location popup
      if (pinOrAreaFeatures.length > 0) {
        removeClickMarkerRef.current();
        return;
      }
      
      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;
      
      // Always set click marker on map click (white circle with black dot)
      // This replaces any previous marker - marker updates even if popup is already open
      setClickMarkerRef.current({ lat, lng });

      // Always fly to the clicked location (even if popup is already open)
      const mapboxMap = mapInstanceRef.current as any;
      if (mapboxMap && typeof mapboxMap.flyTo === 'function') {
        const currentZoom = typeof mapboxMap.getZoom === 'function' ? mapboxMap.getZoom() : 10;
        const targetZoom = Math.max(currentZoom + 2, 15);
        
        mapboxMap.flyTo({
          center: [lng, lat],
          zoom: targetZoom,
          duration: 1000,
          essential: true,
        });
      }

      // Check if click is within Minnesota bounds
      if (!MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
        console.warn('[MapPage] Click outside Minnesota bounds:', { lat, lng });
        // Update popup even if outside bounds (marker already shown)
        setLocationSelectPopup((prev) => ({
          isOpen: prev.isOpen,
          lat,
          lng,
          address: null,
          mapMeta: null,
        }));
        return;
      }

      // Only show location popup if map settings allow clicks
      const allowClicks = currentMapData?.settings?.collaboration?.allow_clicks ?? false;
      if (!allowClicks) {
        // Update popup even if clicks disabled (marker already shown)
        setLocationSelectPopup((prev) => ({
          isOpen: prev.isOpen,
          lat,
          lng,
          address: null,
          mapMeta: null,
        }));
        return;
      }

      // Check clickability permission
      if (currentMapData && currentAccount && currentCheckPermission) {
        const allowed = currentCheckPermission('clicks');
        if (allowed === false) {
          // Update popup even if permission denied (marker already shown)
          setLocationSelectPopup((prev) => ({
            isOpen: prev.isOpen,
            lat,
            lng,
            address: null,
            mapMeta: null,
          }));
          return;
        }
      }
      
      // Trigger reverse geocode hook (this will update the popup address when it completes)
      setClickedCoordinates({ lat, lng });
      
      // Capture mapbox feature at click point for map_meta
      let mapMeta: Record<string, any> | null = null;
      try {
        const point = map.project([lng, lat]);
        const result = queryFeatureAtPoint(map, point, 'labels-first', false);
        if (result) {
          const extractedFeature = 'feature' in result ? result.feature : result;
          if (extractedFeature && 'layerId' in extractedFeature) {
            mapMeta = {
              location: null,
              feature: {
                layerId: extractedFeature.layerId,
                sourceLayer: extractedFeature.sourceLayer,
                category: extractedFeature.category,
                name: extractedFeature.name,
                label: extractedFeature.label,
                icon: extractedFeature.icon,
                properties: extractedFeature.properties,
                showIntelligence: extractedFeature.showIntelligence,
              },
            };
          }
        }
      } catch (err) {
        console.debug('[MapPage] Error capturing map feature:', err);
      }
      
      // Update location select popup with new coordinates (even if already open)
      // This ensures the popup updates on subsequent clicks
      setLocationSelectPopup((prev) => ({
        isOpen: true,
        lat,
        lng,
        address: null, // Will be updated when reverse geocode completes
        mapMeta: mapMeta,
      }));
    };

    // Store handler in ref for cleanup
    handleMapClickRef.current = handleMapClick;
    mapboxMap.on('click', handleMapClick);
    
    return () => {
      const map = mapInstanceRef.current as any;
      if (map && !map.removed && handleMapClickRef.current) {
        map.off('click', handleMapClickRef.current);
      }
      handleMapClickRef.current = null;
    };
  }, [mapLoaded]);

  return {
    locationSelectPopup,
    closePopup,
    // Expose address for popup display
    popupAddress: locationSelectPopup.address || reverseGeocodeAddress,
  };
}
