'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import { useClickMarker } from '@/hooks/useClickMarker';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { MapData } from '@/types/map';

/**
 * Click target priority order (highest to lowest):
 * 1. Pins (custom map pins)
 * 2. Areas (drawn areas)
 * 3. Mentions (user-generated content on live map)
 * 4. Map (empty space for location selection/pin creation)
 */
type ClickTarget = 'pin' | 'area' | 'mention' | 'map' | null;

interface ClickResult {
  target: ClickTarget;
  feature?: any;
  layerId?: string;
  entityId?: string;
}

interface UnifiedMapClickHandlerOptions {
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
  // Mode flags
  pinMode?: boolean;
  showAreaDrawModal?: boolean;
  // Callbacks
  onPinClick?: (pinId: string) => void;
  onAreaClick?: (areaId: string) => void;
  onMentionClick?: (mentionId: string) => void;
  onMapClick?: (coordinates: { lat: number; lng: number }, mapMeta: Record<string, any> | null) => void;
}

interface LocationSelectPopup {
  isOpen: boolean;
  lat: number;
  lng: number;
  address: string | null;
  mapMeta: Record<string, any> | null;
}

/**
 * Unified map click handler with priority-based target detection
 * 
 * Senior dev improvements:
 * - Single click handler registration (no conflicts)
 * - Clear priority system for overlapping layers
 * - Centralized permission checks
 * - Clean state management
 * - Handles all click types in one place
 */
export function useUnifiedMapClickHandler({
  map,
  mapLoaded,
  mapData,
  account,
  isOwner,
  userRole,
  checkPermission,
  pinMode = false,
  showAreaDrawModal = false,
  onPinClick,
  onAreaClick,
  onMentionClick,
  onMapClick,
}: UnifiedMapClickHandlerOptions) {
  const router = useRouter();
  const mapInstanceRef = useRef(map);
  
  // Store frequently changing values in refs
  const mapDataRef = useRef(mapData);
  const accountRef = useRef(account);
  const checkPermissionRef = useRef(checkPermission);
  const pinModeRef = useRef(pinMode);
  const showAreaDrawModalRef = useRef(showAreaDrawModal);
  const onPinClickRef = useRef(onPinClick);
  const onAreaClickRef = useRef(onAreaClick);
  const onMentionClickRef = useRef(onMentionClick);
  const onMapClickRef = useRef(onMapClick);
  
  // Update refs when values change
  useEffect(() => { mapInstanceRef.current = map; }, [map]);
  useEffect(() => { mapDataRef.current = mapData; }, [mapData]);
  useEffect(() => { accountRef.current = account; }, [account]);
  useEffect(() => { checkPermissionRef.current = checkPermission; }, [checkPermission]);
  useEffect(() => { pinModeRef.current = pinMode; }, [pinMode]);
  useEffect(() => { showAreaDrawModalRef.current = showAreaDrawModal; }, [showAreaDrawModal]);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);
  useEffect(() => { onAreaClickRef.current = onAreaClick; }, [onAreaClick]);
  useEffect(() => { onMentionClickRef.current = onMentionClick; }, [onMentionClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

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

  // Click marker hook
  const clickMarkerHook = useClickMarker({
    map: mapInstanceRef.current,
    mapLoaded,
    getMap: () => mapInstanceRef.current,
  });
  const setClickMarkerRef = useRef(clickMarkerHook.setMarker);
  const removeClickMarkerRef = useRef(clickMarkerHook.removeMarker);
  
  useEffect(() => {
    setClickMarkerRef.current = clickMarkerHook.setMarker;
    removeClickMarkerRef.current = clickMarkerHook.removeMarker;
  }, [clickMarkerHook.setMarker, clickMarkerHook.removeMarker]);

  // Update location popup address when reverse geocode completes
  useEffect(() => {
    if (locationSelectPopup.isOpen && reverseGeocodeAddress !== null) {
      setLocationSelectPopup((prev) => ({
        ...prev,
        address: reverseGeocodeAddress,
      }));
    }
  }, [reverseGeocodeAddress, locationSelectPopup.isOpen]);

  // Close popup handler
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

  // Debounce rapid clicks
  const lastClickTimeRef = useRef<number>(0);
  const CLICK_DEBOUNCE_MS = 100;
  
  // Track if we're currently processing a click to prevent overlapping handlers
  const isProcessingClickRef = useRef<boolean>(false);

  /**
   * Detect what was clicked with priority system
   * Uses larger hit radius on mobile for better touch target accuracy
   */
  const detectClickTarget = useCallback((mapboxMap: any, point: { x: number; y: number }): ClickResult => {
    // Use larger hit radius on mobile devices for better touch accuracy
    const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const hitRadius = isMobile ? 30 : 20; // Larger touch target on mobile
    const box: [[number, number], [number, number]] = [
      [point.x - hitRadius, point.y - hitRadius],
      [point.x + hitRadius, point.y + hitRadius]
    ];

    // Priority 1: Check for pins (custom map pins)
    const pinLayers = ['map-pins-points', 'map-pins-point-label'];
    try {
      const existingPinLayers = pinLayers.filter(layerId => {
        try {
          return mapboxMap.getLayer(layerId) !== undefined;
        } catch {
          return false;
        }
      });
      
      if (existingPinLayers.length > 0) {
        const pinFeatures = mapboxMap.queryRenderedFeatures(box, {
          layers: existingPinLayers,
        });
        
        if (pinFeatures.length > 0) {
          const feature = pinFeatures[0];
          return {
            target: 'pin',
            feature,
            layerId: feature.layer?.id,
            entityId: feature.properties?.id,
          };
        }
      }
    } catch {
      // Continue to next priority
    }

    // Priority 2: Check for areas
    const areaLayers = ['map-areas-fill', 'map-areas-outline'];
    try {
      const existingAreaLayers = areaLayers.filter(layerId => {
        try {
          return mapboxMap.getLayer(layerId) !== undefined;
        } catch {
          return false;
        }
      });
      
      if (existingAreaLayers.length > 0) {
        const areaFeatures = mapboxMap.queryRenderedFeatures(box, {
          layers: existingAreaLayers,
        });
        
        if (areaFeatures.length > 0) {
          const feature = areaFeatures[0];
          return {
            target: 'area',
            feature,
            layerId: feature.layer?.id,
            entityId: feature.properties?.id,
          };
        }
      }
    } catch {
      // Continue to next priority
    }

    // Priority 3: Check for mentions (on live map)
    const mentionLayers = ['map-mentions-point', 'map-mentions-point-label'];
    try {
      const existingMentionLayers = mentionLayers.filter(layerId => {
        try {
          return mapboxMap.getLayer(layerId) !== undefined;
        } catch {
          return false;
        }
      });
      
      if (existingMentionLayers.length > 0) {
        const mentionFeatures = mapboxMap.queryRenderedFeatures(box, {
          layers: existingMentionLayers,
        });
        
        if (mentionFeatures.length > 0) {
          const feature = mentionFeatures[0];
          return {
            target: 'mention',
            feature,
            layerId: feature.layer?.id,
            entityId: feature.properties?.id,
          };
        }
      }
    } catch {
      // Continue to next priority
    }

    // Priority 4: Map click (empty space)
    return { target: 'map' };
  }, []);

  /**
   * Handle map click with unified logic
   */
  const handleMapClick = useCallback(async (e: any) => {
    // Prevent overlapping click processing
    if (isProcessingClickRef.current) {
      return;
    }
    
    // Debounce rapid clicks (longer debounce on mobile to prevent double-taps)
    const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const debounceTime = isMobile ? 200 : CLICK_DEBOUNCE_MS; // Longer debounce on mobile
    const now = Date.now();
    if (now - lastClickTimeRef.current < debounceTime) {
      return;
    }
    lastClickTimeRef.current = now;
    isProcessingClickRef.current = true;

    const mapboxMap = mapInstanceRef.current as any;
    if (!mapboxMap || mapboxMap.removed) {
      isProcessingClickRef.current = false;
      return;
    }

    // Stop event propagation to prevent other handlers from firing
    if (e.originalEvent) {
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
    }

    // Get current values from refs
    const currentMapData = mapDataRef.current;
    const currentAccount = accountRef.current;
    const currentCheckPermission = checkPermissionRef.current;
    const currentPinMode = pinModeRef.current;
    const currentShowAreaDrawModal = showAreaDrawModalRef.current;

    // Detect what was clicked
    const clickResult = detectClickTarget(mapboxMap, e.point);
    const { target, entityId } = clickResult;

    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;

    // Handle based on click target priority
    try {
      switch (target) {
        case 'pin':
          if (entityId && onPinClickRef.current) {
            // Remove click marker and close location popup when clicking on pin
            removeClickMarkerRef.current();
            // Explicitly close location popup to prevent overlap on mobile
            setLocationSelectPopup({
              isOpen: false,
              lat: 0,
              lng: 0,
              address: null,
              mapMeta: null,
            });
            setClickedCoordinates(null);
            onPinClickRef.current(entityId);
          }
          return;

        case 'area':
          if (entityId && onAreaClickRef.current) {
            // Remove click marker and close location popup when clicking on area
            removeClickMarkerRef.current();
            // Explicitly close location popup to prevent overlap on mobile
            setLocationSelectPopup({
              isOpen: false,
              lat: 0,
              lng: 0,
              address: null,
              mapMeta: null,
            });
            setClickedCoordinates(null);
            onAreaClickRef.current(entityId);
          }
          return;

        case 'mention':
          if (entityId && onMentionClickRef.current) {
            // Remove click marker and close location popup when clicking on mention
            removeClickMarkerRef.current();
            // Explicitly close location popup to prevent overlap on mobile
            setLocationSelectPopup({
              isOpen: false,
              lat: 0,
              lng: 0,
              address: null,
              mapMeta: null,
            });
            setClickedCoordinates(null);
            onMentionClickRef.current(entityId);
          }
          return;

        case 'map':
          // Map click - handle based on mode and permissions
          handleMapClickTarget({
            mapboxMap,
            lat,
            lng,
            point: e.point,
            currentMapData,
            currentAccount,
            currentCheckPermission,
            currentPinMode,
            currentShowAreaDrawModal,
            setClickMarker: setClickMarkerRef.current,
            setLocationSelectPopup,
            setClickedCoordinates,
            onMapClick: onMapClickRef.current,
          });
          break;
      }
    } finally {
      // Always reset processing flag after handling
      isProcessingClickRef.current = false;
    }
  }, [detectClickTarget]);

  // Register unified click handler
  useEffect(() => {
    if (!mapLoaded) return;
    
    const mapboxMap = mapInstanceRef.current as any;
    if (!mapboxMap || mapboxMap.removed) return;

    mapboxMap.on('click', handleMapClick);
    
    return () => {
      const map = mapInstanceRef.current as any;
      if (map && !map.removed) {
        map.off('click', handleMapClick);
      }
    };
  }, [mapLoaded, handleMapClick]);

  return {
    locationSelectPopup,
    closePopup,
    popupAddress: locationSelectPopup.address || reverseGeocodeAddress,
  };
}

/**
 * Handle map click (empty space) based on mode and permissions
 */
async function handleMapClickTarget({
  mapboxMap,
  lat,
  lng,
  point,
  currentMapData,
  currentAccount,
  currentCheckPermission,
  currentPinMode,
  currentShowAreaDrawModal,
  setClickMarker,
  setLocationSelectPopup,
  setClickedCoordinates,
  onMapClick,
}: {
  mapboxMap: any;
  lat: number;
  lng: number;
  point: { x: number; y: number };
  currentMapData: MapData | null;
  currentAccount: { id: string; plan: string | null; subscription_status: string | null } | null;
  currentCheckPermission: (action: 'pins' | 'areas' | 'posts' | 'clicks') => boolean | undefined;
  currentPinMode: boolean;
  currentShowAreaDrawModal: boolean;
  setClickMarker: (coords: { lat: number; lng: number }) => void;
  setLocationSelectPopup: (popup: LocationSelectPopup | ((prev: LocationSelectPopup) => LocationSelectPopup)) => void;
  setClickedCoordinates: (coords: { lat: number; lng: number } | null) => void;
  onMapClick?: (coordinates: { lat: number; lng: number }, mapMeta: Record<string, any> | null) => void;
}) {
  // Pin creation mode (highest priority)
  if (currentPinMode && !currentShowAreaDrawModal) {
    // Check permissions
    if (currentMapData && currentAccount && currentCheckPermission) {
      const allowed = currentCheckPermission('pins');
      if (allowed === false) {
        return; // Permission denied
      }
    }

    // Call custom handler if provided
    if (onMapClick) {
      onMapClick({ lat, lng }, null);
    }
    return;
  }

  // Check if click is within Minnesota bounds
  if (!MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
    console.warn('[UnifiedMapClickHandler] Click outside Minnesota bounds:', { lat, lng });
    return;
  }

  // Check if map settings allow clicks
  const allowClicks = currentMapData?.settings?.collaboration?.allow_clicks ?? false;
  if (!allowClicks) {
    return;
  }

  // Check clickability permission
  if (currentMapData && currentAccount && currentCheckPermission) {
    const allowed = currentCheckPermission('clicks');
    if (allowed === false) {
      return; // Permission denied
    }
  }

  // Set click marker
  setClickMarker({ lat, lng });

  // Fly to location
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

  // Capture mapbox feature at click point for map_meta
  let mapMeta: Record<string, any> | null = null;
  try {
    const projectedPoint = mapboxMap.project([lng, lat]);
    const result = queryFeatureAtPoint(mapboxMap, projectedPoint, 'labels-first', false);
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
    console.debug('[UnifiedMapClickHandler] Error capturing map feature:', err);
  }

  // Trigger reverse geocode
  setClickedCoordinates({ lat, lng });

  // Update location select popup
  setLocationSelectPopup((prev) => ({
    isOpen: true,
    lat,
    lng,
    address: null, // Will be updated when reverse geocode completes
    mapMeta,
  }));
}
