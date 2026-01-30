'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import { useClickMarker } from '@/hooks/useClickMarker';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { MapData } from '@/types/map';
import { ZOOM_SCALE_REFERENCE } from '@/features/map/config';

/**
 * Click target priority order (highest to lowest):
 * 1. Pins (custom map pins)
 * 2. Areas (drawn areas)
 * 3. Mentions (user-generated content on live map)
 * 4. Boundary layers (state/county/CTU – handled by layer’s own handler; we do not overwrite popup)
 * 5. Map (empty space for location selection/pin creation)
 *
 * Zoom and URL/footer behavior:
 * - Boundary click: Layer handler sets locationSelectPopup (mapMeta with boundaryLayer, boundaryEntityId).
 *   No zoom here. Live page sets URL ?layer=&id= and shows MapInfo in app footer.
 * - Pin click: onPinClick; live page sets URL ?pin= and shows LivePinCard. Map may fly to pin when pin in URL.
 * - Map click (empty): flyTo(center, zoom = max(current+2, 15)); set locationSelectPopup (lat/lng, no boundary).
 *   Live page clears layer/id from URL, shows MapInfo with coordinates.
 */
type ClickTarget = 'pin' | 'area' | 'mention' | 'boundary' | 'map' | null;

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
  isMember: boolean;
  effectiveIsMember: boolean;
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
  /** Called when a boundary (state/county/CTU) is clicked. Use to set layer entity and open sidebar. */
  onBoundaryClick?: (feature: { layer?: { id: string }; properties?: Record<string, unknown>; geometry?: unknown }) => void;
  /** When true, show "Not minnesota" error toast when user clicks outside Minnesota (e.g. on /live). */
  isLiveMap?: boolean;
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
  isMember,
  effectiveIsMember,
  userRole,
  checkPermission,
  pinMode = false,
  showAreaDrawModal = false,
  onPinClick,
  onAreaClick,
  onMentionClick,
  onMapClick,
  onBoundaryClick,
  isLiveMap = false,
}: UnifiedMapClickHandlerOptions) {
  const router = useRouter();
  const { addToast } = useToastContext();
  const mapInstanceRef = useRef(map);
  const isLiveMapRef = useRef(isLiveMap);
  isLiveMapRef.current = isLiveMap;
  
  // Store frequently changing values in refs
  const mapDataRef = useRef(mapData);
  const accountRef = useRef(account);
  const isOwnerRef = useRef(isOwner);
  const isMemberRef = useRef(isMember);
  const effectiveIsMemberRef = useRef(effectiveIsMember);
  const checkPermissionRef = useRef(checkPermission);
  const pinModeRef = useRef(pinMode);
  const showAreaDrawModalRef = useRef(showAreaDrawModal);
  const onPinClickRef = useRef(onPinClick);
  const onAreaClickRef = useRef(onAreaClick);
  const onMentionClickRef = useRef(onMentionClick);
  const onMapClickRef = useRef(onMapClick);
  const onBoundaryClickRef = useRef(onBoundaryClick);

  // Update refs when values change
  useEffect(() => { mapInstanceRef.current = map; }, [map]);
  useEffect(() => { mapDataRef.current = mapData; }, [mapData]);
  useEffect(() => { accountRef.current = account; }, [account]);
  useEffect(() => { isOwnerRef.current = isOwner; }, [isOwner]);
  useEffect(() => { isMemberRef.current = isMember; }, [isMember]);
  useEffect(() => { effectiveIsMemberRef.current = effectiveIsMember; }, [effectiveIsMember]);
  useEffect(() => { checkPermissionRef.current = checkPermission; }, [checkPermission]);
  useEffect(() => { pinModeRef.current = pinMode; }, [pinMode]);
  useEffect(() => { showAreaDrawModalRef.current = showAreaDrawModal; }, [showAreaDrawModal]);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);
  useEffect(() => { onAreaClickRef.current = onAreaClick; }, [onAreaClick]);
  useEffect(() => { onMentionClickRef.current = onMentionClick; }, [onMentionClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onBoundaryClickRef.current = onBoundaryClick; }, [onBoundaryClick]);

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

    // Priority 4: Boundary layers (state, county, CTU) – layer’s handler sets footer; we skip so we don’t overwrite
    const boundaryLayers = ['state-boundary-fill', 'county-boundaries-fill', 'ctu-boundaries-fill'];
    try {
      const existingBoundaryLayers = boundaryLayers.filter((layerId) => {
        try {
          return mapboxMap.getLayer(layerId) !== undefined;
        } catch {
          return false;
        }
      });
      if (existingBoundaryLayers.length > 0) {
        const boundaryFeatures = mapboxMap.queryRenderedFeatures(box, {
          layers: existingBoundaryLayers,
        });
        if (boundaryFeatures.length > 0) {
          const feature = boundaryFeatures[0];
          if (process.env.NODE_ENV === 'development') {
            console.debug('[UnifiedMapClickHandler] onclick: target=boundary', { layerId: feature.layer?.id });
          }
          return { target: 'boundary', feature, layerId: feature.layer?.id };
        }
      }
    } catch {
      // Continue to next priority
    }

    // Priority 5: Map click (empty space)
    if (process.env.NODE_ENV === 'development') {
      console.debug('[UnifiedMapClickHandler] onclick: target=map (empty space)');
    }
    return { target: 'map' };
  }, []);

  /**
   * Check if clicks should be rejected (non-member or collaboration tool disabled)
   */
  const shouldRejectClick = useCallback(() => {
    const currentMapData = mapDataRef.current;
    const currentIsOwner = isOwnerRef.current;
    const currentEffectiveIsMember = effectiveIsMemberRef.current;
    
    // Check if collaboration tool (allow_clicks) is disabled
    const allowClicks = currentMapData?.settings?.collaboration?.allow_clicks ?? false;
    if (!allowClicks && !currentIsOwner) {
      return true;
    }
    
    // Check if user is non-member (not owner and not effective member)
    if (!currentIsOwner && !currentEffectiveIsMember) {
      return true;
    }
    
    return false;
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

    // Detect what was clicked first so we only reject for empty-map clicks (allow boundary/pin/area/mention for viewing)
    const clickResult = detectClickTarget(mapboxMap, e.point);
    const { target, entityId, feature } = clickResult;

    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;

    // Reject only when clicking empty map. Never reject for entity/boundary clicks (viewing is always allowed).
    if (target === 'map' && shouldRejectClick()) {
      addToast(createToast('error', 'Map clicks disabled', {
        message: 'You must be a member and the collaboration tool must be enabled to interact with the map.',
        duration: 3000,
      }));
      isProcessingClickRef.current = false;
      return;
    }

    // Only stop propagation when handling map click; allow boundary layer handlers (popup) to run
    if (target === 'map' && e.originalEvent) {
      e.originalEvent.stopPropagation();
      e.originalEvent.preventDefault();
    }

    const currentMapData = mapDataRef.current;
    const currentAccount = accountRef.current;
    const currentCheckPermission = checkPermissionRef.current;
    const currentPinMode = pinModeRef.current;
    const currentShowAreaDrawModal = showAreaDrawModalRef.current;

    if (process.env.NODE_ENV === 'development') {
      console.debug('[UnifiedMapClickHandler] onclick: goal=', target === 'map' ? 'location-select-or-pin' : target === 'boundary' ? 'leave-footer-to-boundary-handler' : target);
    }

    // Handle based on click target priority
    try {
      switch (target) {
        case 'boundary':
          // Layer handler (state/county/CTU/district) already set locationSelectPopup via onBoundarySelect; do not overwrite.
          if (feature && onBoundaryClickRef.current) {
            removeClickMarkerRef.current();
            setClickedCoordinates(null);
            onBoundaryClickRef.current(feature);
          }
          return;

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

        case 'map': {
          // On live map, show red toast when clicking outside Minnesota
          if (!MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
            if (isLiveMapRef.current) {
              addToast(createToast('error', 'Not minnesota', { duration: 3000 }));
            }
            break;
          }
          // Map click - handle based on mode and permissions
          handleMapClickTarget({
            mapboxMap,
            lat,
            lng,
            point: e.point,
            currentMapData,
            currentAccount,
            currentIsOwner: isOwnerRef.current,
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
      }
    } finally {
      // Always reset processing flag after handling
      isProcessingClickRef.current = false;
    }
  }, [detectClickTarget, shouldRejectClick, addToast]);

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
    removeClickMarker: removeClickMarkerRef.current,
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
  currentIsOwner,
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
  currentIsOwner: boolean;
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

    // Capture mapbox feature at click point for map_meta (same as location selection)
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
      console.debug('[UnifiedMapClickHandler] Error capturing map feature in pin mode:', err);
    }

    // Call custom handler if provided
    if (onMapClick) {
      onMapClick({ lat, lng }, mapMeta);
    }
    return;
  }

  // Check if click is within Minnesota bounds
  if (!MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
    console.warn('[UnifiedMapClickHandler] Click outside Minnesota bounds:', { lat, lng });
    return;
  }

  // Check if map settings allow clicks (owners can always click)
  const allowClicks = currentMapData?.settings?.collaboration?.allow_clicks ?? false;
  if (!allowClicks && !currentIsOwner) {
    return;
  }

  // Check clickability permission
  if (currentMapData && currentAccount && currentCheckPermission) {
    const allowed = currentCheckPermission('clicks');
    if (allowed === false) {
      return; // Permission denied
    }
  }

  // Don't show placemarker or open location popup until zoom >= 12 (pins load at 12px)
  const zoom = typeof mapboxMap.getZoom === 'function' ? mapboxMap.getZoom() : 12;
  if (zoom < ZOOM_SCALE_REFERENCE.CITY) {
    return;
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
