'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import MentionsLayer from '@/features/map/components/MentionsLayer';
import { useAuthStateSafe } from '@/features/auth';
import { usePageView } from '@/hooks/usePageView';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import toast from 'react-hot-toast';
import { useUrlMapState } from '../hooks/useUrlMapState';
import MentionLocationSheet from '@/components/live/MentionLocationSheet';
import { supabase } from '@/lib/supabase';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { ArrowPathIcon, XCircleIcon } from '@heroicons/react/24/outline';
import CreateMentionPopup from '@/components/layout/CreateMentionPopup';
import LocationSelectPopup from '@/components/layout/LocationSelectPopup';
import CameraModal from '@/components/camera/CameraModal';
import BottomButtonsPopup from '@/components/layout/BottomButtonsPopup';
import MentionTypeFilterPopup from '@/components/layout/MentionTypeFilterPopup';
import MapSettingsContent from '@/components/layout/MapSettingsContent';
import LocationPermissionModal from '@/components/layout/LocationPermissionModal';
import { useLocation } from '@/features/map/hooks/useLocation';
import CameraImagePreview from '@/components/layout/CameraImagePreview';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import { useLivePageModals } from '../hooks/useLivePageModals';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';
import CongressionalDistrictHoverInfo from '@/components/layout/CongressionalDistrictHoverInfo';
import CTUHoverInfo from '@/components/layout/CTUHoverInfo';
import CountyHoverInfo from '@/components/layout/CountyHoverInfo';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import StateBoundaryLayer from '@/features/map/components/StateBoundaryLayer';
import CountyBoundariesLayer from '@/features/map/components/CountyBoundariesLayer';
import LayerRecordPopup from '@/components/layout/LayerRecordPopup';
import OnboardingDemo from '@/components/layout/OnboardingDemo';
import ImageUploadDropzone from '@/components/layout/ImageUploadDropzone';
import CustomMentionButton from '@/components/map/CustomMentionButton';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import { usePinMarker } from '@/hooks/usePinMarker';

interface LiveMapProps {
  mapInstanceRef?: React.MutableRefObject<any>;
  /** Optional mention ID to highlight on the map */
  selectedMentionId?: string | null;
}

export default function LiveMap({ mapInstanceRef: externalMapInstanceRef, selectedMentionId }: LiveMapProps = {} as LiveMapProps) {
  // Track page view
  usePageView();
  const router = useRouter();
  
  // Prevent body scrolling on mount/unmount
  useEffect(() => {
    document.documentElement.classList.add('live-map-page');
    document.body.classList.add('live-map-page');
    
    return () => {
      document.documentElement.classList.remove('live-map-page');
      document.body.classList.remove('live-map-page');
    };
  }, []);
  
  // Map state
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const internalMapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const mapInstanceRef = externalMapInstanceRef || internalMapInstanceRef;
  const [mentionsRefreshKey, setMentionsRefreshKey] = useState(0);
  const [isLoadingMentions, setIsLoadingMentions] = useState(false);
  const loadingToastIdRef = useRef<string | null>(null);
  const hoveredMentionIdRef = useRef<string | null>(null);
  const isHoveringMentionRef = useRef(false);
  const isTransitioningToCreateRef = useRef(false);
  const temporaryMarkerRef = useRef<any>(null);
  const [createTabSelectedLocation, setCreateTabSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [createTabMapMeta, setCreateTabMapMeta] = useState<Record<string, any> | null>(null);
  const [createTabFullAddress, setCreateTabFullAddress] = useState<string | null>(null);
  
  // Location select popup state (for map clicks)
  const [locationSelectPopup, setLocationSelectPopup] = useState<{
    isOpen: boolean;
    lat: number;
    lng: number;
    address: string | null;
    mapMeta: Record<string, any> | null;
    mentionTypeId?: string | null;
    mentionTypeName?: string | null;
  }>({
    isOpen: false,
    lat: 0,
    lng: 0,
    address: null,
    mapMeta: null,
    mentionTypeId: null,
    mentionTypeName: null,
  });

  // Unified modal state management (must be called before any code that uses isModalOpen)
  const {
    modal,
    isAccountModalOpen,
    openCreate,
    closeCreate,
    openAccount,
    openMapStyles,
    openDynamicSearch,
    openCamera,
    closeCamera,
    openLocationPermission,
    closeLocationPermission,
    openLayerRecord,
    closeLayerRecord,
    closeAccount,
    closeMapStyles,
    closeDynamicSearch,
    closeAll,
    isModalOpen,
    openBottomButton,
    closeBottomButton,
    isBottomButtonOpen,
  } = useLivePageModals();

  // State for clicked coordinates (triggers reverse geocode hook)
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const { address: reverseGeocodeAddress } = useReverseGeocode(
    clickedCoordinates?.lat || null,
    clickedCoordinates?.lng || null
  );

  // Update location popup address when reverse geocode completes
  useEffect(() => {
    if (locationSelectPopup.isOpen && reverseGeocodeAddress !== null) {
      setLocationSelectPopup((prev) => ({
        ...prev,
        address: reverseGeocodeAddress,
      }));
      
      // Dispatch event to update search input
      window.dispatchEvent(new CustomEvent('update-search-address', {
        detail: { 
          address: reverseGeocodeAddress,
          coordinates: { lat: locationSelectPopup.lat, lng: locationSelectPopup.lng }
        }
      }));
    }
  }, [reverseGeocodeAddress, locationSelectPopup.isOpen, locationSelectPopup.lat, locationSelectPopup.lng]);

  // Pin marker hook - shows white pin when location popup is open, red when create form is open
  const pinColor = isModalOpen('create') ? 'red' : (locationSelectPopup.isOpen ? 'white' : undefined);
  const pinCoordinates = locationSelectPopup.isOpen 
    ? { lat: locationSelectPopup.lat, lng: locationSelectPopup.lng }
    : (createTabSelectedLocation || null);
  
  usePinMarker({
    map: mapInstanceRef.current,
    coordinates: pinCoordinates,
    color: pinColor as 'white' | 'red' | undefined,
    enabled: !!pinCoordinates && !!pinColor,
  });
  
  
  // Congressional districts visibility state
  const [showDistricts, setShowDistricts] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState<any | null>(null);
  
  
  // CTU boundaries visibility state
  const [showCTU, setShowCTU] = useState(false);
  const [hoveredCTU, setHoveredCTU] = useState<any | null>(null);
  
  // State boundary visibility state
  const [showStateBoundary, setShowStateBoundary] = useState(false);
  const [hoveredState, setHoveredState] = useState<any | null>(null);
  
  // County boundaries visibility state
  const [showCountyBoundaries, setShowCountyBoundaries] = useState(false);
  const [hoveredCounty, setHoveredCounty] = useState<any | null>(null);
  
  // Camera state (not modal state - these are data states)
  const [capturedImageBlob, setCapturedImageBlob] = useState<Blob | null>(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  
  // Waiting for location with mention type pre-selected
  const [waitingForLocationWithMentionType, setWaitingForLocationWithMentionType] = useState<{
    active: boolean;
    mentionTypeId: string | null;
    mentionTypeName: string | null;
  }>({ active: false, mentionTypeId: null, mentionTypeName: null });
  
  // Time filter state (for map settings)
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | 'all'>('all');
  
  // Location hook
  const { location, error, isLoading: isLocationLoading, requestLocation } = useLocation();
  
  // Modal controls (modals rendered globally, but we need access to open functions)
  const { openWelcome, closeModal, modal: appModal } = useAppModalContextSafe();
  
  // URL-based state (only year filter)
  useUrlMapState();
  
  // Manage loading toast for mentions
  useEffect(() => {
    if (isLoadingMentions) {
      if (!loadingToastIdRef.current) {
        loadingToastIdRef.current = toast.loading('Loading mentions...');
      }
    } else {
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
    }
  }, [isLoadingMentions]);
  
  // Sync boundary state from parent (via events)
  useEffect(() => {
    const handleBoundariesChange = (e: CustomEvent) => {
      const { showDistricts: sd, showCTU: scu, showStateBoundary: ssb, showCountyBoundaries: scb } = e.detail;
      if (sd !== undefined) setShowDistricts(sd);
      if (scu !== undefined) setShowCTU(scu);
      if (ssb !== undefined) setShowStateBoundary(ssb);
      if (scb !== undefined) setShowCountyBoundaries(scb);
    };
    
    window.addEventListener('map-boundaries-change', handleBoundariesChange as EventListener);
    return () => {
      window.removeEventListener('map-boundaries-change', handleBoundariesChange as EventListener);
    };
  }, []);
  
  // Close modals/popups when mention type filters change
  const searchParams = useSearchParams();
  useEffect(() => {
    // Close all modals and popups when mention type filters change
    // This ensures clean state when filters are removed
    closeAll();
    // Also close location select popup
    setLocationSelectPopup({ isOpen: false, lat: 0, lng: 0, address: null, mapMeta: null });
  }, [searchParams.get('type'), searchParams.get('types'), closeAll]);
  
  // Auth state from unified context - use isLoading to ensure auth is initialized
  const {
    user,
    account,
    isLoading: authLoading,
  } = useAuthStateSafe();

  // Show welcome modal for unauthenticated users (suggestive, not forced)
  // User can close it, but we'll suggest it again if they try to use authenticated features
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // If user becomes authenticated, close welcome modal
    if (user && appModal.type === 'welcome') {
      closeModal();
    }
    // Note: We don't force-open the modal for unauthenticated users
    // It will be opened when user tries to use authenticated features
  }, [user, authLoading, appModal.type, closeModal]);

  const isAdmin = account?.role === 'admin';
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  const [showDailyWelcome, setShowDailyWelcome] = useState(false);
  const [hideMicrophone, setHideMicrophone] = useState(true);
  const [showWelcomeTextOnly, setShowWelcomeTextOnly] = useState(true);
  
  // Mention type filters state
  const [selectedMentionTypes, setSelectedMentionTypes] = useState<Array<{ id: string; name: string; emoji: string; slug: string }>>([]);
  const [mentionsLayerHidden, setMentionsLayerHidden] = useState(false);
  
  // Fetch selected mention types from URL parameters
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const typesParam = searchParams.get('types');
    
    const fetchSelectedTypes = async () => {
      if (typesParam) {
        const slugs = typesParam.split(',').map(s => s.trim());
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const selected = slugs
            .map(slug => {
              const matchingType = allTypes.find(type => {
                const typeSlug = mentionTypeNameToSlug(type.name);
                return typeSlug === slug;
              });
              return matchingType ? { ...matchingType, slug } : null;
            })
            .filter(Boolean) as Array<{ id: string; name: string; emoji: string; slug: string }>;
          
          setSelectedMentionTypes(selected);
        } else {
          setSelectedMentionTypes([]);
        }
      } else if (typeParam) {
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const matchingType = allTypes.find(type => {
            const typeSlug = mentionTypeNameToSlug(type.name);
            return typeSlug === typeParam;
          });
          
          if (matchingType) {
            setSelectedMentionTypes([{ ...matchingType, slug: typeParam }]);
          } else {
            setSelectedMentionTypes([]);
          }
        } else {
          setSelectedMentionTypes([]);
        }
      } else {
        setSelectedMentionTypes([]);
      }
    };

    fetchSelectedTypes();
  }, [searchParams]);
  
  // Remove a mention type filter
  const handleRemoveType = (slugToRemove: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const typeParam = params.get('type');
    const typesParam = params.get('types');
    
    if (typesParam) {
      const slugs = typesParam.split(',').map(s => s.trim()).filter(s => s !== slugToRemove);
      if (slugs.length === 0) {
        params.delete('types');
      } else if (slugs.length === 1) {
        params.delete('types');
        params.set('type', slugs[0]);
      } else {
        params.set('types', slugs.join(','));
      }
    } else if (typeParam && typeParam === slugToRemove) {
      params.delete('type');
    }
    
    router.push(`/live?${params.toString()}`);
  };
  
  // Handle reload mentions button click
  const handleReloadMentions = () => {
    window.dispatchEvent(new CustomEvent('reload-mentions'));
  };
  
  // Listen for mentions layer hidden event
  useEffect(() => {
    const handleMentionsHidden = () => {
      setMentionsLayerHidden(true);
    };

    const handleMentionsReloaded = () => {
      setMentionsLayerHidden(false);
    };

    window.addEventListener('mentions-layer-hidden', handleMentionsHidden);
    window.addEventListener('mentions-reloaded', handleMentionsReloaded);

    return () => {
      window.removeEventListener('mentions-layer-hidden', handleMentionsHidden);
      window.removeEventListener('mentions-reloaded', handleMentionsReloaded);
    };
  }, []);

  // Show welcome toast when page loads (for authenticated users)
  // Sequence: hide mic -> show welcome text only -> reshow mic
  useEffect(() => {
    if (!user || !account || !mapLoaded || authLoading) return undefined;

    let hideTimer: NodeJS.Timeout | null = null;
    let showMicTimer: NodeJS.Timeout | null = null;

    // Start with microphone hidden
    setHideMicrophone(true);
    setShowWelcomeTextOnly(true);

    // Small delay to ensure map is fully rendered
    const showWelcome = setTimeout(() => {
      setShowDailyWelcome(true);
      
      // After showing welcome, wait then reshow microphone
      showMicTimer = setTimeout(() => {
        setShowDailyWelcome(false);
        setShowWelcomeTextOnly(false);
        // Small delay before showing mic again
        setTimeout(() => {
          setHideMicrophone(false);
        }, 300);
      }, 2500); // Show welcome for 2.5 seconds
    }, 500); // 500ms delay after map loads

    return () => {
      clearTimeout(showWelcome);
      if (hideTimer) clearTimeout(hideTimer);
      if (showMicTimer) clearTimeout(showMicTimer);
    };
  }, [user, account, mapLoaded, authLoading]);

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  // Check geolocation permission status
  const checkLocationPermission = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      // Fallback for browsers that don't support permissions API
      return 'prompt';
    }
    
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as 'granted' | 'denied' | 'prompt';
    } catch (err) {
      // If permissions API fails, assume we need to prompt
      return 'prompt';
    }
  }, []);

  // Center map on user location
  const centerMapOnLocation = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current || (mapInstanceRef.current as any).removed) return;
    
    const mapboxMap = mapInstanceRef.current as any;
    mapboxMap.flyTo({
      center: [lng, lat],
      zoom: Math.max(mapboxMap.getZoom(), 15),
      duration: 1000,
    });
  }, []);

  // Handle location button click
  const handleLocationButtonClick = useCallback(async () => {
    // Check permission first
    const permission = await checkLocationPermission();
    
    if (permission === 'granted') {
      // Permission already granted, request location and center
      requestLocation();
    } else if (permission === 'denied') {
      // Permission denied, show modal to explain
      openLocationPermission();
    } else {
      // Permission prompt needed, show modal first
      openLocationPermission();
    }
  }, [checkLocationPermission, requestLocation, openLocationPermission]);

  // Handle location received from hook
  useEffect(() => {
    if (location && !error) {
      centerMapOnLocation(location.latitude, location.longitude);
      closeLocationPermission();
    }
  }, [location, error, centerMapOnLocation, closeLocationPermission]);

  // Handle location permission modal allow
  const handleLocationPermissionAllow = useCallback(() => {
    closeLocationPermission();
    requestLocation();
  }, [requestLocation, closeLocationPermission]);

  // Listen for mention-created event from inline form to refresh mentions layer
  useEffect(() => {
    const handleMentionCreatedEvent = () => {
      // Don't increment refresh key - this causes component remount and fitBounds to run again
      // Instead, dispatch a reload event that MentionsLayer listens to
      window.dispatchEvent(new CustomEvent('reload-mentions'));
    };

    const handleRemoveTempPin = () => {
      if (temporaryMarkerRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }
    };

    window.addEventListener('mention-created', handleMentionCreatedEvent);
    window.addEventListener('mention-created-remove-temp-pin', handleRemoveTempPin);
    return () => {
      window.removeEventListener('mention-created', handleMentionCreatedEvent);
      window.removeEventListener('mention-created-remove-temp-pin', handleRemoveTempPin);
    };
  }, []);

  // Listen for live account modal open/close to hide/show mobile nav and close all overlays
  useEffect(() => {
    const handleAccountModalChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isOpen: boolean }>;
      const isOpen = customEvent.detail?.isOpen || false;
      
      // Close all overlays when account modal opens
      if (isOpen) {
        openAccount();
      } else {
        // Modal state is managed by useLivePageModals, no need to set local state
      }
    };

    window.addEventListener('live-account-modal-change', handleAccountModalChange);
    return () => {
      window.removeEventListener('live-account-modal-change', handleAccountModalChange);
    };
  }, [openAccount]);

  // Maintain preview marker when create sheet is open
  useEffect(() => {
    const isCreateOpen = isModalOpen('create');
    if (isCreateOpen && createTabSelectedLocation && account && mapInstanceRef.current && !(mapInstanceRef.current as any).removed) {
      // Ensure marker exists and is properly positioned
      const ensurePreviewMarker = async () => {
        try {
          const mapbox = await import('mapbox-gl');
          const currentMap = mapInstanceRef.current;
          if (!currentMap || (currentMap as any).removed) return;

          const { lat, lng } = createTabSelectedLocation;

          // If marker doesn't exist or is at wrong position, create/update it
          if (!temporaryMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'mention-preview-marker';
            el.style.cssText = `
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            `;

            // Account image circle
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 2px solid white;
              overflow: hidden;
              background-color: white;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              display: flex;
              align-items: center;
              justify-content: center;
            `;

            if (account.image_url) {
              const img = document.createElement('img');
              img.src = account.image_url;
              img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
              `;
              img.onerror = () => {
                const initial = document.createElement('div');
                initial.style.cssText = `
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-center;
                  background-color: #f3f4f6;
                  color: #6b7280;
                  font-size: 14px;
                  font-weight: 500;
                `;
                initial.textContent = account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'U';
                imageContainer.innerHTML = '';
                imageContainer.appendChild(initial);
              };
              imageContainer.appendChild(img);
            } else {
              const initial = document.createElement('div');
              initial.style.cssText = `
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-center;
                background-color: #f3f4f6;
                color: #6b7280;
                font-size: 14px;
                font-weight: 500;
              `;
              initial.textContent = account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'U';
              imageContainer.appendChild(initial);
            }

            el.appendChild(imageContainer);

            // Preview label
            const label = document.createElement('div');
            label.style.cssText = `
              margin-top: 4px;
              padding: 2px 6px;
              background-color: rgba(0, 0, 0, 0.6);
              color: white;
              font-size: 10px;
              font-weight: 500;
              border-radius: 4px;
              white-space: nowrap;
            `;
            label.textContent = 'Preview';
            el.appendChild(label);

            const marker = new mapbox.Marker({
              element: el,
              anchor: 'bottom',
            })
              .setLngLat([lng, lat])
              .addTo(currentMap as any);

            temporaryMarkerRef.current = marker;
          } else {
            // Update position if marker exists but is at wrong location
            const currentLngLat = temporaryMarkerRef.current.getLngLat();
            const tolerance = 0.0001; // Small tolerance for floating point comparison
            if (Math.abs(currentLngLat.lng - lng) > tolerance || Math.abs(currentLngLat.lat - lat) > tolerance) {
              temporaryMarkerRef.current.setLngLat([lng, lat]);
            }
          }
        } catch (err) {
          console.error('[LiveMap] Error ensuring preview marker:', err);
        }
      };

      ensurePreviewMarker();
    } else if (!isCreateOpen && temporaryMarkerRef.current) {
      // Only remove marker when create sheet closes (not during transition)
      if (!isTransitioningToCreateRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }
    }
  }, [isModalOpen('create'), createTabSelectedLocation, account]);


  // State for unified mention location sheet
  const [selectedMentionForSheet, setSelectedMentionForSheet] = useState<any>(null);
  const [locationDataForSheet, setLocationDataForSheet] = useState<{
    place_name?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  } | null>(null);
  const [sheetType, setSheetType] = useState<'mention' | 'location'>('mention');
  const [isMentionSheetOpen, setIsMentionSheetOpen] = useState(false);

  // Listen for mention click events to show unified sheet and update URL
  useEffect(() => {
    const handleMentionClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ mention: any; address?: string | null }>;
      const mention = customEvent.detail?.mention;
      const address = customEvent.detail?.address;
      
      if (mention && mention.id && typeof mention.lat === 'number' && typeof mention.lng === 'number') {
        // Remove red pin marker when clicking on a mention
        if (temporaryMarkerRef.current) {
          temporaryMarkerRef.current.remove();
          temporaryMarkerRef.current = null;
        }
        
        // Update search input with mention address
        if (address) {
          window.dispatchEvent(new CustomEvent('update-search-input', {
            detail: { query: address }
          }));
        }
        
        // Update URL with mention details (same as feed navigation)
        const url = new URL(window.location.href);
        url.searchParams.set('lat', mention.lat.toString());
        url.searchParams.set('lng', mention.lng.toString());
        url.searchParams.set('mentionId', mention.id);
        window.history.replaceState({}, '', url.toString());
        
        // Dispatch event to trigger URL watcher in parent page
        window.dispatchEvent(new CustomEvent('mention-selected-from-map', {
          detail: { mentionId: mention.id, lat: mention.lat, lng: mention.lng }
        }));
      }
    };

    window.addEventListener('mention-click', handleMentionClick);
    return () => {
      window.removeEventListener('mention-click', handleMentionClick);
    };
  }, []);


  // Handler for "Add Mention" button from layer popups (still opens create form)
  // Note: Map clicks now show LocationSelectPopup instead
  useEffect(() => {
    const handleShowLocationForMention = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        lat: number;
        lng: number;
        map_meta?: Record<string, any>;
        full_address?: string | null;
      }>;
      const { lat, lng, map_meta, full_address } = customEvent.detail || {};
      if (!lat || !lng) return;

      // Set flag to prevent popup from removing marker during transition
      isTransitioningToCreateRef.current = true;

      // Set location state FIRST (before any async operations or closing popups)
      setCreateTabSelectedLocation({ lat, lng });
      setCreateTabMapMeta(map_meta || null);
      setCreateTabFullAddress(full_address || null);

      // Close any open popups/tabs
      closeAll();

      // Open create form
      openCreate({ lat, lng, map_meta });

      // Transform existing white pin to red pin when create form opens
      setTimeout(() => {
        if (temporaryMarkerRef.current && mapInstanceRef.current && !(mapInstanceRef.current as any).removed) {
          const markerElement = temporaryMarkerRef.current.getElement();
          if (markerElement) {
            // The pin element itself is the circle, find the dot inside
            const pinDot = markerElement.querySelector('.map-click-pin-dot') as HTMLElement;
            
            if (markerElement && pinDot) {
              // Change white pin to red pin
              markerElement.style.backgroundColor = '#ef4444'; // red-500
              markerElement.style.borderColor = '#ef4444';
              
              // Change black dot to white dot
              pinDot.style.backgroundColor = '#ffffff'; // white
            }
          }
        }
        
        // Clear flag
        isTransitioningToCreateRef.current = false;
      }, 50);
    };
    
    // Handler for opening create mention from filter sidebar
    const handleOpenCreateFromFilter = () => {
      // Set state to wait for location selection with mention type
      if (selectedMentionTypes.length === 1) {
        setWaitingForLocationWithMentionType({
          active: true,
          mentionTypeId: selectedMentionTypes[0].id,
          mentionTypeName: selectedMentionTypes[0].name,
        });
      }
    };

    window.addEventListener('show-location-for-mention', handleShowLocationForMention);
    window.addEventListener('open-create-mention-from-filter', handleOpenCreateFromFilter);
    
    // Handle edit mention event - opens create container at 100%
    const handleShowLocationForMentionEdit = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        lat: number;
        lng: number;
        map_meta?: Record<string, any>;
        full_address?: string | null;
        mention_id?: string;
        description?: string;
        image_url?: string | null;
        video_url?: string | null;
        media_type?: 'image' | 'video' | 'none';
        mention_type_id?: string | null;
        collection_id?: string | null;
      }>;
      const { lat, lng, map_meta, full_address } = customEvent.detail || {};
      if (!lat || !lng) return;

      // Set flag to prevent popup from removing marker during transition
      isTransitioningToCreateRef.current = true;

      // Set location state FIRST (before any async operations or closing popups)
      setCreateTabSelectedLocation({ lat, lng });
      setCreateTabMapMeta(map_meta || null);
      setCreateTabFullAddress(full_address || null);

      // Close any open popups/tabs
      closeAll();

      // Open create form with edit mode (100% width/height)
      openCreate({ 
        lat, 
        lng, 
        map_meta, 
        isEditMode: true, 
        editData: {
          mention_id: customEvent.detail.mention_id,
          description: customEvent.detail.description,
          image_url: customEvent.detail.image_url,
          video_url: customEvent.detail.video_url,
          media_type: customEvent.detail.media_type,
          mention_type_id: customEvent.detail.mention_type_id,
          collection_id: customEvent.detail.collection_id,
        }
      });

      // Transform existing white pin to red pin when create form opens
      setTimeout(() => {
        if (temporaryMarkerRef.current && mapInstanceRef.current && !(mapInstanceRef.current as any).removed) {
          const markerElement = temporaryMarkerRef.current.getElement();
          if (markerElement) {
            // The pin element itself is the circle, find the dot inside
            const pinDot = markerElement.querySelector('.map-click-pin-dot') as HTMLElement;
            
            if (markerElement && pinDot) {
              // Change white pin to red pin
              markerElement.style.backgroundColor = '#ef4444'; // red-500
              markerElement.style.borderColor = '#ef4444';
              
              // Change black dot to white dot
              pinDot.style.backgroundColor = '#ffffff'; // white
            }
          }
        }
        
        // Clear flag
        isTransitioningToCreateRef.current = false;
      }, 50);
    };

    window.addEventListener('show-location-for-mention-edit', handleShowLocationForMentionEdit);
    
    return () => {
      window.removeEventListener('show-location-for-mention', handleShowLocationForMention);
      window.removeEventListener('open-create-mention-from-filter', handleOpenCreateFromFilter);
      window.removeEventListener('show-location-for-mention-edit', handleShowLocationForMentionEdit);
    };
  }, [account, closeAll, openCreate, setCreateTabSelectedLocation, setCreateTabMapMeta, createTabSelectedLocation, createTabMapMeta]);

  // Maintain red pin when create sheet is open - ensures it persists at correct location
  useEffect(() => {
    const isCreateOpen = isModalOpen('create');
    
    // When create form closes, remove marker (unless transitioning)
    if (!isCreateOpen && temporaryMarkerRef.current && !isTransitioningToCreateRef.current) {
      temporaryMarkerRef.current.remove();
      temporaryMarkerRef.current = null;
      return;
    }

    // When create form is open, ensure marker exists at correct location and is red
    if (isCreateOpen && createTabSelectedLocation && mapInstanceRef.current && !(mapInstanceRef.current as any).removed) {
      const { lat, lng } = createTabSelectedLocation;

      // If marker exists, verify it's at correct location and is red
      if (temporaryMarkerRef.current) {
        const currentLngLat = temporaryMarkerRef.current.getLngLat();
        const tolerance = 0.0001;
        const isCorrectLocation = 
          Math.abs(currentLngLat.lng - lng) < tolerance && 
          Math.abs(currentLngLat.lat - lat) < tolerance;
        
        if (!isCorrectLocation) {
          // Update position if marker is at wrong location
          temporaryMarkerRef.current.setLngLat([lng, lat]);
        }
        
        // Ensure marker is red (transform if needed)
        const markerElement = temporaryMarkerRef.current.getElement();
        if (markerElement) {
          const pinDot = markerElement.querySelector('.map-click-pin-dot') as HTMLElement;
          
          if (markerElement && pinDot) {
            // Ensure it's red with white dot
            markerElement.style.backgroundColor = '#ef4444';
            markerElement.style.borderColor = '#ef4444';
            pinDot.style.backgroundColor = '#ffffff';
          }
        }
      }
    }
  }, [isModalOpen('create'), createTabSelectedLocation]);

  // Listen for mention hover events to prevent mention creation
  useEffect(() => {
    const handleMentionHoverStart = (event: Event) => {
      const customEvent = event as CustomEvent<{ mentionId: string; mention: any }>;
      const { mentionId } = customEvent.detail || {};
      if (mentionId) {
        isHoveringMentionRef.current = true;
        hoveredMentionIdRef.current = mentionId;
        // Dispatch event with mention ID for cursor tracker
        window.dispatchEvent(new CustomEvent('mention-hover-update', {
          detail: { mentionId, mention: customEvent.detail?.mention }
        }));
      }
    };

    const handleMentionHoverEnd = () => {
      isHoveringMentionRef.current = false;
      hoveredMentionIdRef.current = null;
      // Dispatch event to clear mention from cursor tracker
      window.dispatchEvent(new CustomEvent('mention-hover-update', {
        detail: { mentionId: null, mention: null }
      }));
    };

    window.addEventListener('mention-hover-start', handleMentionHoverStart);
    window.addEventListener('mention-hover-end', handleMentionHoverEnd);
    return () => {
      window.removeEventListener('mention-hover-start', handleMentionHoverStart);
      window.removeEventListener('mention-hover-end', handleMentionHoverEnd);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainer.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      setMapError('missing-token');
      return;
    }

    const initMap = async () => {
      if (!mounted || !mapContainer.current) return;

      try {
        // @ts-ignore - CSS import
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current || !mounted) return;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER, // Center of Minnesota
          zoom: 7, // Zoomed out to show all of Minnesota
          pitch: 60, // Start at 60 degrees
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
          preserveDrawingBuffer: true, // REQUIRED for canvas.toDataURL() screenshot capture
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            // Dispatch event so parent components know map is loaded
            window.dispatchEvent(new CustomEvent('map-loaded'));
          }
        });

        // Handle single click for location popup
        mapInstance.on('click', async (e: any) => {
          if (!mounted) return;
          
          // Check if click hit a mention layer - those have their own handlers
          const mentionLayers = ['map-mentions-point', 'map-mentions-point-label'];
          const hitRadius = 20;
          const box: [[number, number], [number, number]] = [
            [e.point.x - hitRadius, e.point.y - hitRadius],
            [e.point.x + hitRadius, e.point.y + hitRadius]
          ];
          
          const mapboxMap = mapInstance as any;
          
          // Check if mention layers exist before querying (they may not be loaded yet)
          let mentionFeatures: any[] = [];
          try {
            const existingMentionLayers = mentionLayers.filter(layerId => {
              try {
                return mapboxMap.getLayer(layerId) !== undefined;
              } catch {
                return false;
              }
            });
            
            if (existingMentionLayers.length > 0) {
              mentionFeatures = mapboxMap.queryRenderedFeatures(box, {
                layers: existingMentionLayers,
              });
            }
          } catch (queryError) {
            // Silently continue if query fails (layers don't exist)
          }
          
          // If clicked on a mention, don't show location popup
          if (mentionFeatures.length > 0) {
            return;
          }
          
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          
          // Check if click is within Minnesota bounds
          if (!MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
            // Show error message or silently ignore clicks outside Minnesota
            console.warn('[LiveMap] Click outside Minnesota bounds:', { lat, lng });
            return;
          }
          
          // Check if click hit a layer (county, CTU, state, districts)
          // Layer IDs to check
          const layerIdsToCheck = [
            'county-boundaries-fill',
            'ctu-boundaries-fill',
            'state-boundary-fill',
            'congressional-district-1-fill',
            'congressional-district-2-fill',
            'congressional-district-3-fill',
            'congressional-district-4-fill',
            'congressional-district-5-fill',
            'congressional-district-6-fill',
            'congressional-district-7-fill',
            'congressional-district-8-fill',
          ];
          
          let layerFeature: any = null;
          let layerType: string | null = null;
          
          try {
            // Query all layer features at click point
            const allFeatures = mapboxMap.queryRenderedFeatures(e.point, {
              layers: layerIdsToCheck.filter(id => {
                try {
                  return mapboxMap.getLayer(id) !== undefined;
                } catch {
                  return false;
                }
              }),
            });
            
            if (allFeatures.length > 0) {
              layerFeature = allFeatures[0];
              const layerId = layerFeature.layer.id;
              
              // Determine layer type from layer ID
              if (layerId.startsWith('county-boundaries')) {
                layerType = 'county';
              } else if (layerId.startsWith('ctu-boundaries')) {
                layerType = 'ctu';
              } else if (layerId.startsWith('state-boundary')) {
                layerType = 'state';
              } else if (layerId.startsWith('congressional-district')) {
                layerType = 'district';
                // Extract district number from layer ID (e.g., "congressional-district-1-fill" -> 1)
                const match = layerId.match(/congressional-district-(\d+)/);
                if (match) {
                  layerFeature.properties = layerFeature.properties || {};
                  layerFeature.properties.district_number = parseInt(match[1], 10);
                }
              }
              
              // If we have a layer click, open the popup and still drop a pin
              if (layerType && layerFeature) {
                const props = layerFeature.properties || {};
                const geometry = layerFeature.geometry;
                
                // Calculate color based on layer type and properties
                let layerColor = '#3b82f6'; // Default blue
                
                if (layerType === 'county') {
                  layerColor = '#7ED321'; // Green
                } else if (layerType === 'ctu') {
                  // CTU color based on class
                  const ctuClass = props.ctu_class;
                  if (ctuClass === 'CITY') {
                    layerColor = '#4A90E2'; // Blue
                  } else if (ctuClass === 'TOWNSHIP') {
                    layerColor = '#7ED321'; // Green
                  } else if (ctuClass === 'UNORGANIZED TERRITORY') {
                    layerColor = '#F5A623'; // Orange
                  }
                } else if (layerType === 'state') {
                  layerColor = '#4A90E2'; // Blue
                } else if (layerType === 'district') {
                  // Congressional district colors
                  const districtColors = [
                    '#FF6B6B', // District 1 - Red
                    '#4ECDC4', // District 2 - Teal
                    '#45B7D1', // District 3 - Blue
                    '#96CEB4', // District 4 - Green
                    '#FFEAA7', // District 5 - Yellow
                    '#DDA15E', // District 6 - Orange
                    '#BC6C25', // District 7 - Brown
                    '#6C5CE7', // District 8 - Purple
                  ];
                  const districtNum = props.district_number;
                  layerColor = districtColors[districtNum - 1] || '#888888';
                }
                
                // Fetch full record from database
                const fetchFullRecord = async () => {
                  try {
                    let fullRecord: any = null;
                    
                    if (layerType === 'county' && props.county_id) {
                      const response = await fetch(`/api/civic/county-boundaries?id=${props.county_id}`);
                      if (response.ok) {
                        const data = await response.json();
                        fullRecord = Array.isArray(data) ? data.find((r: any) => r.id === props.county_id) : data;
                      }
                    } else if (layerType === 'ctu' && props.ctu_id) {
                      const response = await fetch(`/api/civic/ctu-boundaries?id=${props.ctu_id}`);
                      if (response.ok) {
                        const data = await response.json();
                        fullRecord = Array.isArray(data) ? data.find((r: any) => r.id === props.ctu_id) : data;
                      }
                    } else if (layerType === 'state') {
                      const response = await fetch('/api/civic/state-boundary');
                      if (response.ok) {
                        fullRecord = await response.json();
                      }
                    } else if (layerType === 'district' && props.district_number) {
                      // For districts, we need to fetch all and find by district_number
                      const response = await fetch('/api/civic/congressional-districts');
                      if (response.ok) {
                        const data = await response.json();
                        fullRecord = Array.isArray(data) ? data.find((r: any) => r.district_number === props.district_number) : null;
                      }
                    }
                    
                    // Use full record if available, otherwise use properties
                    const recordData: Record<string, any> = fullRecord || { ...props };
                    
                    // Determine layer name
                    let layerName = layerType;
                    if (layerType === 'county' && (fullRecord?.county_name || props.county_name)) {
                      layerName = fullRecord?.county_name || props.county_name;
                    } else if (layerType === 'ctu' && (fullRecord?.feature_name || props.feature_name)) {
                      layerName = fullRecord?.feature_name || props.feature_name;
                    } else if (layerType === 'state') {
                      layerName = fullRecord?.name || 'Minnesota State Boundary';
                    } else if (layerType === 'district' && (fullRecord?.district_number || props.district_number)) {
                      layerName = `Congressional District ${fullRecord?.district_number || props.district_number}`;
                    }
                    
                    // Update popup with full record data
                    openLayerRecord({
                      layerType: layerType || 'unknown',
                      layerName: layerName || 'Unknown',
                      geometry,
                      data: recordData,
                      coordinates: { lat, lng },
                      color: layerColor,
                    });
                  } catch (error) {
                    console.error('[LiveMap] Error fetching full record:', error);
                    // Fallback to properties if fetch fails
                    const recordData: Record<string, any> = { ...props };
                    let layerName = layerType;
                    if (layerType === 'county' && props.county_name) {
                      layerName = props.county_name;
                    } else if (layerType === 'ctu' && props.feature_name) {
                      layerName = props.feature_name;
                    } else if (layerType === 'state') {
                      layerName = 'Minnesota State Boundary';
                    } else if (layerType === 'district' && props.district_number) {
                      layerName = `Congressional District ${props.district_number}`;
                    }
                    
                    openLayerRecord({
                      layerType: layerType || 'unknown',
                      layerName: layerName || 'Unknown',
                      geometry,
                      data: recordData,
                      coordinates: { lat, lng },
                      color: layerColor,
                    });
                  }
                };
                
                // Fetch full record asynchronously
                fetchFullRecord();
                
                // Hide create mention form if open
                if (isModalOpen('create')) {
                  closeCreate();
                }
                
                // Still drop a pin at the click location
                // (continue with pin marker code below)
              }
            }
          } catch (layerError) {
            // Silently continue if layer query fails
            console.debug('[LiveMap] Error querying layers:', layerError);
          }
          
          // If a layer was clicked, we've already handled it above
          // Continue to drop pin but don't open create form
          const layerWasClicked = layerType !== null;
          
          if (!layerWasClicked) {
            // Dispatch event for location services popup (manual location input)
            window.dispatchEvent(new CustomEvent('map-location-click', {
              detail: { lat, lng }
            }));
            
            // If waiting for location after camera capture, set location and open create form
            if (waitingForLocation && capturedImageBlob) {
              setCreateTabSelectedLocation({ lat, lng });
              setWaitingForLocation(false);
              // Open create mention popup with captured image and selected location
              openCreate();
              return;
            }
            
            // If Create sheet is open, update the selected location
            if (isModalOpen('create')) {
              setCreateTabSelectedLocation({ lat, lng });
              return;
            }
          }
          
          // Trigger reverse geocode hook
          setClickedCoordinates({ lat, lng });
          
          // Incrementally zoom in on click
          const currentZoom = mapboxMap.getZoom();
          const zoomIncrement = 1.5;
          const targetZoom = Math.min(currentZoom + zoomIncrement, MAP_CONFIG.MAX_ZOOM);
          
          // Only zoom if we haven't reached max zoom
          if (targetZoom > currentZoom) {
            mapboxMap.flyTo({
              center: [lng, lat],
              zoom: targetZoom,
              duration: 1000,
              essential: true,
            });
          }
          
          // Capture mapbox feature at click point for map_meta
          // Structure matches FloatingMapContainer: { location: LocationData | null, feature: ExtractedFeature | null }
          let mapMeta: Record<string, any> | null = null;
          try {
            const point = mapboxMap.project([lng, lat]);
            const result = queryFeatureAtPoint(mapboxMap, point, 'labels-first', false);
            if (result) {
              // queryFeatureAtPoint with returnRaw=false returns ExtractedFeature directly
              const extractedFeature = 'feature' in result ? result.feature : result;
              if (extractedFeature && 'layerId' in extractedFeature) {
                mapMeta = {
                  location: null, // Location data not available in LiveMap context
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
            console.debug('[LiveMap] Error capturing map feature:', err);
          }
          
          // Show location select popup (address will be set via reverse geocode hook)
          setLocationSelectPopup({
            isOpen: true,
            lat,
            lng,
            address: null, // Will be updated when reverse geocode completes
            mapMeta: mapMeta,
            mentionTypeId: waitingForLocationWithMentionType.active ? waitingForLocationWithMentionType.mentionTypeId : null,
            mentionTypeName: waitingForLocationWithMentionType.active ? waitingForLocationWithMentionType.mentionTypeName : null,
          });
          
          // Clear waiting state after location is selected
          if (waitingForLocationWithMentionType.active) {
            setWaitingForLocationWithMentionType({ active: false, mentionTypeId: null, mentionTypeName: null });
          }
        });


        mapInstance.on('error', (e: unknown) => {
          const errorMessage = e instanceof Error 
            ? e.message 
            : typeof e === 'object' && e !== null && 'error' in e
            ? String((e as any).error)
            : typeof e === 'string'
            ? e
            : 'Unknown map error';
          
          console.error('[LiveMap] Map error:', errorMessage);
          if (mounted) {
            setMapError('load-error');
          }
        });
      } catch (err) {
        console.error('Failed to initialize map:', err);
        if (mounted) {
          setMapError('init-error');
        }
      }
    };

    initMap();

    return () => {
      mounted = false;
      // Remove temporary marker on cleanup
      if (temporaryMarkerRef.current) {
        try {
          temporaryMarkerRef.current.remove();
        } catch {
          // Ignore cleanup errors
        }
        temporaryMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        try {
          if (!mapInstanceRef.current.removed) {
            mapInstanceRef.current.remove();
          }
        } catch {
          // Ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      className="relative w-full h-full overflow-hidden flex"
      style={{ minHeight: 0, height: '100%', width: '100%' }}
    >
        {/* Map and other components - no sidebar */}
        <div className="flex-1 flex relative overflow-hidden w-full h-full" style={{ minHeight: 0, minWidth: 0, height: '100%', width: '100%' }}>
          {/* Top Controls - Loading, Filters, Reload */}
          <div className="absolute top-4 left-4 right-4 z-40 pointer-events-none">
            <div className="pointer-events-auto space-y-2">
              {/* Selected Mention Type Filters */}
              {!isLoadingMentions && selectedMentionTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  {selectedMentionTypes.map((type) => (
                    <div
                      key={type.id}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-xs border whitespace-nowrap bg-white border-gray-200 text-gray-700"
                    >
                      <span className="text-base flex-shrink-0">{type.emoji}</span>
                      <span className="font-medium leading-none">{type.name}</span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveType(type.slug);
                        }}
                        className="hover:opacity-70 transition-opacity flex items-center justify-center flex-shrink-0 leading-none ml-0.5 text-gray-500"
                        aria-label={`Remove ${type.name} filter`}
                      >
                        <XCircleIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Reload Mentions Button */}
              {mentionsLayerHidden && currentMapStyle !== 'satellite' && (
                <button
                  onClick={handleReloadMentions}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 border-2 border-red-500 bg-white hover:bg-red-50 text-gray-900"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  Reload mentions
                </button>
              )}
            </div>
          </div>

          {/* Mapbox Container */}
          <div 
            ref={mapContainer} 
            className="absolute inset-0 w-full h-full"
            style={{ 
              margin: 0, 
              padding: 0, 
              overflow: 'hidden', 
              zIndex: 1,
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

          {/* Mentions Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <MentionsLayer 
              key={mentionsRefreshKey} 
              map={mapInstanceRef.current} 
              mapLoaded={mapLoaded}
              onLoadingChange={setIsLoadingMentions}
              selectedMentionId={selectedMentionId}
            />
          )}

          {/* Custom Mention Button - Show when single mention type is filtered */}
          {selectedMentionTypes.length === 1 && (
            <CustomMentionButton
              mentionTypeName={selectedMentionTypes[0].name}
              mentionTypeEmoji={selectedMentionTypes[0].emoji}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-create-mention-from-filter'));
              }}
            />
          )}

          {/* Congressional Districts Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <CongressionalDistrictsLayer
              map={mapInstanceRef.current}
              mapLoaded={mapLoaded}
              visible={showDistricts}
              onDistrictHover={setHoveredDistrict}
            />
          )}

          {/* Government Buildings Layer */}

          {/* CTU Boundaries Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <CTUBoundariesLayer
              map={mapInstanceRef.current}
              mapLoaded={mapLoaded}
              visible={showCTU}
              onCTUHover={setHoveredCTU}
            />
          )}

          {/* State Boundary Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <StateBoundaryLayer
              map={mapInstanceRef.current}
              mapLoaded={mapLoaded}
              visible={showStateBoundary}
              onStateHover={setHoveredState}
            />
          )}

          {/* County Boundaries Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <CountyBoundariesLayer
              map={mapInstanceRef.current}
              mapLoaded={mapLoaded}
              visible={showCountyBoundaries}
              onCountyHover={setHoveredCounty}
            />
          )}

          {/* Loading/Error Overlay */}
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
              <div className="text-center">
                {mapError === 'missing-token' ? (
                  <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                    <div className="text-red-600 font-bold text-lg mb-2">⚠️ Mapbox Token Missing</div>
                    <div className="text-gray-700 text-sm mb-4">
                      Please set <code className="bg-gray-100 px-2 py-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in your <code className="bg-gray-100 px-2 py-1 rounded text-xs">.env.local</code> file.
                    </div>
                  </div>
                ) : mapError ? (
                  <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                    <div className="text-red-600 font-bold text-lg mb-2">⚠️ Map Error</div>
                    <div className="text-gray-700 text-sm mb-4">
                      Failed to initialize the map. Check browser console for details.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <div className="text-white font-medium">Loading map...</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={isModalOpen('camera')}
        onClose={() => {
          closeCamera();
          // Only clear image state if we're not waiting for location (user manually closed)
          if (!waitingForLocation) {
            setCapturedImageBlob(null);
            setCapturedImagePreview(null);
            setWaitingForLocation(false);
          }
        }}
        onImageCaptured={(blob) => {
          console.log('[LiveMap] Image captured from camera, blob size:', blob.size);
          setCapturedImageBlob(blob);
          
          // Create preview URL for display
          const reader = new FileReader();
          reader.onloadend = () => {
            setCapturedImagePreview(reader.result as string);
            
            // If create mention form is already open with coordinates, send media directly to it
            // Otherwise, wait for location selection
            if (isModalOpen('create') && createTabSelectedLocation) {
              // Form is open with location - media will be passed via initialImageBlob prop
              // Don't set waitingForLocation, just close camera modal
              closeCamera();
              console.log('[LiveMap] Image preview created, sending to open create mention form');
            } else {
              // Form not open or no location - wait for location selection
              setWaitingForLocation(true);
              closeCamera();
              console.log('[LiveMap] Image preview created, waiting for location selection');
            }
          };
          reader.readAsDataURL(blob);
        }}
      />



      {/* Modals are now handled by LivePageLayout wrapper */}

      {/* Location Permission Modal */}
      <LocationPermissionModal
        isOpen={isModalOpen('locationPermission')}
        onClose={closeLocationPermission}
        onAllow={handleLocationPermissionAllow}
      />



      {/* Location Select Popup - Shows when user clicks on map */}
      <LocationSelectPopup
        isOpen={locationSelectPopup.isOpen}
        onClose={() => {
          setLocationSelectPopup({ 
            isOpen: false, 
            lat: 0, 
            lng: 0, 
            address: null, 
            mapMeta: null,
            mentionTypeId: null,
            mentionTypeName: null,
          });
          setClickedCoordinates(null);
        }}
        lat={locationSelectPopup.lat}
        lng={locationSelectPopup.lng}
        address={locationSelectPopup.address || reverseGeocodeAddress}
        mapMeta={locationSelectPopup.mapMeta}
        mentionTypeId={locationSelectPopup.mentionTypeId}
        mentionTypeName={locationSelectPopup.mentionTypeName}
        onAddToMap={(coordinates, mapMeta, mentionTypeId) => {
          // Set location state and open create form inline
          setCreateTabSelectedLocation(coordinates);
          setCreateTabMapMeta(mapMeta || null);
          closeAll();
          openCreate({ lat: coordinates.lat, lng: coordinates.lng, map_meta: mapMeta });
        }}
      />

      {/* Create Popup - Only opened via "Add Label" button */}
      <CreateMentionPopup
        isOpen={isModalOpen('create') && !isAccountModalOpen}
        onClose={() => {
          closeCreate();
          setCreateTabSelectedLocation(null);
          setCreateTabMapMeta(null);
          setCreateTabFullAddress(null);
          setCapturedImageBlob(null);
          setCapturedImagePreview(null);
          setWaitingForLocation(false);
          // Remove temporary marker when create popup closes
          if (temporaryMarkerRef.current) {
            temporaryMarkerRef.current.remove();
            temporaryMarkerRef.current = null;
          }
        }}
        isEditMode={modal?.data?.isEditMode || false}
        editData={modal?.data?.editData || null}
            map={mapInstanceRef.current}
            mapLoaded={mapLoaded}
            initialCoordinates={createTabSelectedLocation}
            initialMapMeta={createTabMapMeta}
            initialFullAddress={createTabFullAddress}
            initialImageBlob={capturedImageBlob}
        onMentionCreated={() => {
              closeCreate();
              setCreateTabSelectedLocation(null);
          setCreateTabMapMeta(null);
          setCreateTabFullAddress(null);
              // Clear captured image state after mention is created
              setCapturedImageBlob(null);
              setCapturedImagePreview(null);
              setWaitingForLocation(false);
              setMentionsRefreshKey(prev => prev + 1);
            }}
          />

      {/* Unified Mention Location Sheet - Shows when clicking mention or location on map */}
      <MentionLocationSheet
        isOpen={isMentionSheetOpen && (selectedMentionForSheet !== null || locationDataForSheet !== null)}
        onClose={() => {
          setIsMentionSheetOpen(false);
          setSelectedMentionForSheet(null);
          setLocationDataForSheet(null);
          // Only remove red pin marker when sheet closes if we're not transitioning to create
          if (temporaryMarkerRef.current && !isTransitioningToCreateRef.current && !isModalOpen('create')) {
            temporaryMarkerRef.current.remove();
            temporaryMarkerRef.current = null;
          }
        }}
        selectedMention={selectedMentionForSheet}
        locationData={locationDataForSheet}
        type={sheetType}
        radius={0.5} // 500 meters radius
        onMentionSelect={(mentionId, lat, lng) => {
          // Dispatch event to update URL and open mention sheet
          window.dispatchEvent(new CustomEvent('select-mention', {
            detail: { mentionId, lat, lng }
          }));
        }}
      />

      {/* Layer Record Popup */}
      <LayerRecordPopup
        isOpen={isModalOpen('layerRecord')}
        onClose={closeLayerRecord}
        record={modal.type === 'layerRecord' ? modal.data : null}
        onAddMention={(coordinates) => {
          closeLayerRecord();
          setCreateTabSelectedLocation(coordinates);
          openCreate();
        }}
      />

      {/* Congressional District Hover Info - Right Side */}
      <CongressionalDistrictHoverInfo
        district={hoveredDistrict}
      />

      {/* CTU Hover Info - Right Side */}
      <CTUHoverInfo
        ctu={hoveredCTU}
      />

      {/* County Hover Info - Right Side */}
      <CountyHoverInfo
        county={hoveredCounty}
      />



      {/* Onboarding Demo - 3-step walkthrough */}
      <OnboardingDemo
        map={mapInstanceRef.current}
        mapLoaded={mapLoaded}
      />

      {/* Visitor Stats */}

      {/* Modals handled globally via AppModalContext/GlobalModals */}
    </div>
  );
}

