'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, EyeIcon, Cog6ToothIcon, MapPinIcon, PencilSquareIcon, InformationCircleIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon, UserPlusIcon, GlobeAltIcon, LockClosedIcon, Square3Stack3DIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useMapboxMap } from '../hooks/useMapboxMap';
import { addBuildingExtrusions, removeBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import MapPinForm from './MapPinForm';
import MapAreaDrawModal from './MapAreaDrawModal';
import MapIDDetails from './MapIDDetails';
import CollaborationToolsNav from './CollaborationToolsNav';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import { isMapSetupComplete } from '@/lib/maps/mapSetupCheck';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import BoundaryLayersManager from './BoundaryLayersManager';
import MentionsLayer from '@/features/map/components/MentionsLayer';
import { useUnifiedMapClickHandler } from '../hooks/useUnifiedMapClickHandler';

interface MapIDBoxProps {
  mapStyle: 'street' | 'satellite' | 'light' | 'dark';
  mapId: string;
  isOwner: boolean;
  meta?: {
    buildingsEnabled?: boolean;
    pitch?: number;
    terrainEnabled?: boolean;
    center?: [number, number];
    zoom?: number;
  } | null;
  showDistricts?: boolean;
  showCTU?: boolean;
  showStateBoundary?: boolean;
  showCountyBoundaries?: boolean;
  title?: string;
  description?: string | null;
  visibility?: 'public' | 'private' | 'shared';
  allowOthersToPostPins?: boolean;
  allowOthersToAddAreas?: boolean;
  pinPermissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
  areaPermissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
  onPinActionCheck?: () => boolean | undefined;
  onAreaActionCheck?: () => boolean | undefined;
  userPlan?: 'hobby' | 'contributor' | 'professional' | 'business';
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
  viewCount?: number | null;
  hideCreator?: boolean;
  onMapLoad?: (map: MapboxMapInstance) => void;
  onMapUpdate?: (updatedData: any) => void;
  map_account_id?: string | null;
  current_account_id?: string | null;
  created_at?: string;
  updated_at?: string;
  initialPins?: MapPin[];
  initialAreas?: MapArea[];
  auto_approve_members?: boolean;
  membership_questions?: Array<{ id: number; question: string }>;
  membership_rules?: string | null;
  isMember?: boolean;
  effectiveIsMember?: boolean;
  onJoinClick?: () => void;
  activeSidebar?: string | null;
  mapSettings?: {
    collaboration?: {
      allow_pins?: boolean;
      allow_areas?: boolean;
      allow_posts?: boolean;
      allow_clicks?: boolean;
      pin_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
      area_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
      post_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
      click_permissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
      role_overrides?: {
        managers_can_edit?: boolean;
        editors_can_edit?: boolean;
      };
    };
    colors?: {
      owner?: string;
      manager?: string;
      editor?: string;
      'non-member'?: string;
    };
  } | null;
  userRole?: 'owner' | 'manager' | 'editor' | null;
  checkPermission?: (action: 'pins' | 'areas' | 'posts' | 'clicks') => boolean | undefined;
  mapData?: {
    id: string;
    account_id: string;
    settings?: {
      collaboration?: {
        allow_clicks?: boolean;
        allow_pins?: boolean;
        allow_areas?: boolean;
      };
    };
  } | null;
  onLocationPopupChange?: (popup: { isOpen: boolean; lat: number; lng: number; address: string | null; mapMeta: Record<string, any> | null }) => void;
  viewAsRole?: 'owner' | 'manager' | 'editor' | 'non-member';
  onOpenContributeOverlay?: (coordinates: { lat: number; lng: number }, mapMeta: Record<string, any> | null, fullAddress?: string | null) => void;
  onRemoveClickMarker?: (removeFn: () => void) => void;
}

interface MapPin {
  id: string;
  map_id: string;
  emoji: string | null;
  caption: string | null;
  image_url: string | null;
  video_url: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

interface MapArea {
  id: string;
  map_id: string;
  name: string;
  description: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  created_at: string;
  updated_at: string;
}

interface MapLayerPolygonEntity {
  layerId: string;
  title: string;
  subtitle?: string | null;
  properties: Record<string, unknown>;
  geometryType?: string | null;
  geometry?: GeoJSON.Geometry | GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
}

const PINS_SOURCE_ID = 'map-pins';
const PINS_LAYER_ID = 'map-pins-points';
const AREAS_SOURCE_ID = 'map-areas';
const AREAS_LAYER_ID = 'map-areas-fill';
const AREAS_OUTLINE_LAYER_ID = 'map-areas-outline';

const SELECTED_SOURCE_ID = 'map-selected-entity';
const SELECTED_POINT_LAYER_ID = 'map-selected-point';
const SELECTED_POLYGON_FILL_LAYER_ID = 'map-selected-polygon-fill';
const SELECTED_POLYGON_OUTLINE_LAYER_ID = 'map-selected-polygon-outline';

export default function MapIDBox({
  mapStyle,
  mapId,
  isOwner,
  meta,
  showDistricts = false,
  showCTU = false,
  showStateBoundary = false,
  showCountyBoundaries = false,
  title,
  description,
  visibility,
  allowOthersToPostPins = false,
  allowOthersToAddAreas = false,
  pinPermissions = null,
  areaPermissions = null,
  onPinActionCheck,
  onAreaActionCheck,
  userPlan,
  account,
  viewCount,
  hideCreator = false,
  onMapLoad,
  onMapUpdate,
  map_account_id,
  current_account_id,
  created_at,
  updated_at,
  initialPins = [],
  initialAreas = [],
  auto_approve_members = false,
  membership_questions = [],
  membership_rules = null,
  isMember = false,
  effectiveIsMember: effectiveIsMemberProp,
  onJoinClick,
  activeSidebar = null,
  mapSettings = null,
  userRole = null,
  checkPermission,
  mapData,
  onLocationPopupChange,
  viewAsRole,
  onOpenContributeOverlay,
  onRemoveClickMarker,
}: MapIDBoxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const { account: currentAccount, activeAccountId } = useAuthStateSafe();
  const { openAccount, openWelcome } = useAppModalContextSafe();
  const { addToast } = useToastContext();
  const [pinMode, setPinMode] = useState(false);
  const [showAreaDrawModal, setShowAreaDrawModal] = useState(false);
  const [activeTool, setActiveTool] = useState<'click' | 'pin' | 'draw' | null>(null);
  
  // Permission check handlers for pin/area actions
  const handlePinModeToggle = useCallback(() => {
    if (onPinActionCheck) {
      const allowed = onPinActionCheck();
      if (allowed === false) {
        return; // Permission check failed, upgrade prompt shown
      }
    }
    setPinMode(prev => !prev);
  }, [onPinActionCheck]);
  
  const handleAreaDrawToggle = useCallback(() => {
    if (onAreaActionCheck) {
      const allowed = onAreaActionCheck();
      if (allowed === false) {
        return; // Permission check failed, upgrade prompt shown
      }
    }
    setShowAreaDrawModal(true);
  }, [onAreaActionCheck]);

  // Handle collaboration tool selection
  const handleToolSelect = useCallback((tool: 'click' | 'pin' | 'draw') => {
    setActiveTool(tool);
    
    if (tool === 'pin') {
      handlePinModeToggle();
    } else if (tool === 'draw') {
      handleAreaDrawToggle();
    } else if (tool === 'click') {
      // Default click mode - disable pin mode and close draw modal
      setPinMode(false);
      setShowAreaDrawModal(false);
    }
  }, [handlePinModeToggle, handleAreaDrawToggle]);

  // Update active tool based on current state
  useEffect(() => {
    if (showAreaDrawModal) {
      setActiveTool('draw');
    } else if (pinMode) {
      setActiveTool('pin');
    } else {
      setActiveTool('click');
    }
  }, [pinMode, showAreaDrawModal]);
  
  // Expose handlers for MapInfoCard (if used elsewhere)
  // These will be called when pin/draw buttons are clicked
  const handlePinClick = handlePinModeToggle;
  const handleDrawClick = handleAreaDrawToggle;
  const [showInfoModal, setShowInfoModal] = useState(false);
  // Keep selectedEntity for layer clicks (not migrated to sidebar yet)
  const [selectedEntity, setSelectedEntity] = useState<MapPin | MapArea | MapLayerPolygonEntity | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<'pin' | 'area' | 'layer' | null>(null);
  const [loadingEntity, setLoadingEntity] = useState(false);
  const { mapInstance, mapLoaded } = useMapboxMap({
    mapStyle,
    containerRef: mapContainer as React.RefObject<HTMLDivElement>,
    meta,
    onMapLoad,
  });
  const [pins, setPins] = useState<MapPin[]>(initialPins);
  const [areas, setAreas] = useState<MapArea[]>(initialAreas);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinFormCoords, setPinFormCoords] = useState<{ lat: number; lng: number } | null>(null);
  const clickHandlerAddedRef = useRef(false);

  // Create checkPermission wrapper if not provided
  const checkPermissionWrapper = useCallback((action: 'pins' | 'areas' | 'posts' | 'clicks') => {
    if (checkPermission) {
      return checkPermission(action);
    }
    // Fallback: check based on onPinActionCheck/onAreaActionCheck
    if (action === 'pins' && onPinActionCheck) {
      return onPinActionCheck();
    }
    if (action === 'areas' && onAreaActionCheck) {
      return onAreaActionCheck();
    }
    return undefined;
  }, [checkPermission, onPinActionCheck, onAreaActionCheck]);

  // Use unified click handler - expose location popup state
  // Only pass mapData if it's a full MapData object (has all required fields)
  const fullMapData = mapData && 'name' in mapData && 'slug' in mapData ? mapData as any : null;
  // effectiveIsMember prop takes precedence, fallback to isMember
  const effectiveIsMember = effectiveIsMemberProp !== undefined ? effectiveIsMemberProp : isMember;
  const { locationSelectPopup: unifiedLocationPopup, closePopup: closeUnifiedPopup, popupAddress, removeClickMarker } = useUnifiedMapClickHandler({
    map: mapInstance,
    mapLoaded,
    mapData: fullMapData,
    account: (currentAccount ? {
      id: currentAccount.id,
      plan: currentAccount.plan || null,
      subscription_status: currentAccount.subscription_status || null,
    } : null) || (account ? {
      id: account.id,
      plan: null,
      subscription_status: null,
    } : null),
    isOwner,
    isMember: isMember || false,
    effectiveIsMember: effectiveIsMember || false,
    userRole: userRole || null,
    checkPermission: checkPermissionWrapper,
    pinMode,
    showAreaDrawModal,
    onPinClick: async (pinId) => {
      // Fetch pin data and dispatch event
      setLoadingEntity(true);
      try {
        const response = await fetch(`/api/maps/${mapId}/pins/${pinId}`);
        if (response.ok) {
          const pinData = await response.json();
          window.dispatchEvent(new CustomEvent('entity-click', {
            detail: { entity: pinData, type: 'pin' }
          }));
        } else {
          console.error('Failed to fetch pin:', response.statusText);
        }
      } catch (err) {
        console.error('Error fetching pin:', err);
      } finally {
        setLoadingEntity(false);
      }
    },
    onAreaClick: async (areaId) => {
      // Fetch area data and dispatch event
      setLoadingEntity(true);
      try {
        const response = await fetch(`/api/maps/${mapId}/areas/${areaId}`);
        if (response.ok) {
          const areaData = await response.json();
          window.dispatchEvent(new CustomEvent('entity-click', {
            detail: { entity: areaData, type: 'area' }
          }));
        } else {
          console.error('Failed to fetch area:', response.statusText);
        }
      } catch (err) {
        console.error('Error fetching area:', err);
      } finally {
        setLoadingEntity(false);
      }
    },
    onMentionClick: async (mentionId) => {
      // Fetch mention data and dispatch event (MentionsLayer normally does this, but unified handler takes priority)
      setLoadingEntity(true);
      try {
        // Try to get from MentionsLayer's cache first, then fetch if needed
        const response = await fetch(`/api/maps/${mapId}/pins/${mentionId}`);
        if (response.ok) {
          const mentionData = await response.json();
          window.dispatchEvent(new CustomEvent('mention-click', {
            detail: { 
              mention: mentionData,
              address: mentionData.full_address || null
            }
          }));
        } else {
          console.error('Failed to fetch mention:', response.statusText);
        }
      } catch (err) {
        console.error('Error fetching mention:', err);
      } finally {
        setLoadingEntity(false);
      }
    },
    onMapClick: async (coordinates, mapMeta) => {
      // Handle pin creation when in pin mode - use contribute overlay
      if (!pinMode || showAreaDrawModal) return;
      
      const canAddPins = isOwner || (visibility === 'public' && allowOthersToPostPins);
      if (!canAddPins) return;
      
      // Additional permission check
      if (onPinActionCheck) {
        const allowed = onPinActionCheck();
        if (allowed === false) {
          setPinMode(false);
          return;
        }
      }

      const { lat, lng } = coordinates;
      
      // Remove click marker before opening overlay
      if (removeClickMarker) {
        removeClickMarker();
      }
      
      // Use contribute overlay (same as "Add to Map" button in location selected)
      if (onOpenContributeOverlay) {
        // Address will be reverse geocoded in the contribute overlay
        onOpenContributeOverlay({ lat, lng }, mapMeta || null, null);
        setPinMode(false); // Exit pin mode after opening overlay
      }
    },
  });

  // Expose location popup state to parent
  useEffect(() => {
    if (onLocationPopupChange) {
      onLocationPopupChange({
        ...unifiedLocationPopup,
        address: popupAddress || unifiedLocationPopup.address,
      });
    }
  }, [unifiedLocationPopup, popupAddress, onLocationPopupChange]);
  
  // Expose remove click marker function to parent
  useEffect(() => {
    if (onRemoveClickMarker && removeClickMarker) {
      onRemoveClickMarker(removeClickMarker);
    }
  }, [onRemoveClickMarker, removeClickMarker]);
  
  const hiddenLayersRef = useRef<Map<string, 'visible' | 'none' | undefined>>(new Map());

  // Use active account ID from dropdown
  const currentAccountId = activeAccountId || currentAccount?.id || null;


  const clearSelection = useCallback(() => {
    setSelectedEntity(null);
    setSelectedEntityType(null);
  }, []);

  const isPinOrAreaLayerId = useCallback((layerId: unknown): boolean => {
    return (
      typeof layerId === 'string' &&
      (layerId === PINS_LAYER_ID || layerId === AREAS_LAYER_ID || layerId === AREAS_OUTLINE_LAYER_ID)
    );
  }, []);

  const isLayerPolygonLayerId = useCallback((layerId: unknown): boolean => {
    if (typeof layerId !== 'string') return false;
    if (layerId === 'county-boundaries-fill') return true;
    if (layerId === 'county-boundaries-outline') return true;
    if (layerId === 'county-boundaries-highlight-fill') return true;
    if (layerId === 'county-boundaries-highlight-outline') return true;
    if (layerId === 'ctu-boundaries-fill') return true;
    if (layerId === 'ctu-boundaries-outline') return true;
    if (layerId === 'ctu-boundaries-highlight-fill') return true;
    if (layerId === 'ctu-boundaries-highlight-outline') return true;
    if (layerId === 'state-boundary-fill') return true;
    if (layerId === 'state-boundary-outline') return true;
    if (layerId === 'state-boundary-highlight-fill') return true;
    if (layerId === 'state-boundary-highlight-outline') return true;
    if (/^congressional-district-\d+-(fill|outline|highlight-fill|highlight-outline)$/.test(layerId)) return true;
    return false;
  }, []);

  const buildLayerPolygonEntity = useCallback((feature: any): MapLayerPolygonEntity | null => {
    const layerId: unknown = feature?.layer?.id;
    if (typeof layerId !== 'string') return null;

    const rawProps = feature?.properties;
    const properties: Record<string, unknown> =
      rawProps && typeof rawProps === 'object'
        ? Object.fromEntries(Object.entries(rawProps as Record<string, unknown>))
        : {};

    const geometryType: string | null =
      feature?.geometry && typeof feature.geometry.type === 'string' ? feature.geometry.type : null;
    const geometry: GeoJSON.Geometry | null =
      feature?.geometry && typeof feature.geometry === 'object' ? (feature.geometry as GeoJSON.Geometry) : null;

    let title = 'Layer Feature';
    let subtitle: string | null = null;

    if (layerId.startsWith('county-boundaries-')) {
      title = typeof properties.county_name === 'string' && properties.county_name.trim().length > 0
        ? properties.county_name
        : 'County';
      subtitle = 'County boundary';
    } else if (layerId.startsWith('ctu-boundaries-')) {
      const name =
        typeof properties.feature_name === 'string' && properties.feature_name.trim().length > 0
          ? properties.feature_name
          : 'CTU';
      const ctuClass = typeof properties.ctu_class === 'string' ? properties.ctu_class : null;
      const county = typeof properties.county_name === 'string' ? properties.county_name : null;
      title = name;
      subtitle = [ctuClass, county].filter(Boolean).join(' • ') || 'CTU boundary';
    } else if (layerId.startsWith('state-boundary-')) {
      title = 'Minnesota';
      subtitle = 'State boundary';
    } else {
      const districtMatch = layerId.match(/^congressional-district-(\d+)-/);
      if (districtMatch?.[1]) {
        title = `Congressional District ${districtMatch[1]}`;
        subtitle = 'Congressional district';
      } else {
        title = layerId;
      }
    }

    return {
      layerId,
      title,
      subtitle,
      properties,
      geometryType,
      geometry,
    };
  }, []);

  const getAllInteractiveLayerIds = useCallback((mapboxMap: any): string[] => {
    const ids = new Set<string>();
    // Pins/areas
    ids.add(PINS_LAYER_ID);
    ids.add(AREAS_LAYER_ID);
    ids.add(AREAS_OUTLINE_LAYER_ID);
    // Known boundary layers
    [
      'county-boundaries-fill',
      'county-boundaries-outline',
      'county-boundaries-highlight-fill',
      'county-boundaries-highlight-outline',
      'ctu-boundaries-fill',
      'ctu-boundaries-outline',
      'ctu-boundaries-highlight-fill',
      'ctu-boundaries-highlight-outline',
      'state-boundary-fill',
      'state-boundary-outline',
      'state-boundary-highlight-fill',
      'state-boundary-highlight-outline',
    ].forEach((id) => ids.add(id));

    // Congressional layers are dynamic per district number; discover from style
    try {
      const style = typeof mapboxMap.getStyle === 'function' ? mapboxMap.getStyle() : null;
      const layers: any[] = Array.isArray(style?.layers) ? style.layers : [];
      for (const layer of layers) {
        const id = layer?.id;
        if (typeof id !== 'string') continue;
        if (/^congressional-district-\d+-(fill|outline|highlight-fill|highlight-outline)$/.test(id)) {
          ids.add(id);
        }
      }
    } catch {
      // ignore
    }
    return Array.from(ids);
  }, []);

  const hideOtherRecordLayers = useCallback((mapboxMap: any) => {
    const ids = getAllInteractiveLayerIds(mapboxMap);
    for (const id of ids) {
      if (!mapboxMap.getLayer || !mapboxMap.setLayoutProperty) continue;
      if (!mapboxMap.getLayer(id)) continue;
      if (!hiddenLayersRef.current.has(id)) {
        try {
          const prev = mapboxMap.getLayoutProperty(id, 'visibility') as 'visible' | 'none' | undefined;
          hiddenLayersRef.current.set(id, prev);
        } catch {
          hiddenLayersRef.current.set(id, undefined);
        }
      }
      try {
        mapboxMap.setLayoutProperty(id, 'visibility', 'none');
      } catch {
        // ignore
      }
    }
  }, [getAllInteractiveLayerIds]);

  const restoreOtherRecordLayers = useCallback((mapboxMap: any) => {
    if (!mapboxMap.getLayer || !mapboxMap.setLayoutProperty) return;
    for (const [id, prev] of hiddenLayersRef.current.entries()) {
      if (!mapboxMap.getLayer(id)) continue;
      try {
        mapboxMap.setLayoutProperty(id, 'visibility', prev ?? 'visible');
      } catch {
        // ignore
      }
    }
    hiddenLayersRef.current.clear();
  }, []);

  const ensureSelectedOverlay = useCallback((mapboxMap: any) => {
    if (!mapboxMap || typeof mapboxMap.getSource !== 'function' || typeof mapboxMap.addSource !== 'function') return;

    if (!mapboxMap.getSource(SELECTED_SOURCE_ID)) {
      mapboxMap.addSource(SELECTED_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    const addLayerIfMissing = (layer: any) => {
      if (typeof mapboxMap.getLayer !== 'function' || typeof mapboxMap.addLayer !== 'function') return;
      if (mapboxMap.getLayer(layer.id)) return;
      mapboxMap.addLayer(layer);
    };

    addLayerIfMissing({
      id: SELECTED_POLYGON_FILL_LAYER_ID,
      type: 'fill',
      source: SELECTED_SOURCE_ID,
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'fill-color': '#2563eb',
        'fill-opacity': 0.22,
      },
    });

    addLayerIfMissing({
      id: SELECTED_POLYGON_OUTLINE_LAYER_ID,
      type: 'line',
      source: SELECTED_SOURCE_ID,
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'line-color': '#2563eb',
        'line-width': 3,
        'line-opacity': 1,
      },
    });

    addLayerIfMissing({
      id: SELECTED_POINT_LAYER_ID,
      type: 'circle',
      source: SELECTED_SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 10,
        'circle-color': '#2563eb',
        'circle-opacity': 1,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 1,
      },
    });
  }, []);

  const setSelectedOverlayFeature = useCallback((mapboxMap: any, feature: GeoJSON.Feature | null) => {
    if (!mapboxMap || typeof mapboxMap.getSource !== 'function') return;
    const source = mapboxMap.getSource(SELECTED_SOURCE_ID) as any;
    if (!source || typeof source.setData !== 'function') return;
    source.setData({
      type: 'FeatureCollection',
      features: feature ? [feature] : [],
    });
  }, []);

  const computeBoundsFromGeometry = useCallback((geometry: GeoJSON.Geometry | null): [[number, number], [number, number]] | null => {
    if (!geometry) return null;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    const extend = (lng: number, lat: number) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    };

    const walk = (coords: any) => {
      if (!coords) return;
      if (Array.isArray(coords) && coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        extend(coords[0], coords[1]);
        return;
      }
      if (Array.isArray(coords)) {
        for (const c of coords) walk(c);
      }
    };

    // @ts-expect-error - geometry.coordinates is structurally present
    walk(geometry.coordinates);

    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return null;
    return [[minLng, minLat], [maxLng, maxLat]];
  }, []);

  // If switching into creation/draw modes, close any open selection sheet
  useEffect(() => {
    if (pinMode || showAreaDrawModal) {
      clearSelection();
    }
  }, [pinMode, showAreaDrawModal, clearSelection]);

  // Selection overlay + zoom-to-selection
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;
    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    ensureSelectedOverlay(mapboxMap);

    if (!selectedEntity || !selectedEntityType) {
      setSelectedOverlayFeature(mapboxMap, null);
      return;
    }

    if (selectedEntityType === 'pin') {
      const pin = selectedEntity as MapPin;
      if (typeof pin.lng === 'number' && typeof pin.lat === 'number') {
        const feature: GeoJSON.Feature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
          properties: { id: pin.id, kind: 'pin' },
        };
        setSelectedOverlayFeature(mapboxMap, feature);
        if (typeof mapboxMap.flyTo === 'function') {
          mapboxMap.flyTo({
            center: [pin.lng, pin.lat],
            zoom: Math.max(15, typeof mapboxMap.getZoom === 'function' ? mapboxMap.getZoom() : 15),
            duration: 700,
            essential: true,
          });
        }
      }
      return;
    }

    if (selectedEntityType === 'area') {
      const area = selectedEntity as MapArea;
      const geometry = (area.geometry as unknown as GeoJSON.Geometry) || null;
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        geometry,
        properties: { id: area.id, kind: 'area' },
      };
      setSelectedOverlayFeature(mapboxMap, feature);
      const bounds = computeBoundsFromGeometry(geometry);
      if (bounds && typeof mapboxMap.fitBounds === 'function') {
        mapboxMap.fitBounds(bounds, { padding: 70, duration: 700, essential: true });
      }
      return;
    }

    if (selectedEntityType === 'layer') {
      const layer = selectedEntity as MapLayerPolygonEntity;
      const geometry = (layer.geometry as GeoJSON.Geometry) || null;
      if (!geometry) {
        setSelectedOverlayFeature(mapboxMap, null);
        return;
      }
      const feature: GeoJSON.Feature = {
        type: 'Feature',
        geometry,
        properties: { layerId: layer.layerId, kind: 'layer' },
      };
      setSelectedOverlayFeature(mapboxMap, feature);
      const bounds = computeBoundsFromGeometry(geometry);
      if (bounds && typeof mapboxMap.fitBounds === 'function') {
        mapboxMap.fitBounds(bounds, { padding: 70, duration: 700, essential: true });
      }
    }
  }, [
    mapLoaded,
    mapInstance,
    selectedEntity,
    selectedEntityType,
    ensureSelectedOverlay,
    setSelectedOverlayFeature,
    computeBoundsFromGeometry,
  ]);

  // Hide all other records while the selection sheet is open; restore on close
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;
    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const isOpen = selectedEntity !== null && selectedEntityType !== null;
    if (isOpen) {
      hideOtherRecordLayers(mapboxMap);
    } else {
      restoreOtherRecordLayers(mapboxMap);
    }
  }, [mapLoaded, mapInstance, selectedEntity, selectedEntityType, hideOtherRecordLayers, restoreOtherRecordLayers]);

  // Apply meta settings to map
  useEffect(() => {
    if (!mapInstance || !mapLoaded || !meta) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    // Apply pitch
    if (meta.pitch !== undefined) {
      mapboxMap.setPitch(meta.pitch);
    }

    // Apply buildings
    if (meta.buildingsEnabled) {
      addBuildingExtrusions(mapInstance, { opacity: 0.6 });
    } else {
      removeBuildingExtrusions(mapInstance);
    }

    // Note: Terrain would be applied here if needed
  }, [mapInstance, mapLoaded, meta]);

  // Update pins/areas when initial data changes (from parent)
  useEffect(() => {
    if (initialPins.length > 0 || pins.length === 0) {
      setPins(initialPins);
    }
  }, [initialPins]);

  useEffect(() => {
    if (initialAreas.length > 0 || areas.length === 0) {
      setAreas(initialAreas);
    }
  }, [initialAreas]);

  // Fetch pins and areas only if not provided initially (for refresh/updates)
  useEffect(() => {
    if (!mapLoaded || !mapId || (initialPins.length > 0 && initialAreas.length > 0)) return;

    const fetchData = async () => {
      try {
        // Only fetch if we don't have initial data
        if (initialPins.length === 0) {
          const pinsResponse = await fetch(`/api/maps/${mapId}/pins`);
          if (pinsResponse.ok) {
            const pinsData = await pinsResponse.json();
            setPins(pinsData.pins || []);
          } else if (pinsResponse.status === 404 || pinsResponse.status === 403) {
            setPins([]);
          }
        }

        if (initialAreas.length === 0) {
          const areasResponse = await fetch(`/api/maps/${mapId}/areas`);
          if (areasResponse.ok) {
            const areasData = await areasResponse.json();
            setAreas(areasData.areas || []);
          } else if (areasResponse.status === 404 || areasResponse.status === 403) {
            setAreas([]);
          }
        }
      } catch (err) {
        console.error('Error fetching map data:', err);
        if (initialPins.length === 0) setPins([]);
        if (initialAreas.length === 0) setAreas([]);
      }
    };

    fetchData();
  }, [mapLoaded, mapId, initialPins.length, initialAreas.length]);

  // Add pins to map
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const geoJSON = {
      type: 'FeatureCollection' as const,
      features: pins
        .filter(pin => pin.lat !== null && pin.lng !== null && !isNaN(pin.lat) && !isNaN(pin.lng))
        .map((pin) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [pin.lng, pin.lat] as [number, number],
          },
          properties: {
            id: pin.id,
            emoji: pin.emoji || '📍',
            caption: pin.caption || '',
          },
        })),
    };
    
    // If no valid pins, remove source/layer if they exist
    if (geoJSON.features.length === 0) {
      try {
        const existingSource = mapboxMap.getSource(PINS_SOURCE_ID);
        if (existingSource) {
          if (mapboxMap.getLayer(PINS_LAYER_ID)) {
            mapboxMap.removeLayer(PINS_LAYER_ID);
          }
          mapboxMap.removeSource(PINS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors
      }
      return;
    }

    try {
      // Check if source exists and is a geojson source
      const existingSource = mapboxMap.getSource(PINS_SOURCE_ID);
      if (existingSource && existingSource.type === 'geojson') {
        // Verify setData method exists before calling
        if (typeof (existingSource as any).setData === 'function') {
          (existingSource as any).setData(geoJSON);
          return;
        }
      }

      // Source doesn't exist or is invalid - need to add/update
      // First, clean up any existing layers (they depend on the source)
      try {
        if (mapboxMap.getLayer(PINS_LAYER_ID)) {
          mapboxMap.removeLayer(PINS_LAYER_ID);
        }
        if (mapboxMap.getSource(PINS_SOURCE_ID)) {
          mapboxMap.removeSource(PINS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors (source/layer may not exist)
      }

      // Add source
      mapboxMap.addSource(PINS_SOURCE_ID, {
        type: 'geojson',
        data: geoJSON,
      });

      // Verify source exists before adding layer
      if (!mapboxMap.getSource(PINS_SOURCE_ID)) {
        console.error('[MapIDBox] Source was not added successfully');
        return;
      }

      // Add layer
      mapboxMap.addLayer({
        id: PINS_LAYER_ID,
        type: 'circle',
        source: PINS_SOURCE_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    } catch (err) {
      console.error('[MapIDBox] Error adding pins to map:', err);
    }
  }, [mapLoaded, mapInstance, pins]);

  // Handle pin hover (cursor changes) - click handling moved to unified handler
  useEffect(() => {
    if (!mapLoaded || !mapInstance || pinMode || showAreaDrawModal) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    // Add hover cursor
    const handleMouseEnter = () => {
      const canvas = mapboxMap.getCanvas();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
    };
    const handleMouseLeave = () => {
      if (!pinMode) {
        const canvas = mapboxMap.getCanvas();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
    };

    mapboxMap.on('mouseenter', PINS_LAYER_ID, handleMouseEnter);
    mapboxMap.on('mouseleave', PINS_LAYER_ID, handleMouseLeave);

    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('mouseenter', PINS_LAYER_ID, handleMouseEnter);
        mapboxMap.off('mouseleave', PINS_LAYER_ID, handleMouseLeave);
      }
    };
  }, [mapLoaded, mapInstance, pinMode, showAreaDrawModal]);

  // Add areas to map
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const geoJSON = {
      type: 'FeatureCollection' as const,
      features: areas.map((area) => ({
        type: 'Feature' as const,
        geometry: area.geometry,
        properties: {
          id: area.id,
          name: area.name,
          description: area.description || '',
        },
      })),
    };

    // If no valid areas, remove source/layer if they exist
    if (geoJSON.features.length === 0) {
      try {
        if (mapboxMap.getLayer(AREAS_OUTLINE_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_OUTLINE_LAYER_ID);
        }
        if (mapboxMap.getLayer(AREAS_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_LAYER_ID);
        }
        const existingSource = mapboxMap.getSource(AREAS_SOURCE_ID);
        if (existingSource) {
          mapboxMap.removeSource(AREAS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors
      }
      return;
    }

    try {
      // Check if source exists and is a geojson source
      const existingSource = mapboxMap.getSource(AREAS_SOURCE_ID);
      if (existingSource && existingSource.type === 'geojson') {
        // Verify setData method exists before calling
        if (typeof (existingSource as any).setData === 'function') {
          (existingSource as any).setData(geoJSON);
          return;
        }
      }

      // Source doesn't exist or is invalid - need to add/update
      // First, clean up any existing layers (they depend on the source)
      try {
        if (mapboxMap.getLayer(AREAS_OUTLINE_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_OUTLINE_LAYER_ID);
        }
        if (mapboxMap.getLayer(AREAS_LAYER_ID)) {
          mapboxMap.removeLayer(AREAS_LAYER_ID);
        }
        if (mapboxMap.getSource(AREAS_SOURCE_ID)) {
          mapboxMap.removeSource(AREAS_SOURCE_ID);
        }
      } catch {
        // Ignore cleanup errors (source/layer may not exist)
      }

      // Add source
      mapboxMap.addSource(AREAS_SOURCE_ID, {
        type: 'geojson',
        data: geoJSON,
      });

      // Verify source exists before adding layers
      if (!mapboxMap.getSource(AREAS_SOURCE_ID)) {
        console.error('[MapIDBox] Areas source was not added successfully');
        return;
      }

      // Add fill layer
      mapboxMap.addLayer({
        id: AREAS_LAYER_ID,
        type: 'fill',
        source: AREAS_SOURCE_ID,
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.15,
        },
      });

      // Add outline layer
      mapboxMap.addLayer({
        id: AREAS_OUTLINE_LAYER_ID,
        type: 'line',
        source: AREAS_SOURCE_ID,
        paint: {
          'line-color': '#10b981',
          'line-width': 2,
        },
      });
    } catch (err) {
      console.error('[MapIDBox] Error adding areas to map:', err);
    }
  }, [mapLoaded, mapInstance, areas]);

  // Handle area clicks
  useEffect(() => {
    if (!mapLoaded || !mapInstance || pinMode || showAreaDrawModal) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    // Add hover cursor - click handling moved to unified handler
    const handleMouseEnter = () => {
      const canvas = mapboxMap.getCanvas();
      if (canvas) {
        canvas.style.cursor = 'pointer';
      }
    };
    const handleMouseLeave = () => {
      if (!pinMode) {
        const canvas = mapboxMap.getCanvas();
        if (canvas) {
          canvas.style.cursor = '';
        }
      }
    };

    mapboxMap.on('mouseenter', AREAS_LAYER_ID, handleMouseEnter);
    mapboxMap.on('mouseleave', AREAS_LAYER_ID, handleMouseLeave);
    mapboxMap.on('mouseenter', AREAS_OUTLINE_LAYER_ID, handleMouseEnter);
    mapboxMap.on('mouseleave', AREAS_OUTLINE_LAYER_ID, handleMouseLeave);

    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('mouseenter', AREAS_LAYER_ID, handleMouseEnter);
        mapboxMap.off('mouseleave', AREAS_LAYER_ID, handleMouseLeave);
        mapboxMap.off('mouseenter', AREAS_OUTLINE_LAYER_ID, handleMouseEnter);
        mapboxMap.off('mouseleave', AREAS_OUTLINE_LAYER_ID, handleMouseLeave);
      }
    };
  }, [mapLoaded, mapInstance, mapId, pinMode, showAreaDrawModal]);

  // Handle boundary polygon clicks + click-to-dismiss on empty map
  useEffect(() => {
    if (!mapLoaded || !mapInstance || pinMode || showAreaDrawModal) return;

    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const handleMapClickForSelection = (e: any) => {
      try {
        const features: any[] = mapboxMap.queryRenderedFeatures(e.point);
        if (!Array.isArray(features) || features.length === 0) {
          clearSelection();
          return;
        }

        // If clicking pins/areas, let their layer handlers control selection (and don't dismiss).
        if (features.some((f) => isPinOrAreaLayerId(f?.layer?.id))) {
          return;
        }

        const polygonFeature = features.find((f) => isLayerPolygonLayerId(f?.layer?.id));
        if (polygonFeature) {
          const layerEntity = buildLayerPolygonEntity(polygonFeature);
          if (layerEntity) {
            setSelectedEntity(layerEntity);
            setSelectedEntityType('layer');
            return;
          }
        }

        // Clicked something else on the map; dismiss the sheet
        clearSelection();
      } catch {
        clearSelection();
      }
    };

    mapboxMap.on('click', handleMapClickForSelection);
    return () => {
      if (mapboxMap && !mapboxMap.removed) {
        mapboxMap.off('click', handleMapClickForSelection);
      }
    };
  }, [
    mapLoaded,
    mapInstance,
    pinMode,
    showAreaDrawModal,
    clearSelection,
    isPinOrAreaLayerId,
    isLayerPolygonLayerId,
    buildLayerPolygonEntity,
  ]);

  // Update cursor when pin mode changes - click handling moved to unified handler
  useEffect(() => {
    if (!mapLoaded || !mapInstance) return;
    
    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;
    
    const canvas = mapboxMap.getCanvas();
    if (!canvas) return;
    
    if (pinMode && !showAreaDrawModal) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }
  }, [mapLoaded, mapInstance, pinMode, showAreaDrawModal]);

  // Cleanup pins layer and source on unmount
  useEffect(() => {
    return () => {
      if (mapInstance) {
        const mapboxMap = mapInstance as any;
        try {
          if (mapboxMap.getLayer(PINS_LAYER_ID)) {
            mapboxMap.removeLayer(PINS_LAYER_ID);
          }
          if (mapboxMap.getSource(PINS_SOURCE_ID)) {
            mapboxMap.removeSource(PINS_SOURCE_ID);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [mapInstance]);

  // Handle pin creation
  const handleCreatePin = useCallback(async (data: {
    emoji: string | null;
    caption: string | null;
    image_url: string | null;
    video_url: string | null;
  }) => {
    if (!pinFormCoords) return;

    try {
      const response = await fetch(`/api/maps/${mapId}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          lat: pinFormCoords.lat,
          lng: pinFormCoords.lng,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create pin';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `${errorMessage}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const newPin = await response.json();
      // Refresh pins list to get complete data
      const refreshResponse = await fetch(`/api/maps/${mapId}/pins`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setPins(refreshData.pins || []);
      } else {
        // Fallback: add new pin to list
        setPins((prev) => [newPin, ...prev]);
      }
      setShowPinForm(false);
      setPinFormCoords(null);
    } catch (err) {
      throw err;
    }
  }, [mapId, pinFormCoords]);

  const displayName = account
    ? account.username ||
      (account.first_name && account.last_name
        ? `${account.first_name} ${account.last_name}`.trim()
        : account.first_name || 'User')
    : null;

  // Ensure only one mode is active at a time
  useEffect(() => {
    if (pinMode && showAreaDrawModal) {
      // If both are active, close area draw modal when pin mode activates
      setShowAreaDrawModal(false);
    }
  }, [pinMode]);

  // Update cursor when modes change
  useEffect(() => {
    if (!mapInstance || !mapLoaded) return;
    const mapboxMap = mapInstance as any;
    if (mapboxMap.removed) return;

    const canvas = mapboxMap.getCanvas();
    if (canvas) {
      // If area draw modal is open, don't change cursor (draw tool handles it)
      if (showAreaDrawModal) {
        canvas.style.cursor = '';
      } else {
        canvas.style.cursor = pinMode ? 'crosshair' : '';
      }
    }
  }, [pinMode, showAreaDrawModal, mapInstance, mapLoaded]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: 0, height: '100%', width: '100%' }}>

      {/* Map Info Card - Removed */}
      {mapLoaded && (
        <>

          {/* Saved boundary layers (exclusive, persisted via map.map_layers) */}
          {mapInstance && (
            <BoundaryLayersManager
              map={mapInstance}
              mapLoaded={mapLoaded}
              showDistricts={showDistricts}
              showCTU={showCTU}
              showStateBoundary={showStateBoundary}
              showCountyBoundaries={showCountyBoundaries}
            />
          )}
          
          {/* Mentions Layer - Render mentions as pins on map */}
          {/* Always render for public maps, conditionally for private/shared maps */}
          {mapLoaded && mapInstance && (visibility === 'public' || visibility === 'shared' || isOwner) && (
            <MentionsLayer 
              map={mapInstance} 
              mapLoaded={mapLoaded}
              mapId={mapId}
              skipClickHandlers={true}
            />
          )}
        </>
      )}

      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ 
          margin: 0, 
          padding: 0, 
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* Desktop: Join experience now handled by PageWrapper info card */}

      {/* Mobile: Join experience now handled by PageWrapper info card */}

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <div className="text-gray-600 text-xs font-medium">Loading map...</div>
          </div>
        </div>
      )}
      {showPinForm && pinFormCoords && (
        <MapPinForm
          isOpen={showPinForm}
          lat={pinFormCoords.lat}
          lng={pinFormCoords.lng}
          mapId={mapId}
          onClose={() => {
            setShowPinForm(false);
            setPinFormCoords(null);
          }}
          onSubmit={handleCreatePin}
          onPinCreated={async (pinId) => {
            // Refresh pins after creation
            try {
              const response = await fetch(`/api/maps/${mapId}/pins`);
              if (response.ok) {
                const data = await response.json();
                setPins(data.pins || []);
              }
            } catch (err) {
              console.error('Error refreshing pins:', err);
            }
          }}
        />
      )}


      {/* Area Draw Modal */}
      {(isOwner || (visibility === 'public' && allowOthersToAddAreas)) && (
        <MapAreaDrawModal
          isOpen={showAreaDrawModal}
          onClose={() => {
            setShowAreaDrawModal(false);
            setPinMode(false); // Ensure pin mode is off when closing draw modal
          }}
          mapId={mapId}
          mapInstance={mapInstance}
          mapLoaded={mapLoaded}
          mapStyle={mapStyle}
          autoSave={true}
          onAreaCreated={async () => {
            // Refresh areas list
            try {
              const response = await fetch(`/api/maps/${mapId}/areas`);
              if (response.ok) {
                const data = await response.json();
                setAreas(data.areas || []);
              }
            } catch (err) {
              console.error('Error refreshing areas:', err);
            }
          }}
        />
      )}


      {/* Entity sidebar is now handled by page-level useEntitySidebar hook */}
      {/* Layer clicks still use local state (not migrated yet) */}

      {/* Collaboration Tools Nav - Show for members, owners, and non-members (for preview/join prompt) */}
      {mapLoaded && current_account_id && (
        <CollaborationToolsNav
          onToolSelect={handleToolSelect}
          activeTool={activeTool}
          map={mapSettings ? {
            id: mapId,
            account_id: map_account_id || '',
            name: title || '',
            description: description || null,
            slug: '',
            visibility: (visibility || 'public') as 'public' | 'private',
            settings: {
              collaboration: mapSettings.collaboration || {},
            } as any,
            boundary: 'statewide' as any,
            boundary_data: null,
            member_count: 0,
            is_active: true,
            auto_approve_members: auto_approve_members,
            membership_rules: membership_rules,
            membership_questions: membership_questions,
            cover_image_url: null,
            image_url: null,
            tags: null,
            created_at: created_at || new Date().toISOString(),
            updated_at: updated_at || new Date().toISOString(),
            account: account || null,
          } as any : {
            id: mapId,
            account_id: map_account_id || '',
            name: title || '',
            description: description || null,
            slug: '',
            visibility: (visibility || 'public') as 'public' | 'private',
            settings: {
              collaboration: {
                allow_pins: allowOthersToPostPins || false,
                allow_areas: allowOthersToAddAreas || false,
                allow_clicks: false,
                allow_posts: false,
                pin_permissions: pinPermissions,
                area_permissions: areaPermissions,
              },
            } as any,
            boundary: 'statewide' as any,
            boundary_data: null,
            member_count: 0,
            is_active: true,
            auto_approve_members: auto_approve_members,
            membership_rules: membership_rules,
            membership_questions: membership_questions,
            cover_image_url: null,
            image_url: null,
            tags: null,
            created_at: created_at || new Date().toISOString(),
            updated_at: updated_at || new Date().toISOString(),
            account: account || null,
          } as any}
          isOwner={isOwner}
          isMember={isMember}
          userContext={currentAccountId && currentAccount ? {
            accountId: currentAccountId,
            plan: (userPlan || 'hobby') as any,
            subscription_status: currentAccount.subscription_status || null,
            role: userRole || null,
          } : null}
          viewAsRole={viewAsRole}
          onJoinClick={onJoinClick}
          mapSettings={mapSettings}
        />
      )}
    </div>
  );
}

