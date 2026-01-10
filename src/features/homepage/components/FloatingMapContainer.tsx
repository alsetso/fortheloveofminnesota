'use client';

import { useState, useCallback, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { XMarkIcon, MagnifyingGlassIcon, Cog6ToothIcon, InformationCircleIcon, MapPinIcon, FingerPrintIcon, Square3Stack3DIcon, SparklesIcon, BuildingOffice2Icon, ExclamationTriangleIcon, AcademicCapIcon, SunIcon, GlobeAmericasIcon, ChevronDownIcon, ChevronUpIcon, WrenchScrewdriverIcon, ArrowPathIcon, HomeIcon, HeartIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { MentionService } from '@/features/mentions/services/mentionService';
import { LocationLookupService } from '@/features/map/services/locationLookupService';
import type { CreateMentionData } from '@/types/mention';
import { MAP_CONFIG } from '@/features/map/config';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import type { MapboxMapInstance, MapboxMouseEvent } from '@/types/mapbox-events';
import { findCityByName, findCountyByName, updateCityCoordinates } from '@/features/atlas/services/atlasService';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { supabase } from '@/lib/supabase';
import { useWindowManager } from '@/components/ui/WindowManager';
import {
  useFeatureTracking,
  FeatureCard,
  queryFeatureAtPoint,
  type ExtractedFeature,
  CATEGORY_CONFIG,
} from '@/features/map-metadata';

// NOTE: Feature categorization is now handled by src/features/map-metadata/services/featureService.ts

const ATLAS_ICON_MAP: Record<string, string> = {
  cities: '/city.png',
  lakes: '/lakes.png',
  parks: '/park_like.png',
  schools: '/education.png',
  neighborhoods: '/neighborhood.png',
  churches: '/churches.png',
  hospitals: '/hospital.png',
  golf_courses: '/golf courses.png',
  municipals: '/municiples.png',
};

const ATLAS_ENTITY_LABELS: Record<string, string> = {
  cities: 'City',
  lakes: 'Lake',
  parks: 'Park',
  schools: 'School',
  neighborhoods: 'Neighborhood',
  churches: 'Church',
  hospitals: 'Hospital',
  golf_courses: 'Golf Course',
  municipals: 'Municipal',
};

interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  relevance: number;
  properties: {
    accuracy?: string;
  };
  text: string;
  place_name: string;
  center: [number, number];
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  context?: Array<{
    id: string;
    short_code?: string;
    text: string;
  }>;
}

interface LocationData {
  coordinates: { lat: number; lng: number };
  placeName?: string;
  address?: string;
  street?: string;
  type?: 'map-click' | 'pin-click' | 'search';
  // Primary place (city/town from Mapbox)
  city?: string;
  cityId?: string;
  citySlug?: string;
  cityHasCoordinates?: boolean; // Whether the city in our DB has lat/lng set
  // Locality (village, township, settlement - sub-city areas)
  locality?: string;
  localityType?: 'village' | 'township' | 'settlement' | 'hamlet' | 'suburb' | 'locality';
  // Neighborhood (subdivision within a city)
  neighborhood?: string;
  // Parent city info (when location is in a locality/neighborhood that belongs to a larger city)
  parentCity?: string;
  parentCityId?: string;
  parentCitySlug?: string;
  // County/State/Zip
  county?: string;
  countyId?: string;
  countySlug?: string;
  state?: string;
  postalCode?: string;
}


// FeatureMetadata is now imported from map-metadata feature as ExtractedFeature

interface LocationSidebarProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  isOpen?: boolean;
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  onPinClick?: (pinData: { id: string; name: string; coordinates: { lat: number; lng: number }; address?: string; description?: string }) => void;
  selectedAtlasEntity?: {
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
  } | null;
  onAtlasEntityClear?: () => void;
}

export default function LocationSidebar({ 
  map, 
  mapLoaded,
  isOpen = true,
  onLocationSelect,
  onPinClick,
  selectedAtlasEntity: propSelectedAtlasEntity,
  onAtlasEntityClear,
}: LocationSidebarProps) {
  // Feature flag: Show location details accordion (hidden but logic preserved)
  const SHOW_LOCATION_DETAILS = false;
  
  // Auth state - use isLoading to ensure auth is initialized before making decisions
  const { user, account, isLoading: authLoading } = useAuthStateSafe();
  const { openWelcome, openOnboarding, openAccount } = useAppModalContextSafe();
  
  // Ref to access current auth state in event handlers (avoids stale closures)
  const userRef = useRef(user);
  const accountRef = useRef(account);
  const authLoadingRef = useRef(authLoading);
  
  // Inline pin creation form state (declared early for use in useEffect)
  const [isDropHeartExpanded, setIsDropHeartExpanded] = useState(false);
  
  useEffect(() => {
    userRef.current = user;
    accountRef.current = account;
    authLoadingRef.current = authLoading;
  }, [user, account, authLoading]);
  
  // Listen for live account modal open/close to close mention form
  useEffect(() => {
    const handleAccountModalChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isOpen: boolean }>;
      const isOpen = customEvent.detail?.isOpen || false;
      
      // Close mention form when account modal opens
      if (isOpen && isDropHeartExpanded) {
        setIsDropHeartExpanded(false);
      }
    };

    window.addEventListener('live-account-modal-change', handleAccountModalChange);
    return () => {
      window.removeEventListener('live-account-modal-change', handleAccountModalChange);
    };
  }, [isDropHeartExpanded]);
  
  const { openWindow } = useWindowManager();
  const router = useRouter();

  // ═══════════════════════════════════════════════════════════════════════════
  // Local Selection State (not in URL)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [capturedFeature, setCapturedFeature] = useState<ExtractedFeature | null>(null);
  
  const pinFeature = useMemo(() => {
    if (locationData) {
      return capturedFeature;
    }
    return null;
  }, [locationData, capturedFeature]);

  const setPinFeature = useCallback((data: ExtractedFeature | null) => {
    setCapturedFeature(data);
  }, []);

  const clearSelection = useCallback(() => {
    setLocationData(null);
    setCapturedFeature(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Local Modal State (not in URL)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  
  const [comingSoonFeature, setComingSoonFeature] = useState<string>('');

  // Modal openers
  const openComingSoonModal = useCallback((feature: string) => {
    setComingSoonFeature(feature);
    setIsComingSoonModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsComingSoonModalOpen(false);
  }, []);


  // ═══════════════════════════════════════════════════════════════════════════
  // Local UI State (not in URL)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // Single state for active panel - only one can be open at a time
  const [activePanel, setActivePanel] = useState<'none'>('none');
  const [is3DMode, setIs3DMode] = useState(true); // Default to 3D
  const [showRoadLabels, setShowRoadLabels] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentUserAccountId, setCurrentUserAccountId] = useState<string | null>(null);
  const [currentUserPlan, setCurrentUserPlan] = useState<'hobby' | 'pro' | 'plus'>('hobby');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminToolsOpen, setIsAdminToolsOpen] = useState(false);
  const [isUpdatingCityCoords, setIsUpdatingCityCoords] = useState(false);
  const [cityUpdateMessage, setCityUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreatingLake, setIsCreatingLake] = useState(false);
  const [lakeCreateMessage, setLakeCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreatingPark, setIsCreatingPark] = useState(false);
  const [parkCreateMessage, setParkCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isLocationDetailsExpanded, setIsLocationDetailsExpanded] = useState(false);
  const [isAtlasEntityOpen, setIsAtlasEntityOpen] = useState(false);
  const [isAtlasEntityRawOpen, setIsAtlasEntityRawOpen] = useState(false);
  
  // Atlas entity state
  const [atlasEntityData, setAtlasEntityData] = useState<Record<string, any> | null>(null);
  const [atlasEntityTableName, setAtlasEntityTableName] = useState<string | null>(null);
  const [atlasEntityTypeData, setAtlasEntityTypeData] = useState<Record<string, any> | null>(null);
  const [atlasEntityLoading, setAtlasEntityLoading] = useState(false);
  const [atlasEntityError, setAtlasEntityError] = useState<string | null>(null);
  
  // Visible atlas entities in viewport (for "Near me" section)
  const [visibleAtlasEntities, setVisibleAtlasEntities] = useState<Array<{
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
  }>>([]);
  const [isLoadingVisibleAtlas, setIsLoadingVisibleAtlas] = useState(false);
  
  const [pinDescription, setPinDescription] = useState('');
  const [pinSelectedFile, setPinSelectedFile] = useState<File | null>(null);
  const [pinEventMonth, setPinEventMonth] = useState<string>('');
  const [pinEventDay, setPinEventDay] = useState<string>('');
  const [pinEventYear, setPinEventYear] = useState<string>('');
  const [showPostDateInput, setShowPostDateInput] = useState(false);
  
  const [pinFilePreview, setPinFilePreview] = useState<string | null>(null);
  const [pinVisibility, setPinVisibility] = useState<'public' | 'only_me'>('public');
  const [pinHideLocation, setPinHideLocation] = useState(false);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);
  const [isPinUploading, setIsPinUploading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [showCameraTooltip, setShowCameraTooltip] = useState(false);
  const pinFileInputRef = useRef<HTMLInputElement>(null);
  
  // Feature tracking hook - handles click feature capture
  const {
    clickFeature: hookClickFeature,
    clearClickFeature,
  } = useFeatureTracking(map, mapLoaded, { throttleMs: 50 });
  
  // Sync hook's captured click feature to our state
  // This ensures we use the ref-based capture (always current) rather than stale state
  useEffect(() => {
    if (hookClickFeature) {
      setCapturedFeature(hookClickFeature);
    }
  }, [hookClickFeature]);

  // Reset pin form when location changes (but preserve expansion if user is authenticated)
  const previousCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    const currentCoords = locationData?.coordinates;
    const prevCoords = previousCoordinatesRef.current;
    
    // Check if coordinates actually changed
    const coordsChanged = prevCoords && currentCoords && 
      (prevCoords.lat !== currentCoords.lat || prevCoords.lng !== currentCoords.lng);
    
    if (coordsChanged && isDropHeartExpanded) {
      // Reset form fields but keep form expanded if user is authenticated
      setPinDescription('');
      setPinSelectedFile(null);
      setPinFilePreview(null);
      setPinVisibility('public');
      setPinError(null);
    } else if (!currentCoords && isDropHeartExpanded) {
      // Location cleared - collapse form
      setIsDropHeartExpanded(false);
      setPinDescription('');
      setPinSelectedFile(null);
      setPinFilePreview(null);
      setPinVisibility('public');
      setPinError(null);
    }
    
    // Update previous coordinates
    previousCoordinatesRef.current = currentCoords || null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData?.coordinates?.lat, locationData?.coordinates?.lng, isDropHeartExpanded]);

  // Auto-expand mention form when location is set and user is authenticated
  useEffect(() => {
    if (locationData?.coordinates && user && !isDropHeartExpanded) {
      setIsDropHeartExpanded(true);
    }
  }, [locationData?.coordinates, user, isDropHeartExpanded]);

  // Abort controller for canceling in-flight atlas entity fetches
  const atlasEntityAbortControllerRef = useRef<AbortController | null>(null);
  
  // Function to process atlas entity event (extracted for reuse)
  const processAtlasEntityEvent = useCallback((eventData: { id: string; name: string; table_name: string; lat: number; lng: number }) => {
    // Store atlas entity coordinates
    atlasEntityCoordinatesRef.current = {
      lat: eventData.lat,
      lng: eventData.lng,
    };
    
    // Set location data for the clicked atlas entity
    setLocationData({
      coordinates: {
        lat: eventData.lat,
        lng: eventData.lng,
      },
      address: eventData.name,
      placeName: eventData.name,
      type: 'map-click', // Mark as map-click to distinguish from search
    });
    
    // Expand the form to show atlas meta
    setIsDropHeartExpanded(true);
    
    // Reset accordion states
    setIsAtlasEntityOpen(false);
    setIsAtlasEntityRawOpen(false);
    setIsMetadataOpen(false);
    
    // Create new abort controller for this fetch
    const abortController = new AbortController();
    atlasEntityAbortControllerRef.current = abortController;
    
    // Fetch entity data
    const fetchEntityData = async () => {
      setAtlasEntityLoading(true);
      setAtlasEntityError(null);
      
      try {
        const response = await fetch(`/api/atlas/${eventData.table_name}/${eventData.id}`, {
          signal: abortController.signal,
        });
        
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch ${eventData.table_name} entity`);
        }
        
        const data = await response.json();
        
        // Check again if request was aborted before setting state
        if (abortController.signal.aborted) {
          return;
        }
        
        setAtlasEntityData(data);
        setAtlasEntityTableName(eventData.table_name);
        console.log('[FloatingMapContainer] Entity data fetched:', data);
        console.log('[FloatingMapContainer] Table name:', eventData.table_name);
        
        // Fetch atlas_types metadata for this table
        try {
          console.log('[FloatingMapContainer] Fetching atlas type for slug:', eventData.table_name);
          const { data: typeData, error: typeError } = await (supabase as any)
            .schema('atlas')
            .from('atlas_types')
            .select('*')
            .eq('slug', eventData.table_name)
            .single();
          
          console.log('[FloatingMapContainer] Atlas type fetch result:', { typeData, typeError });
          
          if (!typeError && typeData) {
            setAtlasEntityTypeData(typeData);
            console.log('[FloatingMapContainer] Atlas type data set:', typeData);
          } else {
            console.warn('[FloatingMapContainer] No atlas type data found or error:', typeError);
            setAtlasEntityTypeData(null);
          }
        } catch (err) {
          console.error('[FloatingMapContainer] Error fetching atlas type:', err);
          setAtlasEntityTypeData(null);
        }
      } catch (err) {
        // Don't set error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        
        console.error('[FloatingMapContainer] Error fetching atlas entity:', err);
        setAtlasEntityError(err instanceof Error ? err.message : 'Failed to load entity data');
        setAtlasEntityData(null);
        setAtlasEntityTableName(null);
        setAtlasEntityTypeData(null);
        setIsAtlasEntityOpen(false);
        setIsAtlasEntityRawOpen(false);
        atlasEntityCoordinatesRef.current = null;
      } finally {
        // Only update loading state if this is still the active request
        if (!abortController.signal.aborted) {
          setAtlasEntityLoading(false);
        }
      }
    };
    
    fetchEntityData();
  }, []);
  
  // Process selected atlas entity from props
  useEffect(() => {
    if (propSelectedAtlasEntity) {
      processAtlasEntityEvent(propSelectedAtlasEntity);
    } else {
      // Clear when entity is deselected
      setAtlasEntityData(null);
      setAtlasEntityTableName(null);
      setAtlasEntityTypeData(null);
      setAtlasEntityError(null);
      setIsAtlasEntityOpen(false);
      setIsAtlasEntityRawOpen(false);
      atlasEntityCoordinatesRef.current = null;
    }
  }, [propSelectedAtlasEntity, processAtlasEntityEvent]);

  // Store atlas entity coordinates to track when location changes
  const atlasEntityCoordinatesRef = useRef<{ lat: number; lng: number } | null>(null);

  // Clear atlas entity data when location changes to a different location (not from atlas pin)
  useEffect(() => {
    if (locationData && atlasEntityCoordinatesRef.current && atlasEntityData) {
      const { lat, lng } = locationData.coordinates;
      const atlasCoords = atlasEntityCoordinatesRef.current;
      
      // Check if coordinates have changed (with small tolerance for floating point)
      const coordsChanged = 
        Math.abs(lat - atlasCoords.lat) > 0.0001 || 
        Math.abs(lng - atlasCoords.lng) > 0.0001;
      
      // Only clear if location changed AND it's not from an atlas entity click
      // (atlas entity clicks set locationData with the same coordinates, so we check type)
      if (coordsChanged && locationData.type !== 'map-click') {
        // Location changed to a different place (via search, etc.) - clear atlas entity data
        if (atlasEntityAbortControllerRef.current) {
          atlasEntityAbortControllerRef.current.abort();
          atlasEntityAbortControllerRef.current = null;
        }
        setAtlasEntityData(null);
        setAtlasEntityTableName(null);
        setAtlasEntityTypeData(null);
        setIsAtlasEntityOpen(false);
        setIsAtlasEntityRawOpen(false);
        atlasEntityCoordinatesRef.current = null;
      }
    }
  }, [locationData?.coordinates?.lat, locationData?.coordinates?.lng, locationData?.type, atlasEntityData]);


  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const spinAnimationRef = useRef<number | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const temporaryMarkerRef = useRef<any>(null);
  const autofillCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use active account from context
  const { account: activeAccount, activeAccountId } = useAuthStateSafe();

  // Update account info when active account changes
  useEffect(() => {
    if (activeAccount) {
      setCurrentUserAccountId(activeAccount.id);
      setCurrentUserPlan((activeAccount.plan as 'hobby' | 'pro' | 'plus') || 'hobby');
      setIsAdmin(activeAccount.role === 'admin');
    } else if (!user) {
      setCurrentUserAccountId(null);
      setCurrentUserPlan('hobby');
      setIsAdmin(false);
    }
  }, [activeAccount, user, setCurrentUserAccountId, setCurrentUserPlan, setIsAdmin]);

  // Add/remove temporary pin marker
  const addTemporaryPin = useCallback(async (coordinates: { lat: number; lng: number }) => {
    if (!map || !mapLoaded || map.removed) return;

    try {
      const mapbox = await loadMapboxGL();

      // Remove existing temporary marker if any
      if (temporaryMarkerRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }

      // Create temporary marker element with heart image in red pulsing circle
      const el = document.createElement('div');
      el.className = 'temporary-pin-marker';
      
      // Add pulsing animation style
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse-red {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        .temporary-pin-marker {
          animation: pulse-red 1.5s ease-in-out infinite;
        }
      `;
      if (!document.head.querySelector('#temporary-pin-marker-style')) {
        style.id = 'temporary-pin-marker-style';
        document.head.appendChild(style);
      }
      
      el.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #ef4444;
        border: 2px solid white;
        cursor: pointer;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      `;

      const img = document.createElement('img');
      img.src = '/heart.png';
      img.style.cssText = `
        width: 12px;
        height: 12px;
        object-fit: contain;
        filter: brightness(0) invert(1);
      `;
      el.appendChild(img);

      // Create marker
      const marker = new mapbox.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(map as any);

      temporaryMarkerRef.current = marker;
    } catch (err) {
      console.error('Error creating temporary pin:', err);
    }
  }, [map, mapLoaded]);

  const removeTemporaryPin = useCallback(() => {
    if (temporaryMarkerRef.current) {
      temporaryMarkerRef.current.remove();
      temporaryMarkerRef.current = null;
    }
  }, []);

  // Update temporary pin color based on visibility (no-op since we use heart image)
  const updateTemporaryPinColor = useCallback((visibility: 'public' | 'only_me') => {
    // Heart image doesn't change based on visibility
  }, []);

  // Update temporary pin color when visibility changes in inline form
  useEffect(() => {
    updateTemporaryPinColor(pinVisibility);
  }, [pinVisibility, updateTemporaryPinColor]);

  // Search for locations using Mapbox Geocoding API
  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const token = MAP_CONFIG.MAPBOX_TOKEN;
      if (!token) {
        throw new Error('Mapbox token not configured');
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
      const params = new URLSearchParams({
        access_token: token,
        country: 'us',
        bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
        types: 'address,poi,place',
        limit: '8',
        proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        throw new Error('Location search failed');
      }

      const data = await response.json();
      const filteredFeatures = (data.features || []).filter((feature: MapboxFeature) => {
        const context = feature.context || [];
        const stateContext = context.find((c: { id?: string }) => c.id && c.id.startsWith('region.'));
        return stateContext && (
          stateContext.short_code === 'US-MN' ||
          stateContext.text === 'Minnesota'
        );
      });

      setSuggestions(filteredFeatures);
      setShowSuggestions(filteredFeatures.length > 0);
    } catch (error) {
      console.error('Location search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  }, [searchLocations]);

  // Detect browser autofill and clear input
  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) return;

    let lastKnownValue = searchQuery;
    let isUserInput = false;

    const checkAndClearAutofill = () => {
      // If input has a value that doesn't match our state and user didn't type it, clear it
      if (input.value && input.value !== lastKnownValue && !isUserInput) {
        setSearchQuery('');
        input.value = '';
        lastKnownValue = '';
      }
      isUserInput = false;
    };

    const handleFocus = () => {
      isUserInput = false;
      lastKnownValue = input.value || '';
      // Check after a short delay to allow autofill to complete
      setTimeout(checkAndClearAutofill, 200);
    };

    const handleInput = () => {
      isUserInput = true;
      lastKnownValue = input.value;
    };

    const handleKeyDown = () => {
      isUserInput = true;
    };

    input.addEventListener('focus', handleFocus);
    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeyDown);

    return () => {
      input.removeEventListener('focus', handleFocus);
      input.removeEventListener('input', handleInput);
      input.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchQuery]);


  // Handle suggestion select
  const handleSuggestionSelect = useCallback(async (feature: MapboxFeature) => {
    const coordinates = {
      lat: feature.center[1],
      lng: feature.center[0],
    };

    // Clear search input immediately
    setSearchQuery('');
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Extract location hierarchy from feature context
    let city: string | undefined;
    let locality: string | undefined;
    let localityType: LocationData['localityType'];
    let neighborhood: string | undefined;
    let county: string | undefined;
    let state: string | undefined;
    let postalCode: string | undefined;
    let cityId: string | undefined;
    let citySlug: string | undefined;
    let cityHasCoordinates = false;
    
    // Check if the feature itself is a place type
    const placeTypes = feature.place_type || [];
    if (placeTypes.includes('place')) {
      city = feature.text;
    } else if (placeTypes.includes('locality')) {
      locality = feature.text;
      const lower = (feature.text || '').toLowerCase();
      if (lower.includes('township') || lower.endsWith(' twp')) {
        localityType = 'township';
      } else if (lower.includes('village')) {
        localityType = 'village';
      } else {
        localityType = 'locality';
      }
    } else if (placeTypes.includes('neighborhood')) {
      neighborhood = feature.text;
    }
    
    // Parse context for hierarchy
    if (feature.context) {
      for (const ctx of feature.context) {
        const ctxId = ctx.id || '';
        if (ctxId.startsWith('place.') && !city) {
          city = ctx.text;
        } else if (ctxId.startsWith('locality.') && !locality) {
          locality = ctx.text;
          const lower = (ctx.text || '').toLowerCase();
          if (lower.includes('township') || lower.endsWith(' twp')) {
            localityType = 'township';
          } else if (lower.includes('village')) {
            localityType = 'village';
          } else {
            localityType = 'locality';
          }
        } else if (ctxId.startsWith('neighborhood.') && !neighborhood) {
          neighborhood = ctx.text;
        } else if (ctxId.startsWith('district.')) {
          county = ctx.text;
        } else if (ctxId.startsWith('region.')) {
          state = ctx.text;
        } else if (ctxId.startsWith('postcode.')) {
          postalCode = ctx.text;
        }
      }
    }
    
    // Look up city in our database
    if (city) {
      try {
        const cityData = await findCityByName(city);
        if (cityData) {
          cityId = cityData.id;
          citySlug = cityData.slug;
          cityHasCoordinates = !!(cityData.lat && cityData.lng);
        }
      } catch (err) {
        // City lookup failed
      }
    }
    // If no city but locality exists, check if locality is in our DB
    if (!cityId && locality) {
      try {
        const localityData = await findCityByName(locality);
        if (localityData) {
          cityId = localityData.id;
          citySlug = localityData.slug;
          cityHasCoordinates = !!(localityData.lat && localityData.lng);
        }
      } catch (err) {
        // Locality lookup failed
      }
    }

    // If we have both locality/neighborhood and city, and the city matched, set parent info
    // The city becomes the parent, locality/neighborhood is the primary identifier
    let parentCity: string | undefined;
    let parentCityId: string | undefined;
    let parentCitySlug: string | undefined;
    let showCityAsPrimary = true;
    
    if (city && (locality || neighborhood)) {
      if (cityId) {
        // City matched in our DB, show it as parent instead of primary
        parentCity = city;
        parentCityId = cityId;
        parentCitySlug = citySlug;
        showCityAsPrimary = false;
      }
    }

    // Look up county in our database
    let countyId: string | undefined;
    let countySlug: string | undefined;
    if (county) {
      try {
        const countyData = await findCountyByName(county);
        if (countyData) {
          countyId = countyData.id;
          countySlug = countyData.slug;
        }
      } catch (err) {
        // County lookup failed
      }
    }

    // Create location data and update cache
    const newLocationData: LocationData = {
      coordinates,
      placeName: feature.place_name,
      address: feature.place_name,
      type: 'search',
      // City info - only if it's the primary (no locality/neighborhood present)
      city: showCityAsPrimary ? city : undefined,
      cityId: showCityAsPrimary ? cityId : undefined,
      citySlug: showCityAsPrimary ? citySlug : undefined,
      cityHasCoordinates: showCityAsPrimary ? cityHasCoordinates : false,
      locality,
      localityType,
      neighborhood,
      // Parent city (when location is in a sub-area of a city)
      parentCity,
      parentCityId,
      parentCitySlug,
      county,
      countyId,
      countySlug,
      state,
      postalCode,
    };
    setLocationData(newLocationData);

    // Clear atlas entity data when selecting from search
    if (atlasEntityAbortControllerRef.current) {
      atlasEntityAbortControllerRef.current.abort();
      atlasEntityAbortControllerRef.current = null;
    }
    setAtlasEntityData(null);
    setAtlasEntityTableName(null);
    setAtlasEntityTypeData(null);
    setAtlasEntityError(null);
    setIsAtlasEntityOpen(false);
    setIsAtlasEntityRawOpen(false);
    atlasEntityCoordinatesRef.current = null;

    // Clear search input after selection
    setSearchQuery('');

    // Close location details when location is chosen
    setIsLocationDetailsExpanded(false);

    // Add temporary pin
    addTemporaryPin(coordinates);

    // Dispatch event to close any open pin popup
    window.dispatchEvent(new CustomEvent('location-selected-on-map'));

    // Get feature metadata at selected location (convert coordinates to point)
    if (map && !map.removed) {
      const point = (map as any).project([coordinates.lng, coordinates.lat]);
      const pinMetadata = queryFeatureAtPoint(map, point);
      setPinFeature(pinMetadata && 'feature' in pinMetadata ? pinMetadata.feature : pinMetadata);
    }

    // Don't automatically search for POIs - user must click "Search Nearby" button

    // Fly to location
    if (map && !map.removed && mapLoaded) {
      map.flyTo({
        center: [coordinates.lng, coordinates.lat],
        zoom: 15,
        duration: 1500,
      });
    }

    if (onLocationSelect) {
      onLocationSelect(coordinates);
    }

    searchInputRef.current?.blur();
  }, [map, mapLoaded, onLocationSelect, addTemporaryPin]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Inline Pin Creation Handlers
  // ═══════════════════════════════════════════════════════════════════════════
  
  const resetPinForm = useCallback(() => {
    setIsDropHeartExpanded(false);
    setPinDescription('');
    setPinSelectedFile(null);
    setPinFilePreview(null);
    setPinVisibility('public');
    setPinEventMonth('');
    setPinEventDay('');
    setPinEventYear('');
    setShowPostDateInput(false);
    setPinError(null);
    if (pinFileInputRef.current) {
      pinFileInputRef.current.value = '';
    }
  }, []);

  // Unified location cleanup - clears all location-related state
  const clearLocation = useCallback(() => {
    clearSelection();
    removeTemporaryPin();
    setIsLocationDetailsExpanded(false);
    setIsMetadataOpen(false);
    resetPinForm();
  }, [clearSelection, removeTemporaryPin, resetPinForm]);

  const handlePinFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    // Require signed-in user to upload media
    // Check ref to get current auth state (avoids stale closure issues)
    if (authLoadingRef.current || !userRef.current) {
      e.preventDefault();
      if (pinFileInputRef.current) {
        pinFileInputRef.current.value = '';
      }
      if (!authLoadingRef.current) {
        openWelcome();
      }
      return;
    }
    
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setPinError('Please select a valid image or video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setPinError('File must be smaller than 100MB');
      return;
    }

    setPinSelectedFile(file);
    setPinError(null);

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPinFilePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPinFilePreview(URL.createObjectURL(file));
    }
  }, [user, openWelcome]);

  const handleRemovePinFile = useCallback(() => {
    if (pinFilePreview && pinSelectedFile?.type.startsWith('video/')) {
      URL.revokeObjectURL(pinFilePreview);
    }
    setPinSelectedFile(null);
    setPinFilePreview(null);
    if (pinFileInputRef.current) {
      pinFileInputRef.current.value = '';
    }
  }, [pinFilePreview, pinSelectedFile]);

  const handleSubmitPin = useCallback(async () => {
    if (!locationData?.coordinates) return;
    if (!pinDescription.trim()) {
      setPinError('Please add a description');
      return;
    }

    // Require authentication to create mentions
    // Check ref to get current auth state (avoids stale closure issues)
    if (authLoadingRef.current) {
      setPinError('Checking authentication...');
      return;
    }

    if (!userRef.current) {
      setPinError('Please sign in to create mentions');
      openWelcome();
      return;
    }

    // Require username to post
    if (!accountRef.current?.username) {
      setPinError('Please complete your profile to post');
      openOnboarding();
      return;
    }

    setIsPinSubmitting(true);
    setPinError(null);

    try {
      // Build timestamp from optional month, day, year
      let postDate: string | null = null;
      
      if (pinEventYear) {
        const year = parseInt(pinEventYear, 10);
        const month = pinEventMonth ? parseInt(pinEventMonth, 10) : 1;
        const day = pinEventDay ? parseInt(pinEventDay, 10) : 1;
        
        // Validate date
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          setPinError('Please enter a valid date');
          setIsPinSubmitting(false);
          return;
        }
        
        // Check if date is in the future
        const now = new Date();
        if (date > now) {
          setPinError('Date cannot be in the future');
          setIsPinSubmitting(false);
          return;
        }
        
        // Check if date is more than 100 years ago
        const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
        if (date < hundredYearsAgo) {
          setPinError('Date cannot be more than 100 years in the past');
          setIsPinSubmitting(false);
          return;
        }
        
        // Convert to ISO string
        postDate = date.toISOString();
      }

      // Combine location data and cursor tracking metadata
      const mapMeta = {
        location: locationData,
        feature: pinFeature ? {
          layerId: pinFeature.layerId,
          sourceLayer: pinFeature.sourceLayer,
          category: pinFeature.category,
          name: pinFeature.name,
          label: pinFeature.label,
          icon: pinFeature.icon,
          properties: pinFeature.properties,
          atlasType: pinFeature.atlasType,
          showIntelligence: pinFeature.showIntelligence,
        } : null,
      };

      // Include full atlas entity metadata (raw response) if mention is being created on an atlas entity
      // This captures the complete entity data as returned from the API, including all fields
      // Also includes atlas_types metadata (icon_path, name, description, etc.)
      const atlasMeta = atlasEntityData && atlasEntityTableName ? {
        ...atlasEntityData, // Include the full raw response
        table_name: atlasEntityTableName, // Ensure table_name is included (may not be in API response)
        type_meta: atlasEntityTypeData || null, // Include atlas_types metadata if available
      } : null;

      const mentionData: CreateMentionData = {
        lat: locationData.coordinates.lat,
        lng: locationData.coordinates.lng,
        description: pinDescription.trim() || null,
        visibility: pinVisibility,
        post_date: postDate,
        map_meta: mapMeta,
        atlas_meta: atlasMeta,
      };

      const createdMention = await MentionService.createMention(mentionData, activeAccountId || undefined);

      // Reset form and remove temporary marker
      resetPinForm();
      removeTemporaryPin();

      // Trigger mentions refresh via custom event with the created mention
      window.dispatchEvent(new CustomEvent('mention-created', {
        detail: { mention: createdMention }
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mention';
      console.error('[LocationSidebar] Error creating mention:', errorMessage, err);
      setPinError(errorMessage);
    } finally {
      setIsPinSubmitting(false);
      setIsPinUploading(false);
    }
  }, [locationData, pinFeature, pinDescription, pinEventMonth, pinEventDay, pinEventYear, pinVisibility, atlasEntityData, atlasEntityTableName, user, resetPinForm, removeTemporaryPin, openOnboarding, openWelcome, activeAccountId]);

  // Map control handlers
  const handleZoomIn = useCallback(() => {
    if (map && !map.removed) {
      const currentZoom = map.getZoom();
      map.easeTo({ zoom: currentZoom + 1, duration: 300 });
    }
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (map && !map.removed) {
      const currentZoom = map.getZoom();
      map.easeTo({ zoom: currentZoom - 1, duration: 300 });
    }
  }, [map]);

  const handleResetRotation = useCallback(() => {
    if (map && !map.removed) {
      map.easeTo({ bearing: 0, duration: 300 });
    }
  }, [map]);

  const handleToggle3D = useCallback(() => {
    if (map && !map.removed) {
      const newPitch = is3DMode ? 0 : 60;
      map.easeTo({ pitch: newPitch, duration: 300 });
      setIs3DMode(!is3DMode);
    }
  }, [map, is3DMode]);

  const handleToggleRoadLabels = useCallback(() => {
    if (map && !map.removed) {
      const style = map.getStyle?.();
      if (style?.layers) {
        // Toggle visibility of road label layers
        const roadLabelLayers = style.layers.filter((layer: { id: string }) => 
          layer.id.includes('road') && layer.id.includes('label')
        );
        roadLabelLayers.forEach((layer: { id: string }) => {
          const visibility = showRoadLabels ? 'none' : 'visible';
          map.setLayoutProperty?.(layer.id, 'visibility', visibility);
        });
        setShowRoadLabels(!showRoadLabels);
      }
    }
  }, [map, showRoadLabels]);

  const handleToggleSpin = useCallback(() => {
    if (!map || map.removed) return;

    if (isSpinning) {
      // Stop spinning
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
        spinAnimationRef.current = null;
      }
      setIsSpinning(false);
    } else {
      // Start spinning
      setIsSpinning(true);
      const spinMap = () => {
        if (map && !map.removed) {
          const bearing = map.getBearing();
          map.rotateTo(bearing + 0.5, { duration: 0 });
          spinAnimationRef.current = requestAnimationFrame(spinMap);
        }
      };
      spinMap();
    }
  }, [map, isSpinning]);

  const handleFindMe = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (map && !map.removed) {
          map.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1500,
          });
          // Also update location data
          if (onLocationSelect) {
            onLocationSelect({ lat: latitude, lng: longitude });
          }
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [map, onLocationSelect]);

  // Cleanup spin animation on unmount
  useEffect(() => {
    return () => {
      if (spinAnimationRef.current) {
        cancelAnimationFrame(spinAnimationRef.current);
      }
    };
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showSuggestions]);

  // NOTE: Feature querying is now handled by useFeatureTracking hook
  // See src/features/map-metadata for centralized feature extraction

  // Reverse geocode coordinates to get address
  interface ReverseGeocodeResult {
    address: string | null;
    street: string | null;
    // Primary place from Mapbox (city/town)
    city: string | null;
    // Locality (village, township, settlement) - minor places
    locality: string | null;
    localityType: 'village' | 'township' | 'settlement' | 'hamlet' | 'suburb' | 'locality' | null;
    // Neighborhood (subdivision within a city)
    neighborhood: string | null;
    // County/State/Zip
    county: string | null;
    state: string | null;
    postalCode: string | null;
  }

  const reverseGeocode = useCallback(async (lng: number, lat: number): Promise<ReverseGeocodeResult> => {
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    const emptyResult: ReverseGeocodeResult = { 
      address: null, 
      street: null, 
      city: null, 
      locality: null, 
      localityType: null, 
      neighborhood: null, 
      county: null, 
      state: null, 
      postalCode: null 
    };
    
    if (!token) {
      return emptyResult;
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;
      const params = new URLSearchParams({
        access_token: token,
        // Include all place types: address, poi, place (city), locality (village/township), neighborhood
        types: 'address,poi,place,locality,neighborhood',
        limit: '1',
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        return emptyResult;
      }

      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        return emptyResult;
      }

      const feature = data.features[0];
      const address = feature.place_name || null;
      // Street is the main text of the address feature (e.g., "123 Main St")
      const street = feature.text || null;
      
      // Extract all location hierarchy from context array
      let city: string | null = null;
      let locality: string | null = null;
      let localityType: ReverseGeocodeResult['localityType'] = null;
      let neighborhood: string | null = null;
      let county: string | null = null;
      let state: string | null = null;
      let postalCode: string | null = null;
      
      // Check if the main feature itself is a place type (city/locality/neighborhood)
      // This happens when clicking directly on a place label
      if (feature.place_type) {
        const placeTypes = Array.isArray(feature.place_type) ? feature.place_type : [feature.place_type];
        
        // If the feature IS a city/place
        if (placeTypes.includes('place')) {
          city = feature.text || null;
        }
        // If the feature IS a locality (village, township, settlement)
        else if (placeTypes.includes('locality')) {
          locality = feature.text || null;
          // Determine locality type from properties if available
          const props = feature.properties || {};
          if (props.wikidata || props.short_code) {
            // Check common patterns for locality types
            const text = (feature.text || '').toLowerCase();
            if (text.includes('township') || text.endsWith(' twp')) {
              localityType = 'township';
            } else if (text.includes('village')) {
              localityType = 'village';
            } else {
              localityType = 'locality';
            }
          } else {
            localityType = 'locality';
          }
        }
        // If the feature IS a neighborhood
        else if (placeTypes.includes('neighborhood')) {
          neighborhood = feature.text || null;
        }
      }
      
      // Parse context array for hierarchy
      if (feature.context && Array.isArray(feature.context)) {
        for (const ctx of feature.context) {
          const ctxId = ctx.id || '';
          const ctxText = ctx.text || null;
          
          // City/Place - primary urban area
          if (ctxId.startsWith('place.') && !city) {
            city = ctxText;
          }
          // Locality - village, township, settlement, hamlet, suburb
          else if (ctxId.startsWith('locality.') && !locality) {
            locality = ctxText;
            // Try to determine locality type from the name
            if (ctxText) {
              const lower = ctxText.toLowerCase();
              if (lower.includes('township') || lower.endsWith(' twp')) {
                localityType = 'township';
              } else if (lower.includes('village')) {
                localityType = 'village';
              } else if (lower.includes('settlement')) {
                localityType = 'settlement';
              } else if (lower.includes('hamlet')) {
                localityType = 'hamlet';
              } else {
                localityType = 'locality';
              }
            }
          }
          // Neighborhood - subdivision within a city
          else if (ctxId.startsWith('neighborhood.') && !neighborhood) {
            neighborhood = ctxText;
          }
          // County/District
          else if (ctxId.startsWith('district.')) {
            county = ctxText;
          }
          // State/Region
          else if (ctxId.startsWith('region.')) {
            state = ctxText;
          }
          // Postal code
          else if (ctxId.startsWith('postcode.')) {
            postalCode = ctxText;
          }
        }
      }

      return { address, street, city, locality, localityType, neighborhood, county, state, postalCode };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return emptyResult;
    }
  }, []);

  // Listen for "pin-popup-opening" event to close location details when a pin popup opens
  useEffect(() => {
    const handlePinPopupOpening = () => {
      // Close location details when a pin popup opens
      clearSelection();
      removeTemporaryPin();
      setIsLocationDetailsExpanded(false);
    };

    window.addEventListener('pin-popup-opening', handlePinPopupOpening as EventListener);

    return () => {
      window.removeEventListener('pin-popup-opening', handlePinPopupOpening as EventListener);
    };
  }, [removeTemporaryPin, clearSelection]);

  // Listen for "mention-popup-opening" event to close location details when a mention popup opens
  useEffect(() => {
    const handleMentionPopupOpening = () => {
      // Close location details when a mention popup opens
      clearSelection();
      removeTemporaryPin();
      setIsLocationDetailsExpanded(false);
    };

    window.addEventListener('mention-popup-opening', handleMentionPopupOpening as EventListener);

    return () => {
      window.removeEventListener('mention-popup-opening', handleMentionPopupOpening as EventListener);
    };
  }, [removeTemporaryPin, clearSelection]);

  // Fetch visible atlas entities in viewport
  const fetchVisibleAtlasEntities = useCallback(async () => {
    if (!map || !mapLoaded || !isDropHeartExpanded) return;
    
    try {
      setIsLoadingVisibleAtlas(true);
      const mapboxMap = map as any;
      const bounds = mapboxMap.getBounds();
      
      if (!bounds) {
        setIsLoadingVisibleAtlas(false);
        return;
      }
      
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      
      // Query atlas entities within viewport bounds
      const { data, error } = await supabase
        .from('atlas_entities')
        .select('id, name, table_name, lat, lng')
        .gte('lat', sw.lat)
        .lte('lat', ne.lat)
        .gte('lng', sw.lng)
        .lte('lng', ne.lng)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(20); // Limit to 20 for performance
      
      if (error) {
        console.error('[FloatingMapContainer] Error fetching visible atlas entities:', error);
        setVisibleAtlasEntities([]);
      } else {
        setVisibleAtlasEntities((data || []) as Array<{
          id: string;
          name: string;
          table_name: string;
          lat: number;
          lng: number;
        }>);
      }
    } catch (error) {
      console.error('[FloatingMapContainer] Error fetching visible atlas entities:', error);
      setVisibleAtlasEntities([]);
    } finally {
      setIsLoadingVisibleAtlas(false);
    }
  }, [map, mapLoaded, isDropHeartExpanded]);

  // Fetch visible atlas entities when form expands or map moves
  useEffect(() => {
    if (!map || !mapLoaded || !isDropHeartExpanded) {
      setVisibleAtlasEntities([]);
      return;
    }
    
    // Fetch immediately when form expands
    fetchVisibleAtlasEntities();
    
    // Also fetch when map moves (debounced)
    let timeoutId: NodeJS.Timeout;
    const handleMapMove = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchVisibleAtlasEntities();
      }, 500); // Debounce by 500ms
    };
    
    const mapboxMap = map as any;
    mapboxMap.on('moveend', handleMapMove);
    
    return () => {
      clearTimeout(timeoutId);
      mapboxMap.off('moveend', handleMapMove);
    };
  }, [map, mapLoaded, isDropHeartExpanded, fetchVisibleAtlasEntities]);

  // Listen for double-click on map to show location and expand pin form
  useEffect(() => {
    const handleShowLocationForPin = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { lat, lng } = customEvent.detail;
      
      // Reverse geocode and select the location
      const geocodedData = await reverseGeocode(lat, lng);
      const locationDataForPin: LocationData = {
        coordinates: { lat, lng },
        placeName: geocodedData.city || geocodedData.locality || undefined,
        address: geocodedData.address || undefined,
        type: 'map-click',
      };
      setLocationData(locationDataForPin);
      
      // Expand the inline pin form if user is authenticated
      // Username check happens on submit, not here
      if (userRef.current) {
        setIsDropHeartExpanded(true);
        // Add temporary pin marker
        addTemporaryPin({ lat, lng });
      }
      
      // Fly to location
      if (map && mapLoaded) {
        map.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 1000,
        });
      }
    };

    window.addEventListener('show-location-for-mention', handleShowLocationForPin);

    return () => {
      window.removeEventListener('show-location-for-mention', handleShowLocationForPin);
    };
  }, [map, mapLoaded, reverseGeocode, addTemporaryPin]);

  const handleMapClick = useCallback(async (e: MapboxMouseEvent) => {
    if (!map || !mapLoaded) return;
    
    // Check if click hit a mention layer - if so, don't open location details
    // Mention click handlers will handle opening the popup
    const mentionLayers = ['map-mentions-point', 'map-mentions-point-label'];
    const mapboxMap = map as any;
    const features = mapboxMap.queryRenderedFeatures(e.point, {
      layers: mentionLayers,
    });

    // If clicked on a mention, don't open location details (mention click handler will handle it)
    if (features.length > 0) {
      return;
    }
    
    const { lng, lat } = e.lngLat;
    
    // Normal mode: Check if click hit a mention or pin - if so, don't show map click data
    try {
      const mapboxMap = map as any;
      const layersToCheck = [
        // Mentions
        'map-mentions-point',
        'map-mentions-point-label',
        // User pins
        'map-pins-point',
        'map-pins-point-label',
      ];
      
      const existingLayers = layersToCheck.filter(layerId => {
        try {
          return mapboxMap.getLayer(layerId) !== undefined;
        } catch {
          return false;
        }
      });
      
      if (existingLayers.length > 0) {
        const features = mapboxMap.queryRenderedFeatures(e.point, {
          layers: existingLayers,
        });

        // If a pin was clicked, don't show map click data (their click handlers will handle it)
        if (features.length > 0) {
          return;
        }
      }
    } catch (queryError) {
      // Continue with map click if query fails
    }
    
    // Clear atlas entity data if clicking on map
    // Cancel any in-flight fetch
    if (atlasEntityAbortControllerRef.current) {
      atlasEntityAbortControllerRef.current.abort();
      atlasEntityAbortControllerRef.current = null;
    }
    setAtlasEntityData(null);
    setAtlasEntityTableName(null);
    setAtlasEntityTypeData(null);
    setAtlasEntityError(null);
    setIsAtlasEntityOpen(false);
    setIsAtlasEntityRawOpen(false);
    atlasEntityCoordinatesRef.current = null;

    // Incrementally zoom in on click
    if (map) {
      const mapboxMap = map as any;
      const currentZoom = mapboxMap.getZoom();
      const zoomIncrement = 2;
      const targetZoom = Math.min(currentZoom + zoomIncrement, MAP_CONFIG.MAX_ZOOM);
      
      mapboxMap.flyTo({
        center: [lng, lat],
        zoom: targetZoom,
        duration: 1000,
      });
    }

    // Add temporary pin
    addTemporaryPin({ lat, lng });

    // Dispatch event to close any open pin popup
    window.dispatchEvent(new CustomEvent('location-selected-on-map'));

    // Feature capture is handled by useFeatureTracking hook via hookClickFeature → useEffect
    // This ensures we use the ref-based capture (always current) rather than potentially stale state
    setIsMetadataOpen(false);
    
    // Clear feature for fresh location click (feature will be set by useEffect from hook)
    setCapturedFeature(null);

    // Reverse geocode to get address
    const geocodeResult = await reverseGeocode(lng, lat);
    const placeName = geocodeResult.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    // Update search input with address
    setSearchQuery(placeName);

    // Look up city_id from our cities table
    // Priority: Try the city first, then try locality (some MN localities are in our cities table)
    let cityId: string | undefined;
    let citySlug: string | undefined;
    let cityHasCoordinates = false;
    let parentCity: string | undefined;
    let parentCityId: string | undefined;
    let parentCitySlug: string | undefined;
    
    // If we have a city from Mapbox, look it up
    if (geocodeResult.city) {
      try {
        const cityData = await findCityByName(geocodeResult.city);
        if (cityData) {
          cityId = cityData.id;
          citySlug = cityData.slug;
          cityHasCoordinates = !!(cityData.lat && cityData.lng);
        }
      } catch (err) {
        // City lookup failed, continue without city_id
      }
    }
    
    // If we have a locality but no city match, try to find the locality in our cities table
    // (Many MN "localities" like villages/townships are actually in our cities table)
    if (geocodeResult.locality && !cityId) {
      try {
        const localityData = await findCityByName(geocodeResult.locality);
        if (localityData) {
          // The locality IS a city in our table - use it as the primary city
          cityId = localityData.id;
          citySlug = localityData.slug;
          cityHasCoordinates = !!(localityData.lat && localityData.lng);
        }
      } catch (err) {
        // Locality lookup failed
      }
    }
    
    // If we have both locality/neighborhood and city, and the city matched, set parent info
    // This handles cases like "Uptown (neighborhood) in Minneapolis (city)"
    // The city becomes the parent, locality/neighborhood is the primary identifier
    let showCityAsPrimary = true;
    if (geocodeResult.city && (geocodeResult.locality || geocodeResult.neighborhood)) {
      if (cityId) {
        // City matched in our DB, show it as parent instead of primary
        parentCity = geocodeResult.city;
        parentCityId = cityId;
        parentCitySlug = citySlug;
        showCityAsPrimary = false; // Don't show city badge, show "in City" instead
      }
    }

    // Look up county in our database
    let countyId: string | undefined;
    let countySlug: string | undefined;
    if (geocodeResult.county) {
      try {
        const countyData = await findCountyByName(geocodeResult.county);
        if (countyData) {
          countyId = countyData.id;
          countySlug = countyData.slug;
        }
      } catch (err) {
        // County lookup failed
      }
    }

    // Set location data with all extracted fields
    const newLocationData: LocationData = {
      coordinates: { lat, lng },
      placeName: geocodeResult.address || undefined,
      address: geocodeResult.address || undefined,
      street: geocodeResult.street || undefined,
      type: 'map-click',
      // City info - only if it's the primary (no locality/neighborhood present)
      city: showCityAsPrimary ? (geocodeResult.city || undefined) : undefined,
      cityId: showCityAsPrimary ? cityId : undefined,
      citySlug: showCityAsPrimary ? citySlug : undefined,
      cityHasCoordinates: showCityAsPrimary ? cityHasCoordinates : false,
      // Locality info (village, township, settlement)
      locality: geocodeResult.locality || undefined,
      localityType: geocodeResult.localityType || undefined,
      // Neighborhood info
      neighborhood: geocodeResult.neighborhood || undefined,
      // Parent city (when location is in a sub-area of a city)
      parentCity,
      parentCityId,
      parentCitySlug,
      // County/State/Zip
      county: geocodeResult.county || undefined,
      countyId,
      countySlug,
      state: geocodeResult.state || undefined,
      postalCode: geocodeResult.postalCode || undefined,
    };
    setLocationData(newLocationData);

  }, [map, mapLoaded, addTemporaryPin, reverseGeocode, user, account]);

  // NOTE: Mouse move is now handled by useFeatureTracking hook with throttling

  // Register map click handler (mousemove handled by useFeatureTracking hook)
  useEffect(() => {
    if (!map || !mapLoaded) return;

    map.on('click', handleMapClick as any);

    return () => {
      if (map && !map.removed) {
        map.off('click', handleMapClick as any);
      }
    };
  }, [map, mapLoaded, handleMapClick]);

  // Cleanup search timeout and temporary marker
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      removeTemporaryPin();
    };
  }, [removeTemporaryPin]);

  // Handle keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Close all dropdowns when location data appears
  useEffect(() => {
    if (locationData) {
      setActivePanel('none');
    }
  }, [locationData]);

  const closeAllDropdowns = useCallback(() => {
    setActivePanel('none');
    setShowSuggestions(false);
  }, []);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleSuggestionSelect(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    if (showSuggestions) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [showSuggestions, suggestions, selectedIndex, handleSuggestionSelect]);


  // Sidebar expands if either location data or selected pin exists, or search is focused
  const hasData = locationData !== null;
  const isExpanded = hasData || isSearchFocused;

  // Search input is always in the sidebar
  // When collapsed (no data), background is transparent but search stays visible
  // When expanded (has data), background appears with blur effect
  if (!isOpen) return null;

  return (
    <>
      <div className="w-full flex flex-col">
      {/* Inline Container - No floating card styling */}
      <div className="relative w-full bg-transparent overflow-hidden transition-all duration-300 ease-in-out" style={{ pointerEvents: 'auto', zIndex: 50 }}>
          {/* Suggestions Panel - Inline */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="border-b border-gray-200 max-h-48 overflow-y-auto transition-all duration-300 ease-in-out"
              style={{ pointerEvents: 'auto' }}
            >
              {suggestions.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => handleSuggestionSelect(feature)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-2 py-1.5 transition-colors border-b border-gray-100 last:border-b-0 ${
                    selectedIndex === index
                      ? 'bg-gray-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-900">{feature.text}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{feature.place_name}</div>
                </button>
              ))}
            </div>
          )}

          {/* Toolbar Row */}
          <div className="relative flex items-center border-b border-gray-200">
            {/* Admin Badge */}
            {isAdmin && (
              <div className="px-2 py-1 border-l border-gray-200">
                <span className="px-1.5 py-0.5 text-[9px] font-medium text-gray-700 bg-gray-100 rounded">
                  Admin
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative flex-1 border-l border-gray-200">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  setActivePanel('none');
                  setIsSearchFocused(true);
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setIsSearchFocused(false);
                  }, 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowSuggestions(false);
                    setSelectedIndex(-1);
                  }
                }}
                placeholder="Search locations..."
                className={`w-full pl-8 pr-8 py-2 text-xs bg-transparent border-0 text-gray-900 placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 transition-all ${
                  searchQuery || isSearching ? 'pr-8' : 'pr-2'
                }`}
                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 50 }}
              />
              {isSearching && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
              )}
              {!isSearching && searchQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setSelectedIndex(-1);
                    // Clear location state when search is cleared
                    clearLocation();
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400 hover:text-gray-900 transition-colors flex items-center justify-center"
                  style={{ pointerEvents: 'auto', position: 'absolute', zIndex: 60 }}
                  title="Clear search"
                  type="button"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Content Sections - Only shown when expanded and no panel is open */}
          {isExpanded && !showSuggestions && (
            <div
              className="overflow-y-auto"
              style={{ 
                maxHeight: 'calc(100vh - 200px)',
                minHeight: 0,
              }}
            >
              <div className="p-2 space-y-2">

              {/* Search focused placeholder - shown when no location selected yet */}
              {isSearchFocused && !hasData && (
                <div className="text-center py-4">
                  <MapPinIcon className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                  <p className="text-xs text-gray-500">Search for a location or click on the map</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Location details will appear here</p>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  PRIMARY ACTION: Mention Heart - Inline expandable form
                  ═══════════════════════════════════════════════════════════════ */}
              {locationData && (
                <div className="space-y-2">
                  {/* Expanded Form */}
                  {isDropHeartExpanded && (
                    <div className="space-y-1.5">
                      {/* Address Header with Back Button */}
                      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                        <button
                          onClick={resetPinForm}
                          disabled={isPinSubmitting || isPinUploading}
                          className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                          title="Back to location"
                        >
                          <ChevronUpIcon className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-900 truncate">
                            {locationData.address || locationData.placeName || `${locationData.coordinates.lat.toFixed(6)}, ${locationData.coordinates.lng.toFixed(6)}`}
                          </p>
                        </div>
                      </div>
                      
                      {/* Account Info Header */}
                      {account && account.username && (
                        <div className="flex items-center gap-2 pb-2">
                          {account.image_url ? (
                            <img 
                              src={account.image_url} 
                              alt={account.username} 
                              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-700 font-medium flex-shrink-0">
                              {account.username[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-xs font-medium text-gray-900 truncate">
                            @{account.username}
                          </span>
                        </div>
                      )}

                      {/* Metadata Preview Containers */}
                      <div className="space-y-1.5 pb-2">
                        {/* Debug: Show state values */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="text-[8px] text-gray-400 p-1 bg-gray-50 rounded">
                            Debug: atlasEntityData={atlasEntityData ? 'exists' : 'null'}, 
                            atlasEntityTableName={atlasEntityTableName || 'null'},
                            atlasEntityTypeData={atlasEntityTypeData ? 'exists' : 'null'}
                          </div>
                        )}
                        
                        {/* Map Meta Container - Show if available */}
                        {pinFeature && (pinFeature.name || pinFeature.properties?.class || pinFeature.label) && (
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                            <div className="flex items-center gap-1.5">
                              {pinFeature.icon && (
                                <span className="text-xs flex-shrink-0">{pinFeature.icon}</span>
                              )}
                              <span className="text-[10px] text-gray-700 truncate">
                                {pinFeature.name || (pinFeature.properties?.class ? pinFeature.properties.class.replace(/_/g, ' ') : pinFeature.label)}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Atlas Meta Container - Show if atlas entity data exists (below map meta) */}
                        {atlasEntityData && atlasEntityTableName && (
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-gray-700 truncate">
                                {atlasEntityData.name || atlasEntityTableName}
                              </span>
                              <span className="text-[9px] text-gray-500 ml-1">
                                ({atlasEntityTypeData?.name || atlasEntityTableName})
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Near Me - Visible Atlas Entities */}
                      {visibleAtlasEntities.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                          <div className="text-[10px] font-medium text-gray-700 mb-1.5">
                            Near me ({visibleAtlasEntities.length})
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {visibleAtlasEntities.map((entity) => (
                              <div
                                key={entity.id}
                                className="flex items-center gap-1.5 text-[10px] text-gray-600"
                              >
                                <span className="text-[9px]">
                                  {ATLAS_ENTITY_LABELS[entity.table_name] || entity.table_name}
                                </span>
                                <span className="truncate">{entity.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Caption */}
                      <div>
                        <textarea
                          value={pinDescription}
                          onChange={(e) => {
                            if (e.target.value.length <= 240) {
                              setPinDescription(e.target.value);
                            }
                          }}
                          maxLength={240}
                          className="w-full px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none bg-transparent"
                          placeholder="What's going on here?"
                          rows={5}
                          disabled={isPinSubmitting || isPinUploading}
                        />
                        <div className="flex items-center justify-between mt-0.5">
                          {/* Date Selector - Collapsible */}
                          <div>
                            {!showPostDateInput ? (
                              <button
                                type="button"
                                onClick={() => setShowPostDateInput(true)}
                                className="text-xs text-gray-600 hover:text-gray-900 underline"
                                disabled={isPinSubmitting || isPinUploading}
                              >
                                Post Date
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="grid grid-cols-3 gap-1">
                                  <input
                                    type="number"
                                    value={pinEventMonth}
                                    onChange={(e) => {
                                      const monthValue = e.target.value;
                                      if (!monthValue || (monthValue >= '1' && monthValue <= '12')) {
                                        setPinEventMonth(monthValue);
                                        setPinError(null);
                                      }
                                    }}
                                    min="1"
                                    max="12"
                                    placeholder="M"
                                    className="w-10 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                    disabled={isPinSubmitting || isPinUploading}
                                    autoFocus
                                  />
                                  <input
                                    type="number"
                                    value={pinEventDay}
                                    onChange={(e) => {
                                      const dayValue = e.target.value;
                                      if (!dayValue || (dayValue >= '1' && dayValue <= '31')) {
                                        setPinEventDay(dayValue);
                                        setPinError(null);
                                      }
                                    }}
                                    min="1"
                                    max="31"
                                    placeholder="D"
                                    className="w-10 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                    disabled={isPinSubmitting || isPinUploading}
                                  />
                                  <input
                                    type="number"
                                    value={pinEventYear}
                                    onChange={(e) => {
                                      const yearValue = e.target.value;
                                      setPinEventYear(yearValue);
                                      setPinError(null);
                                    }}
                                    min={new Date().getFullYear() - 100}
                                    max={new Date().getFullYear()}
                                    placeholder="Y"
                                    className="w-12 px-2 py-1 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                    disabled={isPinSubmitting || isPinUploading}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowPostDateInput(false);
                                    setPinEventMonth('');
                                    setPinEventDay('');
                                    setPinEventYear('');
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-gray-600"
                                  disabled={isPinSubmitting || isPinUploading}
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Character Count */}
                          <span className={`text-[10px] ${pinDescription.length >= 240 ? 'text-red-500' : 'text-gray-400'}`}>
                            {pinDescription.length}/240
                          </span>
                        </div>
                      </div>


                      {/* Error */}
                      {pinError && (
                        <div className="text-[10px] text-red-600 bg-red-50 p-2 rounded -mt-1">
                          {pinError}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 -mt-3">
                        <button
                          onClick={handleSubmitPin}
                          disabled={isPinSubmitting || !pinDescription.trim() || !user}
                          className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
                        >
                          {isPinSubmitting ? 'Posting...' : 'Post'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mention Heart Button */}
                  {!isDropHeartExpanded && (
                    <button
                      onClick={() => {
                        // Require authentication to create mentions
                        // Check ref to get current auth state (avoids stale closure issues)
                        if (authLoadingRef.current) {
                          return; // Wait for auth to initialize
                        }
                        if (!userRef.current) {
                          openWelcome();
                          return;
                        }
                        // Allow form to expand - username check happens on submit
                        setIsDropHeartExpanded(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm"
                    >
                      <span>Mention</span>
                      <HeartIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  VIEWING SECTION: What the user clicked on (read-only context)
                  ═══════════════════════════════════════════════════════════════ */}
              
              {/* Location Details - Accordion - Hidden but logic preserved for future use */}
              {SHOW_LOCATION_DETAILS && locationData && !isDropHeartExpanded && (
                <div className="border-b border-gray-200">
                  {/* Accordion Header */}
                  <div
                    onClick={() => setIsLocationDetailsExpanded(!isLocationDetailsExpanded)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-900 truncate">
                        {locationData.address || locationData.placeName || 
                         locationData.city || 
                         `${locationData.coordinates.lat.toFixed(4)}, ${locationData.coordinates.lng.toFixed(4)}`}
                      </span>
                      {locationData.city && (
                        <span className="text-[10px] text-gray-500 truncate">· {locationData.city}</span>
                      )}
                      {locationData.county && !locationData.city && (
                        <span className="text-[10px] text-gray-500 truncate">· {locationData.county}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocationData(null);
                          setPinFeature(null);
                          removeTemporaryPin();
                          setIsMetadataOpen(false);
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-900 transition-colors"
                        title="Close"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                      {isLocationDetailsExpanded ? (
                        <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Accordion Content - Packed Data */}
                  {isLocationDetailsExpanded && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {/* Address Row - Click to copy */}
                      {(locationData.address || locationData.placeName) && (
                        <button
                          onClick={async () => {
                            const text = locationData.address || locationData.placeName || '';
                            try {
                              await navigator.clipboard.writeText(text);
                            } catch (err) {
                              console.error('Failed to copy:', err);
                            }
                          }}
                          className="w-full text-left text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 py-1 -mx-2 rounded transition-colors group flex items-center gap-1.5"
                          title="Click to copy"
                        >
                          <span className="truncate flex-1">{locationData.address || locationData.placeName}</span>
                          <svg className="w-3 h-3 text-gray-300 group-hover:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      )}

                      {/* Location Hierarchy - Compact Badges */}
                      <div className="space-y-0.5 pb-1.5 border-b border-gray-100">
                        {/* Neighborhood */}
                        {locationData.neighborhood && (
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 text-[9px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded">Nbhd</span>
                            <span className="text-xs text-gray-700 truncate">{locationData.neighborhood}</span>
                          </div>
                        )}
                        
                        {/* Locality */}
                        {locationData.locality && (
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 text-[9px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded capitalize">
                              {locationData.localityType === 'township' ? 'Twp' :
                               locationData.localityType === 'village' ? 'Vlg' :
                               locationData.localityType === 'hamlet' ? 'Hmlt' :
                               locationData.localityType === 'settlement' ? 'Stlmt' :
                               locationData.localityType === 'suburb' ? 'Sub' : 'Loc'}
                            </span>
                            <span className="text-xs text-gray-700 truncate">{locationData.locality}</span>
                          </div>
                        )}
                        
                        {/* City */}
                        {locationData.city && (
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 text-[9px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded">City</span>
                            <span className="text-xs text-gray-700 truncate">{locationData.city}</span>
                            {locationData.cityId && (
                              <span className="text-[9px] text-green-600 ml-auto" title="In database">✓</span>
                            )}
                            {isAdmin && locationData.cityId && !locationData.cityHasCoordinates && (
                              <button
                                onClick={async (e) => {
                                  const btn = e.currentTarget;
                                  btn.textContent = '⏳';
                                  btn.disabled = true;
                                  try {
                                    await updateCityCoordinates(locationData.cityId!, locationData.coordinates.lat, locationData.coordinates.lng);
                                    btn.textContent = '✅';
                                    setLocationData({...locationData, cityHasCoordinates: true});
                                  } catch (err) {
                                    console.error('Failed to update city coordinates:', err);
                                    btn.textContent = '❌';
                                    setTimeout(() => { btn.textContent = '📍'; btn.disabled = false; }, 2000);
                                  }
                                }}
                                className="text-[9px] text-amber-600 hover:text-amber-800 ml-auto"
                                title="Set coordinates"
                              >
                                📍
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Parent City */}
                        {locationData.parentCity && (
                          <div className="flex items-center gap-1 pl-2 border-l border-gray-200">
                            <span className="text-[9px] text-gray-400">in</span>
                            <span className="text-xs text-gray-600 truncate">{locationData.parentCity}</span>
                          </div>
                        )}

                        {/* County */}
                        {locationData.county && (
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">Co</span>
                            <span className="text-xs text-gray-700 truncate">{locationData.county}</span>
                            {locationData.countyId && (
                              <span className="text-[9px] text-green-600 ml-auto" title="In database">✓</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* State/Zip + Coordinates Row */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                        {(locationData.state || locationData.postalCode) && (
                          <div className="text-[10px] text-gray-500">
                            {[locationData.state, locationData.postalCode].filter(Boolean).join(', ')}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 font-mono ml-auto">
                          {locationData.coordinates.lat.toFixed(6)}, {locationData.coordinates.lng.toFixed(6)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  MAP FEATURE - Inline feature info with subtle visual distinction
                  Shows captured Mapbox feature metadata from click location
                  Admin only - shows accordion dropdown and metadata details
                  ═══════════════════════════════════════════════════════════════ */}
              {locationData && pinFeature && !isDropHeartExpanded && (
                <div className="relative border-b-0">
                  {/* Accordion Button - Icon and Name - Admin only shows dropdown arrow */}
                  {isAdmin ? (
                    <button
                      onClick={() => setIsMetadataOpen(!isMetadataOpen)}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer border-b-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm flex-shrink-0">{pinFeature.icon}</span>
                        <span className="text-xs font-medium text-gray-900 truncate">
                          {pinFeature.name || (pinFeature.properties.class ? pinFeature.properties.class.replace(/_/g, ' ') : pinFeature.label)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isMetadataOpen ? (
                          <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                        ) : (
                          <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="w-full flex items-center px-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm flex-shrink-0">{pinFeature.icon}</span>
                        <span className="text-xs font-medium text-gray-900 truncate">
                          {pinFeature.name || (pinFeature.properties.class ? pinFeature.properties.class.replace(/_/g, ' ') : pinFeature.label)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Accordion Content - Type info, Layer info, and Properties - Admin only */}
                  {isAdmin && isMetadataOpen && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {/* Type info - subtle inline display */}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                        {/* Home indicator badge - only for residential buildings */}
                        {(() => {
                          // Check if this is actually a residential building/home
                          const buildingType = (pinFeature.properties.type || '').toLowerCase();
                          const buildingClass = (pinFeature.properties.class || '').toLowerCase();
                          const residentialTypes = ['home', 'house', 'residential', 'detached', 'semidetached_house', 
                                                    'terrace', 'bungalow', 'cabin', 'farm', 'houseboat', 'static_caravan'];
                          const isResidential = residentialTypes.includes(buildingType) ||
                                               buildingClass === 'residential' ||
                                               pinFeature.category === 'house';
                          
                          return isResidential ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-medium rounded">
                              <HomeIcon className="w-2.5 h-2.5" />
                              Home
                            </span>
                          ) : null;
                        })()}
                        {pinFeature.properties.class && (
                          <span className="text-[10px] text-gray-500 capitalize">
                            {pinFeature.properties.class.replace(/_/g, ' ')}
                          </span>
                        )}
                        {pinFeature.properties.class && pinFeature.properties.type && pinFeature.properties.type !== pinFeature.properties.class && (
                          <span className="text-gray-300">·</span>
                        )}
                        {pinFeature.properties.type && pinFeature.properties.type !== pinFeature.properties.class && (
                          <span className="text-[10px] text-gray-400 capitalize">
                            {pinFeature.properties.type.replace(/_/g, ' ')}
                          </span>
                        )}
                        {!pinFeature.properties.class && !pinFeature.properties.type && !pinFeature.showIntelligence && (
                          <span className="text-[10px] text-gray-400">
                            {pinFeature.category}
                          </span>
                        )}
                      </div>

                      {/* Layer Info */}
                      <div className="text-[9px] text-gray-500 font-mono space-y-0.5 pt-1 border-t border-gray-100">
                        <div><span className="text-gray-400">layer:</span> {pinFeature.layerId}</div>
                        {pinFeature.sourceLayer && (
                          <div><span className="text-gray-400">source:</span> {pinFeature.sourceLayer}</div>
                        )}
                        <div><span className="text-gray-400">category:</span> {pinFeature.category}</div>
                        {pinFeature.atlasType && (
                          <div><span className="text-gray-400">atlasType:</span> {pinFeature.atlasType}</div>
                        )}
                      </div>

                      {/* Properties */}
                      {Object.keys(pinFeature.properties).length > 0 && (
                        <div className="text-[9px] text-gray-500 font-mono space-y-0.5 pt-1 border-t border-gray-100">
                          <div className="text-[10px] font-medium text-gray-600 mb-0.5">Properties:</div>
                          {Object.entries(pinFeature.properties).map(([key, value]) => (
                            <div key={key} className="pl-2">
                              <span className="text-gray-400">{key}:</span> <span className="text-gray-600">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* ═══════════════════════════════════════════════════════════════
                  ATLAS ENTITY - Accordion with admin-only raw response
                  Shows atlas entity details (parks, schools, cities, etc.)
                  Admin only - shows accordion dropdown and raw response
                  ═══════════════════════════════════════════════════════════════ */}
              {atlasEntityData && locationData && !isDropHeartExpanded && (
                <div className="relative border-b-0">
                  {atlasEntityLoading && (
                    <div className="text-center py-3">
                      <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-1.5" />
                      <p className="text-[10px] text-gray-600">Loading entity data...</p>
                    </div>
                  )}
                  
                  {atlasEntityError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-2">
                      <p className="text-xs font-medium text-red-800">Error</p>
                      <p className="text-xs text-red-600 mt-1">{atlasEntityError}</p>
                    </div>
                  )}
                  
                  {!atlasEntityLoading && !atlasEntityError && atlasEntityData && atlasEntityTableName && (() => {
                    const tableName = atlasEntityTableName;
                    const iconPath = ATLAS_ICON_MAP[tableName] || '/custom.png';
                    const entityLabel = ATLAS_ENTITY_LABELS[tableName] || tableName;
                    
                    return (
                      <>
                        {/* Accordion Button - Icon and Name - Admin only shows dropdown arrow */}
                        {isAdmin ? (
                          <button
                            onClick={() => setIsAtlasEntityOpen(!isAtlasEntityOpen)}
                            className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer border-b-0"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {iconPath && (
                                <div className="relative w-4 h-4 flex-shrink-0">
                                  <Image
                                    src={iconPath}
                                    alt={entityLabel}
                                    width={16}
                                    height={16}
                                    className="w-full h-full object-contain"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <span className="text-xs font-medium text-gray-900 truncate">
                                {atlasEntityData.name || entityLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isAtlasEntityOpen ? (
                                <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                              ) : (
                                <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                              )}
                            </div>
                          </button>
                        ) : (
                          <div className="w-full flex items-center px-2 py-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {iconPath && (
                                <div className="relative w-4 h-4 flex-shrink-0">
                                  <Image
                                    src={iconPath}
                                    alt={entityLabel}
                                    width={16}
                                    height={16}
                                    className="w-full h-full object-contain"
                                    unoptimized
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-gray-900 truncate">
                                  {atlasEntityData.name || entityLabel}
                                </span>
                                <p className="text-[10px] text-gray-500">{entityLabel}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Accordion Content - Description, Action Button, and Raw Response - Admin only */}
                        {isAdmin && isAtlasEntityOpen && (
                          <div className="px-2 pb-2 space-y-2">
                            {/* Description */}
                            {atlasEntityData.description && (
                              <p className="text-xs text-gray-600 pt-1 border-t border-gray-100">
                                {atlasEntityData.description}
                              </p>
                            )}

                            {/* Raw Response Accordion - Admin only */}
                            <div className="border-t border-gray-200 pt-2">
                              <button
                                onClick={() => setIsAtlasEntityRawOpen(!isAtlasEntityRawOpen)}
                                className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 transition-colors"
                              >
                                <span className="text-xs font-medium text-gray-700">Raw Response</span>
                                {isAtlasEntityRawOpen ? (
                                  <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                                ) : (
                                  <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                                )}
                              </button>

                              {isAtlasEntityRawOpen && (
                                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                                  <div className="max-h-[150px] overflow-y-auto">
                                    <table className="w-full text-xs">
                                      <thead className="sticky top-0 bg-gray-100">
                                        <tr className="border-b border-gray-200">
                                          <th className="text-left p-2 font-semibold text-gray-700">Key</th>
                                          <th className="text-left p-2 font-semibold text-gray-700">Value</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(atlasEntityData).map(([key, value]) => (
                                          <tr key={key} className="border-b border-gray-200 last:border-b-0">
                                            <td className="p-2 font-medium text-gray-600 align-top">{key}</td>
                                            <td className="p-2 text-gray-900 break-words">
                                              {value === null ? (
                                                <span className="text-gray-400 italic">null</span>
                                              ) : value === undefined ? (
                                                <span className="text-gray-400 italic">undefined</span>
                                              ) : typeof value === 'object' ? (
                                                <pre className="text-xs font-mono bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                                                  {JSON.stringify(value, null, 2)}
                                                </pre>
                                              ) : typeof value === 'boolean' ? (
                                                <span className="font-mono">{String(value)}</span>
                                              ) : (
                                                String(value)
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Non-admin content - Always visible */}
                        {!isAdmin && (
                          <div className="px-2 pb-2">
                            {/* Description */}
                            {atlasEntityData.description && (
                              <p className="text-xs text-gray-600">
                                {atlasEntityData.description}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  ADMIN PANEL: Compact admin tools - All open modal for review
                  ═══════════════════════════════════════════════════════════════ */}
              {isAdmin && locationData && (
                <div className="pt-2 border-t border-gray-200">
                  {(() => {
                    return (
                      <>
                        {/* City Edit - Update coordinates for existing city */}
                        {pinFeature?.category === 'city' && pinFeature?.name && (
                          <button
                            onClick={async () => {
                              if (!pinFeature?.name || !locationData?.coordinates) return;
                              
                              setIsUpdatingCityCoords(true);
                              setCityUpdateMessage(null);
                              
                              try {
                                const city = await findCityByName(pinFeature.name);
                                
                                if (!city) {
                                  setCityUpdateMessage({ type: 'error', text: `City "${pinFeature.name}" not found` });
                                  setIsUpdatingCityCoords(false);
                                  return;
                                }
                                
                                await updateCityCoordinates(city.id, locationData.coordinates.lat, locationData.coordinates.lng);
                                
                                // City coordinates updated - no layer refresh needed
                                setCityUpdateMessage({ type: 'success', text: `Updated ${pinFeature.name}` });
                                setTimeout(() => setCityUpdateMessage(null), 3000);
                              } catch (error) {
                                console.error('Error updating city:', error);
                                setCityUpdateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed' });
                              } finally {
                                setIsUpdatingCityCoords(false);
                              }
                            }}
                            disabled={isUpdatingCityCoords}
                            className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 rounded transition-colors disabled:opacity-50"
                          >
                            <Cog6ToothIcon className="w-3 h-3" />
                            <span>{isUpdatingCityCoords ? 'Updating...' : `Edit: ${pinFeature.name}`}</span>
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Coming Soon Modal */}
      {isComingSoonModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsComingSoonModalOpen(false)}
          />
          <div className="relative bg-white rounded-md border border-gray-200 p-[10px] max-w-sm w-full">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">{comingSoonFeature}</span>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              This feature is coming soon. We&apos;re working hard to bring you powerful new tools.
            </p>
            <button
              onClick={() => setIsComingSoonModalOpen(false)}
              className="w-full px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </>
  );
}

