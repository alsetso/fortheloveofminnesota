'use client';

import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import toast, { Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import type { Mention } from '@/types/mention';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import MapIDBox from './components/MapIDBox';
import MapPageLayout from './MapPageLayout';
import MapPageHeaderButtons from './MapPageHeaderButtons';
import { useUnifiedSidebar } from '@/hooks/useUnifiedSidebar';
import { useMapMembership } from './hooks/useMapMembership';
import { useMapPermissions } from './hooks/useMapPermissions';
import { useMapSidebarConfigs } from './hooks/useMapSidebarConfigs';
import { useUnifiedMapClickHandler } from './hooks/useUnifiedMapClickHandler';
import { useMapPageData } from './hooks/useMapPageData';
import { useBoundaryLayers } from './hooks/useBoundaryLayers';
import { useMapAccess } from './hooks/useMapAccess';
import { useContributeOverlay } from './hooks/useContributeOverlay';
import { useMapSidebarHandlers } from './hooks/useMapSidebarHandlers';
import { useEntitySidebar } from './hooks/useEntitySidebar';
import { useViewAsRole } from './hooks/useViewAsRole';
import { shouldNormalizeUrl, getMapUrl } from '@/lib/maps/urls';
import type { PlanLevel } from '@/lib/maps/permissions';
import MapActionUpgradePrompt from '@/components/maps/MapActionUpgradePrompt';
import LocationSelectPopup from '@/components/layout/LocationSelectPopup';
import ViewAsSelector from './components/ViewAsSelector';
import type { MapData } from '@/types/map';

// Lazy load ContributeOverlay - only needed when #contribute hash is present
const ContributeOverlay = lazy(() => import('./components/ContributeOverlay'));

export interface MapPageLocationSelect {
  lat: number;
  lng: number;
  address: string | null;
  isOpen: boolean;
  mapMeta?: Record<string, any> | null;
}

import type { LiveMapFooterStatusState, BoundarySelectionItem } from '@/components/layout/LiveMapFooterStatus';
import type { LiveBoundaryLayerId } from '@/features/map/config';

interface MapPageProps {
  params: Promise<{ id: string }>;
  /** When true, render only map content (no PageWrapper). Used by /live with AppContainer. */
  skipPageWrapper?: boolean;
  /** Called when location selection changes (e.g. map click). Used by /live to show location in app footer. */
  onLocationSelect?: (info: MapPageLocationSelect) => void;
  /** Called when live map loading state changes (for /live footer status strip). */
  onLiveStatusChange?: (status: LiveMapFooterStatusState) => void;
  /** When set (e.g. on /live), pin clicks call this; pass pinData when resolved from URL or after fetch. */
  onLivePinSelect?: (pinId: string, pinData?: Record<string, unknown> | null) => void;
  /** When set (e.g. on /live), single boundary layer to show; only one at a time, toggled from main menu. */
  liveBoundaryLayer?: LiveBoundaryLayerId | null;
  /** When set (e.g. on /live), register a clear-selection function so footer close can sync map/status state. */
  onRegisterClearSelection?: (clearFn: () => void) => void;
  /** When false, show all pins unclustered on live map. When true (default), cluster pins. */
  pinDisplayGrouping?: boolean;
  /** When true on /live, show only current account's pins. Default false. */
  showOnlyMyPins?: boolean;
  /** When on /live: time filter for pins (24h, 7d, or null = all time). */
  timeFilter?: '24h' | '7d' | null;
  /** Called when map instance is available (for /live footer nearby pins). */
  onMapInstanceReady?: (map: any) => void;
  /** Called when GeolocateControl is ready (for /live user location). */
  onGeolocateControlReady?: (control: any) => void;
}

export default function MapPage({ params, skipPageWrapper = false, onLocationSelect, onLiveStatusChange, onLivePinSelect, liveBoundaryLayer, onRegisterClearSelection, pinDisplayGrouping = true, showOnlyMyPins = false, timeFilter = null, onMapInstanceReady, onGeolocateControlReady }: MapPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const mapInstanceRef = useRef<any>(null);
  const { activeSidebar, toggleSidebar, closeSidebar, openSidebar } = useUnifiedSidebar();
  const membershipToastShownRef = useRef(false);
  
  // Get map ID from params
  const [mapId, setMapId] = useState<string | null>(null);
  useEffect(() => {
    params.then(({ id }) => {
      // Redirect /map/live to /live (preserving query params)
      // Only redirect when NOT skipPageWrapper (i.e., when visiting /map/live directly)
      // When skipPageWrapper is true (called from /live page), allow it to render
      if (id === 'live' && !skipPageWrapper) {
        const queryString = searchParams.toString();
        const redirectUrl = queryString ? `/live?${queryString}` : '/live';
        router.replace(redirectUrl);
        return;
      }
      setMapId(id);
    });
  }, [params, router, searchParams, skipPageWrapper]);

  // Consolidated map page data (mapData, loading, error, viewCount, initialPins/Areas/Members)
  const {
    mapData,
    loading,
    error,
    viewCount,
    initialPins,
    initialAreas,
    initialMembers,
    updateMapData,
  } = useMapPageData({ mapId });

  // Boundary layers state (consolidated)
  // For custom maps, boundary layers come from mapData.settings.appearance.map_layers (source of truth)
  // For live map, boundary layers can be overridden by liveBoundaryLayer prop
  const { showDistricts, showCTU, showStateBoundary, showCountyBoundaries } = useBoundaryLayers(mapData);

  // Other state
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  
  // Membership check (consolidated) - must come before useMapPermissions
  const { isOwner, showMembers, isMember, isManager, loading: membershipLoading, userRole } = useMapMembership(mapId, mapData?.account_id || null, initialMembers);

  // View As role selector (only for owners)
  const { viewAsRole, setViewAsRole } = useViewAsRole(isOwner);

  // Unified access hook - consolidates all access checks and computed flags
  const { currentAccountId, computedUserRole, access, effectiveIsOwner, effectiveIsManager, effectiveIsMember } = useMapAccess({
    isOwner,
    isMember,
    isManager,
    userRole: userRole || null,
    showMembers,
    viewAsRole: isOwner ? viewAsRole : undefined,
  });

  // Unified permissions hook (replaces 3 duplicate handlers + upgrade prompt state)
  const { checkPermission, upgradePrompt, closeUpgradePrompt } = useMapPermissions({
    mapData,
    account,
    isOwner,
    userRole: userRole || null,
    viewAsRole: isOwner ? viewAsRole : undefined,
  });

  // Determine if filter icon should be shown
  const shouldShowFilterIcon = useMemo(() => {
    // Must be member or owner to see filter icon
    if (!access.canViewSettings) {
      return false;
    }

    // Check if show_map_filters_icon is enabled (default true)
    const showIconSetting = mapData?.settings?.presentation?.show_map_filters_icon ?? true;
    if (!showIconSetting) {
      return false;
    }

    // Check if any filter is enabled
    const mapFilters = mapData?.settings?.appearance?.map_filters;
    if (!mapFilters) {
      return false;
    }

    const hasAngle = (mapFilters.angle ?? 0) > 0;
    const hasMapStyles = mapFilters.map_styles === true;
    const hasGlobalLayers = mapFilters.global_layers === true;

    // Show icon if any filter is enabled
    return hasAngle || hasMapStyles || hasGlobalLayers;
  }, [mapData?.settings?.appearance?.map_filters, mapData?.settings?.presentation?.show_map_filters_icon, access.canViewSettings]);
  
  // Permission check handlers (using unified hook)
  const handlePinAction = useCallback(() => checkPermission('pins'), [checkPermission]);
  const handleAreaAction = useCallback(() => checkPermission('areas'), [checkPermission]);
  const handlePostAction = useCallback(() => checkPermission('posts'), [checkPermission]);

  // Show membership status toast after map loads and auth is checked
  useEffect(() => {
    // Only show toast if:
    // 1. Map data is loaded
    // 2. Membership check is complete
    // 3. User is authenticated
    // 4. We haven't shown the toast yet for this map
    if (!mapData || membershipLoading || !account || !mapId || membershipToastShownRef.current) {
      return;
    }

    // Skip toast for public maps where user has no role (they're just viewing)
    if (mapData.visibility === 'public' && !access.hasAccess) {
      membershipToastShownRef.current = true;
      return;
    }

    // Determine message based on role
    // Check ownership directly from map data as fallback (in case membership hook hasn't updated yet)
    const isActuallyOwner = mapData.account_id === account?.id;
    
    let title = '';
    let message = '';

    if (isOwner || isActuallyOwner) {
      title = 'Map Owner';
      message = 'You own this map and have full control';
    } else if (isManager) {
      title = 'Map Manager';
      message = 'You can manage this map and its members';
    } else if (isMember && userRole === 'editor') {
      title = 'Map Editor';
      message = 'You can add pins, areas, and posts to this map';
    } else if (mapData.visibility === 'private' && !isActuallyOwner) {
      title = 'Not a Member';
      message = 'This is a private map. Request access to collaborate';
    }

    // Only show toast if we have a message
    if (title) {
      toast(`${title}: ${message}`, {
        duration: 3000,
        position: 'top-right',
        style: {
          fontSize: '12px',
          padding: '10px',
        },
      });
      membershipToastShownRef.current = true;
    }
  }, [mapData, membershipLoading, account, mapId, isOwner, isManager, isMember, userRole, access.hasAccess]);

  // Reset toast flag when mapId changes
  useEffect(() => {
    membershipToastShownRef.current = false;
  }, [mapId]);

  // Check if this is the live map (only when skipPageWrapper is true, meaning called from /live page)
  // Posts are only available on the live map, not custom maps
  // IMPORTANT: For custom maps (skipPageWrapper = false), isLiveMap is always false
  // This ensures custom maps always use their own settings from mapData.settings as the source of truth
  const isLiveMap = useMemo(() => {
    // Only consider it live map if skipPageWrapper is true (called from /live page)
    // Custom maps (skipPageWrapper = false) always return false to ensure independence
    if (!skipPageWrapper) return false;
    if (!mapData && !mapId) return false;
    // Check both slug and mapId to handle cases where data might not be loaded yet
    const slugIsLive = mapData?.slug === 'live';
    const idIsLive = mapId === 'live';
    return slugIsLive || idIsLive;
  }, [skipPageWrapper, mapData?.slug, mapId]);

  // Check for pending membership requests
  useEffect(() => {
    if (!mapData || !mapId || !currentAccountId || isLiveMap) {
      setHasPendingRequest(false);
      return;
    }

    const checkPendingRequest = async () => {
      try {
        const requestsResponse = await fetch(`/api/maps/${mapId}/membership-requests`);
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          const pending = requestsData.requests?.some(
            (r: any) => r.account_id === currentAccountId && r.status === 'pending'
          ) || false;
          setHasPendingRequest(pending);
        } else if (requestsResponse.status === 403) {
          // 403 means can't view requests (not a manager/owner), assume no pending
          setHasPendingRequest(false);
        }
      } catch (err) {
        setHasPendingRequest(false);
      }
    };

    checkPendingRequest();
  }, [mapData, mapId, currentAccountId, isLiveMap]);



  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingPins, setLoadingPins] = useState(false);
  const [loadingStateBoundary, setLoadingStateBoundary] = useState<boolean | undefined>(undefined);
  const [loadingCountyBoundaries, setLoadingCountyBoundaries] = useState<boolean | undefined>(undefined);
  const [loadingCongressionalDistricts, setLoadingCongressionalDistricts] = useState<boolean | undefined>(undefined);
  const [loadingCTUBoundaries, setLoadingCTUBoundaries] = useState<boolean | undefined>(undefined);
  const [liveMapZoom, setLiveMapZoom] = useState<number | undefined>(undefined);

  // Stable map load handler so Mapbox is only initialized once per mount
  const handleMapLoad = useCallback((map: any) => {
    mapInstanceRef.current = map;
    setMapLoaded(true);
    onMapInstanceReady?.(map);
  }, [onMapInstanceReady]);

  // Zoom to pin when ?pin=id or ?lat=&lng= in URL (e.g. from homepage feed). Do not remove params — pin stays in URL until user closes footer. Re-apply zoom when pins load so we run after layers and avoid reset.
  const urlPinFlownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const pinId = searchParams.get('pin');
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    let lat: number;
    let lng: number;
    let key: string;

    if (pinId && initialPins.length > 0) {
      const resolvedPin = initialPins.find((p: { id?: string }) => p.id === pinId);
      if (!resolvedPin || typeof (resolvedPin as { lat?: number }).lat !== 'number' || typeof (resolvedPin as { lng?: number }).lng !== 'number') return;
      lat = (resolvedPin as { lat: number }).lat;
      lng = (resolvedPin as { lng: number }).lng;
      key = `pin-${pinId}`;
      onLivePinSelect?.(pinId, resolvedPin as Record<string, unknown>);
    } else if (latParam != null && lngParam != null) {
      const parsedLat = parseFloat(latParam);
      const parsedLng = parseFloat(lngParam);
      if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return;
      lat = parsedLat;
      lng = parsedLng;
      key = `ll-${lat}-${lng}`;
    } else {
      return;
    }

    if (urlPinFlownRef.current === key) return;
    urlPinFlownRef.current = key;

    const fly = () => {
      if (!mapInstanceRef.current) return;
      mapInstanceRef.current.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 800,
      });
    };

    const t = setTimeout(fly, initialPins.length > 0 ? 400 : 150);
    return () => clearTimeout(t);
  }, [mapLoaded, searchParams, initialPins, onLivePinSelect]);

  const handleBoundaryLayerLoadChange = useCallback((layerId: 'state' | 'county' | 'district' | 'ctu', loading: boolean) => {
    if (layerId === 'state') setLoadingStateBoundary(loading);
    else if (layerId === 'county') setLoadingCountyBoundaries(loading);
    else if (layerId === 'district') setLoadingCongressionalDistricts(loading);
    else setLoadingCTUBoundaries(loading);
  }, []);

  const [selectedBoundaries, setSelectedBoundaries] = useState<BoundarySelectionItem[]>([]);

  const handleBoundarySelect = useCallback((item: BoundarySelectionItem & { details?: Record<string, unknown> }) => {
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    const entityId = (item.id != null && String(item.id).trim() !== '') ? String(item.id).trim() : '';
    if (process.env.NODE_ENV === 'development') {
      console.debug('[LiveBoundary] MapPage handleBoundarySelect', {
        layer: item.layer,
        id: item.id,
        entityId,
        name: item.name,
        mapMetaBoundaryEntityId: entityId || (item.id != null ? String(item.id) : ''),
      });
    }
    setSelectedBoundaries([{ layer: item.layer, id: entityId || (item.id != null ? String(item.id) : ''), name: item.name, lat: Number.isFinite(lat) ? lat : 0, lng: Number.isFinite(lng) ? lng : 0 }]);
    setLocationSelectPopup({
      isOpen: true,
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      address: null,
      mapMeta: {
        boundaryLayer: item.layer,
        boundaryName: item.name,
        boundaryEntityId: entityId || (item.id != null ? String(item.id) : ''),
        feature: { name: item.name },
        boundaryDetails: item.details ?? null,
      },
    });
  }, []);

  // Track clicked items for live map footer status (array to append each click)
  const [clickedItems, setClickedItems] = useState<{ type: 'pin' | 'area' | 'map' | 'boundary'; id?: string; lat: number; lng: number; layer?: 'state' | 'county' | 'district' | 'ctu'; username?: string | null }[]>([]);

  // Handle click reporting for live map footer - append each click to the array
  // Limit to 100 items to prevent memory issues
  // Supports updating existing items with username when it becomes available
  const handleLiveClickReport = useCallback((clickedItem: { type: 'pin' | 'area' | 'map' | 'boundary'; id?: string; lat: number; lng: number; layer?: 'state' | 'county' | 'district' | 'ctu'; username?: string | null } | null) => {
    if (skipPageWrapper && clickedItem) {
      setClickedItems((prev) => {
        // If this is an update (same id exists), update the existing item
        if (clickedItem.id) {
          const existingIndex = prev.findIndex(item => item.id === clickedItem.id && item.type === clickedItem.type);
          if (existingIndex >= 0) {
            // Update existing item (e.g., with username)
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...clickedItem };
            return updated.slice(-100);
          }
        }
        // Otherwise, append new item
        const updated = [...prev, clickedItem];
        // Keep only the last 100 items
        return updated.slice(-100);
      });
    }
  }, [skipPageWrapper]);

  // Clear clicked items when selection is cleared (for live map)
  useEffect(() => {
    if (!skipPageWrapper || !onRegisterClearSelection) return;
    onRegisterClearSelection(() => {
      setClickedItems([]);
    });
  }, [skipPageWrapper, onRegisterClearSelection]);

  // Report live map status for footer status strip (skipPageWrapper = /live)
  useEffect(() => {
    if (!skipPageWrapper || !onLiveStatusChange) return;
    onLiveStatusChange({
      loadingData: loading,
      mapLoaded,
      loadingPins,
      loadingStateBoundary,
      loadingCountyBoundaries,
      loadingCongressionalDistricts,
      loadingCTUBoundaries,
      currentZoom: liveMapZoom,
      selectedBoundaries,
      clickedItems,
    });
  }, [skipPageWrapper, onLiveStatusChange, loading, mapLoaded, loadingPins, loadingStateBoundary, loadingCountyBoundaries, loadingCongressionalDistricts, loadingCTUBoundaries, liveMapZoom, selectedBoundaries, clickedItems]);

  // Location select popup state (managed by MapIDBox's unified handler)
  const [locationSelectPopup, setLocationSelectPopup] = useState({
    isOpen: false,
    lat: 0,
    lng: 0,
    address: null as string | null,
    mapMeta: null as Record<string, any> | null,
  });

  const closePopup = useCallback(() => {
    setLocationSelectPopup({
      isOpen: false,
      lat: 0,
      lng: 0,
      address: null,
      mapMeta: null,
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBoundaries([]);
    setLocationSelectPopup({
      isOpen: false,
      lat: 0,
      lng: 0,
      address: null,
      mapMeta: null,
    });
  }, []);

  useEffect(() => {
    if (skipPageWrapper && onRegisterClearSelection) {
      onRegisterClearSelection(clearSelection);
    }
  }, [skipPageWrapper, onRegisterClearSelection, clearSelection]);
  
  const popupAddress = locationSelectPopup.address;

  // Notify parent (e.g. /live) when location selection changes so it can show in app footer
  useEffect(() => {
    if (!skipPageWrapper || !onLocationSelect) return;
    const lat = Number(locationSelectPopup.lat);
    const lng = Number(locationSelectPopup.lng);
    onLocationSelect({
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      address: locationSelectPopup.address ?? null,
      isOpen: locationSelectPopup.isOpen,
      mapMeta: locationSelectPopup.mapMeta ?? null,
    });
  }, [skipPageWrapper, onLocationSelect, locationSelectPopup.lat, locationSelectPopup.lng, locationSelectPopup.address, locationSelectPopup.isOpen, locationSelectPopup.mapMeta]);

  // Consolidated sidebar handlers
  const sidebarHandlers = useMapSidebarHandlers({ toggleSidebar, isLiveMap });

  // Entity sidebar state (mentions, pins, areas). On live page, do not open sidebar on pin/mention click (footer only).
  const entitySidebar = useEntitySidebar({ disableForClicks: isLiveMap });
  
  // Success modal state for pin creation
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdMention, setCreatedMention] = useState<Mention | null>(null);

  // Auto-open sidebar when entity is selected
  useEffect(() => {
    if (entitySidebar.selectedMentionId || entitySidebar.selectedEntityId) {
      const sidebarType = entitySidebar.selectedMentionId ? 'mention' : 'entity';
      if (activeSidebar !== sidebarType) {
        // Use openSidebar to switch to the new type (don't toggle if already open)
        openSidebar(sidebarType);
      }
    } else if (activeSidebar === 'mention' || activeSidebar === 'entity') {
      // Close sidebar if entity is deselected
      closeSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitySidebar.selectedMentionId, entitySidebar.selectedEntityId, activeSidebar]);

  // Sidebar configurations (extracted to hook)
  // Use effective role flags when owner is viewing as different role
  const sidebarConfigs = useMapSidebarConfigs({
    mapData,
    mapId,
    isOwner: effectiveIsOwner,
    isMember: effectiveIsMember,
    isManager: effectiveIsManager,
    showMembers,
    currentAccountId,
    permissionsLoading: membershipLoading,
    closeSidebar: () => {
      entitySidebar.closeSidebar();
      closeSidebar();
    },
    onMapDataUpdate: updateMapData,
    onJoinSuccess: () => {
      // Membership will refresh automatically via useMapMembership hook
    },
    selectedMentionId: entitySidebar.selectedMentionId,
    selectedMention: entitySidebar.selectedMention,
    selectedEntityId: entitySidebar.selectedEntityId,
    selectedEntityType: entitySidebar.selectedEntityType,
    selectedEntity: entitySidebar.selectedEntity,
    onEntityDeleted: () => {
      // Refresh pins/areas if needed
      if (mapId) {
        // Trigger a refresh by updating a ref or state
        window.dispatchEvent(new CustomEvent('entity-deleted'));
      }
    },
    onEntityUpdated: (updated) => {
      // Handle entity update if needed
      window.dispatchEvent(new CustomEvent('entity-updated', { detail: updated }));
    },
  });

  // Contribute overlay management
  const { showOverlay: showContributeOverlay, openOverlay, closeOverlay: handleCloseContribute } = useContributeOverlay();
  
  // Track remove click marker function from MapIDBox
  const removeClickMarkerRef = useRef<(() => void) | null>(null);
  
  // Remove click marker when contribute overlay opens
  useEffect(() => {
    if (showContributeOverlay && removeClickMarkerRef.current) {
      removeClickMarkerRef.current();
    }
  }, [showContributeOverlay]);

  // Listen for open-contribute-overlay (e.g. from live page MapInfo "Add to map" button)
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.lat === 'number' && typeof d.lng === 'number') {
        openOverlay(
          { lat: d.lat, lng: d.lng },
          typeof d.mentionTypeId === 'string' ? d.mentionTypeId : undefined,
          d.mapMeta ?? null,
          d.address ?? null
        );
      }
    };
    window.addEventListener('open-contribute-overlay', handler as EventListener);
    return () => window.removeEventListener('open-contribute-overlay', handler as EventListener);
  }, [openOverlay]);

  // Listen for live-search-pin-select (fly to pin on /live)
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.lat === 'number' && typeof d.lng === 'number' && mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          center: [d.lng, d.lat],
          zoom: 14,
          duration: 500,
        });
      }
    };
    window.addEventListener('live-search-pin-select', handler as EventListener);
    return () => window.removeEventListener('live-search-pin-select', handler as EventListener);
  }, []);

  // Handle mention creation: fly to pin, show modal, select pin
  const handleMentionCreated = useCallback((mention: Mention) => {
    // Close overlay
    handleCloseContribute();
    
    // Wait a bit for overlay to close, then fly to location
    setTimeout(() => {
      if (mapInstanceRef.current && mention.lat && mention.lng) {
        mapInstanceRef.current.flyTo({
          center: [mention.lng, mention.lat],
          zoom: 15,
          duration: 1500,
        });
      }
      
      // Select the new pin - dispatch mention-click event so sidebar opens
      window.dispatchEvent(new CustomEvent('mention-click', {
        detail: { mention }
      }));
      
      // Show success modal with confetti
      setCreatedMention(mention);
      setShowSuccessModal(true);
      
      // Trigger confetti
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
      
      // Cleanup after duration
      setTimeout(() => clearInterval(interval), duration);
    }, 300);
  }, [handleCloseContribute, entitySidebar]);

  // Handle #people hash parameter - open members sidebar if user has permission
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkHash = () => {
      const hash = window.location.hash;
      if (hash === '#people' && access.canViewMembers) {
        // Open members sidebar if user has permission
        openSidebar('members');
      }
      // Note: We don't force-close the sidebar when hash is removed
      // User can close it manually or via the button
    };

    // Initial check
    checkHash();

    // Listen for hash changes
    window.addEventListener('hashchange', checkHash);
    
    // Also listen for popstate for browser back/forward
    const handlePopState = () => {
      setTimeout(checkHash, 0);
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [access.canViewMembers, openSidebar]);

  // URL normalization: automatically redirect ID URLs to slug URLs when available
  // Skip when skipPageWrapper (e.g. /live) so we do not redirect off the current route
  useEffect(() => {
    if (skipPageWrapper || !mapData || !mapId || loading) return;
    
    // Check if URL contains UUID but map has a slug/custom_slug
    if (shouldNormalizeUrl(mapId, mapData)) {
      const canonicalUrl = getMapUrl(mapData);
      // Replace URL with canonical slug (no history entry, no scroll)
      router.replace(canonicalUrl, { scroll: false });
    }
  }, [skipPageWrapper, mapData, mapId, loading, router]);

  const mainContent = (
    <div className={`relative w-full ${skipPageWrapper ? 'h-auto min-h-full' : 'h-full'}`} style={{ minHeight: 0, width: '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-50" style={{ height: skipPageWrapper ? '100dvh' : '100%' }}>
              <div className="text-center">
                <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-600">Loading map...</p>
              </div>
            </div>
          )}

      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-[10px] z-50" style={{ height: skipPageWrapper ? '100dvh' : '100%' }}>
              <div className="bg-white border border-red-200 rounded-md p-[10px] max-w-md w-full">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-xs text-gray-600 mb-3">{error}</p>
                <button
                  onClick={() => router.push('/maps')}
                  className="text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 px-3 transition-colors"
                >
                  Back to Maps
                </button>
              </div>
            </div>
          )}

          {mapData && !loading && (
            <>
              <div className={`relative ${skipPageWrapper ? 'h-[100dvh]' : 'h-full'} overflow-hidden`}>
                {/* View As Selector - Only show for owners */}
                {isOwner && (
                  <div className="absolute top-4 right-4 z-40 pointer-events-none">
                    <div className="pointer-events-auto">
                      <ViewAsSelector
                        currentRole={viewAsRole}
                        onRoleChange={setViewAsRole}
                        viewAsRole={viewAsRole}
                        mapSettings={mapData?.settings ? {
                          colors: {
                            owner: mapData.settings.colors?.owner || 'linear-gradient(to right, #FFB700, #DD4A00, #5C0F2F)',
                            manager: mapData.settings.colors?.manager || '#000000',
                            editor: mapData.settings.colors?.editor || '#000000',
                            'non-member': mapData.settings.colors?.['non-member'] || '#000000',
                          },
                        } : null}
                        useDefaultAppearance={!mapData?.settings?.colors}
                      />
                    </div>
                  </div>
                )}
                <MapPageLayout
                  activeSidebar={activeSidebar}
                  onSidebarClose={closeSidebar}
                  sidebarConfigs={sidebarConfigs}
                >
                  <MapIDBox 
                    mapStyle={mapData.settings?.appearance?.map_style || 'street'}
                    mapId={mapData.id}
                    isOwner={effectiveIsOwner}
                    isLiveMap={isLiveMap}
                    onLivePinSelect={skipPageWrapper ? onLivePinSelect : undefined}
                    onLiveClickReport={skipPageWrapper ? handleLiveClickReport : undefined}
                    // For custom maps, always use map's own settings. For live map, use liveBoundaryLayer override
                    meta={skipPageWrapper ? undefined : mapData.settings?.appearance?.meta}
                    showDistricts={skipPageWrapper && liveBoundaryLayer === 'district' ? true : showDistricts}
                    showCTU={skipPageWrapper && liveBoundaryLayer === 'ctu' ? true : showCTU}
                    showStateBoundary={skipPageWrapper && liveBoundaryLayer === 'state' ? true : showStateBoundary}
                    showCountyBoundaries={skipPageWrapper && liveBoundaryLayer === 'county' ? true : showCountyBoundaries}
                    title={mapData.name}
                    description={mapData.description}
                    visibility={mapData.visibility}
                    allowOthersToPostPins={mapData.settings?.collaboration?.allow_pins || false}
                    allowOthersToAddAreas={mapData.settings?.collaboration?.allow_areas || false}
                    pinPermissions={mapData.settings?.collaboration?.pin_permissions || null}
                    areaPermissions={mapData.settings?.collaboration?.area_permissions || null}
                    onPinActionCheck={handlePinAction}
                    onAreaActionCheck={handleAreaAction}
                    account={mapData.account}
                    // Pass permission props for MapInfoCard if it's used in MapIDBox
                    userPlan={(account?.plan || 'hobby') as PlanLevel}
                    viewCount={viewCount}
                    hideCreator={mapData.settings?.presentation?.hide_creator || false}
                    map_account_id={mapData.account_id}
                    current_account_id={currentAccountId}
                    created_at={mapData.created_at}
                    updated_at={mapData.updated_at}
                    initialPins={initialPins}
                    initialAreas={initialAreas}
                    auto_approve_members={mapData.auto_approve_members || false}
                    membership_questions={mapData.membership_questions || []}
                    membership_rules={mapData.membership_rules || null}
                    isMember={isMember}
                    effectiveIsMember={effectiveIsMember}
                    onJoinClick={sidebarHandlers.handleJoinClick}
                    activeSidebar={activeSidebar}
                    mapSettings={mapData.settings || null}
                    userRole={computedUserRole}
                    checkPermission={checkPermission}
                    mapData={mapData}
                    onLocationPopupChange={setLocationSelectPopup}
                    onMapLoad={handleMapLoad}
                    onGeolocateControlReady={onGeolocateControlReady}
                    onMapUpdate={updateMapData}
                    viewAsRole={isOwner ? viewAsRole : undefined}
                    onOpenContributeOverlay={(coordinates, mapMeta, fullAddress) => {
                      // Remove click marker before opening overlay
                      if (removeClickMarkerRef.current) {
                        removeClickMarkerRef.current();
                      }
                      // Open contribute overlay with location, mapMeta, and address (same as location selected)
                      openOverlay(coordinates, undefined, mapMeta || null, fullAddress || null);
                    }}
                    useDefaultAppearance={!mapData?.settings?.colors}
                    showCollaborationTools={!skipPageWrapper}
                    // For custom maps, always show pins. For live map, hide when boundary layer is active
                    showPins={skipPageWrapper && liveBoundaryLayer != null ? false : true}
                    allowPinsLoad={
                      skipPageWrapper && onLiveStatusChange && liveBoundaryLayer != null ? false : true
                    }
                    onMentionsLoadingChange={onLiveStatusChange ? setLoadingPins : undefined}
                    onBoundaryLayerLoadChange={onLiveStatusChange ? handleBoundaryLayerLoadChange : undefined}
                    onBoundarySelect={handleBoundarySelect}
                    onZoomChange={onLiveStatusChange ? setLiveMapZoom : undefined}
                    onRemoveClickMarker={(removeFn) => {
                      removeClickMarkerRef.current = removeFn;
                    }}
                    pinDisplayGrouping={pinDisplayGrouping}
                    showOnlyMyPins={showOnlyMyPins}
                    timeFilter={timeFilter}
                  />
                </MapPageLayout>
                
                {/* Contribute Overlay - positioned over map area only */}
                {mapData && showContributeOverlay && (
                  <Suspense fallback={null}>
                    <ContributeOverlay
                      isOpen={showContributeOverlay}
                      onClose={handleCloseContribute}
                      mapId={mapData.id}
                      mapSlug={mapData.slug}
                      onMentionCreated={handleMentionCreated}
                    />
                  </Suspense>
                )}
              </div>

            </>
          )}
        </div>
  );

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '12px',
            padding: '10px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      {skipPageWrapper ? (
        mainContent
      ) : (
        <PageWrapper
          mapSettings={mapData?.settings ? {
            ...mapData.settings,
            colors: {
              owner: mapData.settings.colors?.owner || 'linear-gradient(to right, #FFB700, #DD4A00, #5C0F2F)',
              manager: mapData.settings.colors?.manager || '#000000',
              editor: mapData.settings.colors?.editor || '#000000',
              'non-member': mapData.settings.colors?.['non-member'] || '#000000',
            },
          } : null}
          viewAsRole={isOwner ? viewAsRole : undefined}
          mapMembership={{
            isMember: effectiveIsMember,
            isOwner: effectiveIsOwner,
            onJoinClick: sidebarHandlers.handleJoinClick,
            mapData: mapData ? {
              id: mapData.id,
              name: mapData.name,
              description: mapData.description,
              visibility: mapData.visibility,
              auto_approve_members: mapData.auto_approve_members || false,
              membership_questions: mapData.membership_questions || [],
              membership_rules: mapData.membership_rules || null,
              settings: mapData.settings ? {
                ...mapData.settings,
                collaboration: mapData.settings.collaboration ? {
                  ...mapData.settings.collaboration,
                  pin_permissions: mapData.settings.collaboration.pin_permissions ? {
                    required_plan: (mapData.settings.collaboration.pin_permissions.required_plan === 'professional' || mapData.settings.collaboration.pin_permissions.required_plan === 'business') 
                      ? 'contributor' 
                      : (mapData.settings.collaboration.pin_permissions.required_plan === 'hobby' || mapData.settings.collaboration.pin_permissions.required_plan === 'contributor' 
                        ? mapData.settings.collaboration.pin_permissions.required_plan 
                        : null)
                  } : null,
                  area_permissions: mapData.settings.collaboration.area_permissions ? {
                    required_plan: (mapData.settings.collaboration.area_permissions.required_plan === 'professional' || mapData.settings.collaboration.area_permissions.required_plan === 'business') 
                      ? 'contributor' 
                      : (mapData.settings.collaboration.area_permissions.required_plan === 'hobby' || mapData.settings.collaboration.area_permissions.required_plan === 'contributor' 
                        ? mapData.settings.collaboration.area_permissions.required_plan 
                        : null)
                  } : null,
                  post_permissions: mapData.settings.collaboration.post_permissions ? {
                    required_plan: (mapData.settings.collaboration.post_permissions.required_plan === 'professional' || mapData.settings.collaboration.post_permissions.required_plan === 'business') 
                      ? 'contributor' 
                      : (mapData.settings.collaboration.post_permissions.required_plan === 'hobby' || mapData.settings.collaboration.post_permissions.required_plan === 'contributor' 
                        ? mapData.settings.collaboration.post_permissions.required_plan 
                        : null)
                  } : null,
                } : undefined
              } : undefined,
            } : null,
            onJoinSuccess: () => {
              // Membership will refresh automatically via useMapMembership hook
            },
          }}
          headerContent={
            <MapPageHeaderButtons
              onSettingsClick={sidebarHandlers.handleSettingsClick}
              onFilterClick={sidebarHandlers.handleFilterClick}
              showSettings={access.canViewSettings}
              showFilter={shouldShowFilterIcon}
            />
          }
          searchComponent={
            <MapSearchInput
              map={mapInstanceRef.current}
              onLocationSelect={(coordinates, placeName) => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo({
                    center: [coordinates.lng, coordinates.lat],
                    zoom: 15,
                    duration: 1500,
                  });
                }
              }}
            />
          }
          accountDropdownProps={{
            onAccountClick: () => {
              // Handle account click
            },
            onSignInClick: openWelcome,
          }}
          searchResultsComponent={<SearchResults />}
        >
            {mainContent}
          </PageWrapper>
      )}

      {/* Success Modal */}
      {showSuccessModal && createdMention && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full mx-4 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-10 h-10 text-green-600" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Pin Created!</h2>
              <p className="text-sm text-gray-600">Your pin has been added to the map</p>
            </div>
            
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setCreatedMention(null);
                // Reset URL parameters (remove any contribute overlay params and hash)
                if (typeof window !== 'undefined') {
                  const url = window.location.pathname;
                  window.history.replaceState(null, '', url);
                  // Also clear any sessionStorage data keys that might have been set
                  const urlParams = new URLSearchParams(window.location.search);
                  const dataKey = urlParams.get('data_key');
                  if (dataKey) {
                    try {
                      sessionStorage.removeItem(dataKey);
                    } catch (e) {
                      // Ignore storage errors
                    }
                  }
                }
              }}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Prompt */}
      <MapActionUpgradePrompt
        isOpen={upgradePrompt.isOpen}
        onClose={closeUpgradePrompt}
        action={upgradePrompt.action}
        requiredPlan={upgradePrompt.requiredPlan}
        currentPlan={upgradePrompt.currentPlan}
      />

      {/* Location Select Popup - hidden on /live (location shown in app footer instead) */}
      {!skipPageWrapper && (
        <LocationSelectPopup
          isOpen={locationSelectPopup.isOpen}
          onClose={closePopup}
          lat={locationSelectPopup.lat}
          lng={locationSelectPopup.lng}
          address={popupAddress}
          mapMeta={locationSelectPopup.mapMeta}
          allowPins={mapData?.settings?.collaboration?.allow_pins ?? false}
          isOwner={effectiveIsOwner}
          onAddToMap={(coordinates, mapMeta, mentionTypeId) => {
            // Remove click marker before opening overlay
            if (removeClickMarkerRef.current) {
              removeClickMarkerRef.current();
            }
            // Open contribute overlay with location, mention type, and mapMeta
            openOverlay(coordinates, mentionTypeId || undefined, mapMeta || null, popupAddress || null);
          }}
        />
      )}
    </>
  );
}

