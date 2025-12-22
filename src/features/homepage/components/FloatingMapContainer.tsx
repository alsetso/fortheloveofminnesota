'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { XMarkIcon, MagnifyingGlassIcon, Bars3Icon, Cog6ToothIcon, InformationCircleIcon, MapPinIcon, FingerPrintIcon, Square3Stack3DIcon, SparklesIcon, BuildingOffice2Icon, ExclamationTriangleIcon, AcademicCapIcon, SunIcon, GlobeAmericasIcon, ChevronDownIcon, ChevronUpIcon, WrenchScrewdriverIcon, AdjustmentsHorizontalIcon, PlusIcon, MinusIcon, ArrowPathIcon, CubeIcon, MapIcon, PlayIcon, StopIcon, HomeIcon, HeartIcon, CameraIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { PublicMapPinService } from '@/features/map-pins/services/publicMapPinService';
import { LocationLookupService } from '@/features/map-pins/services/locationLookupService';
import type { CreateMapPinData } from '@/types/map-pin';
import IntelligenceModal from '@/features/account/components/IntelligenceModal';
import { MAP_CONFIG } from '@/features/map/config';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import type { MapboxMapInstance, MapboxMouseEvent } from '@/types/mapbox-events';
import PinStatsCard from '@/features/pins/components/PinStatsCard';
import PinTrendingBadge from '@/features/pins/components/PinTrendingBadge';
import PinAnalyticsModal from '@/features/pins/components/PinAnalyticsModal';
import AtlasEntityModal, { type AtlasEntityData } from '@/features/atlas/components/AtlasEntityModal';
import type { AtlasEntityType } from '@/features/atlas/services/atlasService';
import { findCityByName, findCountyByName, updateCityCoordinates, deleteNeighborhood, deleteSchool, deletePark, deleteLake, deleteWatertower, deleteCemetery, deleteGolfCourse, deleteHospital, deleteAirport, deleteChurch, deleteMunicipal, deleteRoad } from '@/features/atlas/services/atlasService';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { supabase } from '@/lib/supabase';
import type { AtlasLayer } from '@/features/atlas/components/MapLayersPanel';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useWindowManager } from '@/components/ui/WindowManager';
import {
  useFeatureTracking,
  CursorTracker,
  FeatureCard,
  queryFeatureAtPoint,
  type ExtractedFeature,
  CATEGORY_CONFIG,
} from '@/features/map-metadata';
import { POIService, type CreatePOIData } from '@/features/poi/services/poiService';

// NOTE: Feature categorization is now handled by src/features/map-metadata/services/featureService.ts

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

interface PinData {
  id: string;
  name: string;
  description?: string | null;
  media_url?: string | null;
  address?: string | null;
  coordinates: { lat: number; lng: number };
  created_at: string;
  account?: {
    id: string;
    username: string | null;
    image_url: string | null;
  } | null;
}

// FeatureMetadata is now imported from map-metadata feature as ExtractedFeature

interface AtlasEntity {
  id: string;
  name: string;
  slug?: string;
  layerType: 'cities' | 'counties' | 'neighborhoods' | 'schools' | 'parks' | 'lakes' | 'watertowers' | 'cemeteries' | 'golf_courses' | 'hospitals' | 'airports' | 'churches' | 'municipals' | 'roads';
  emoji: string;
  lat: number;
  lng: number;
  school_type?: string;
  park_type?: string;
  hospital_type?: string;
  church_type?: string;
  denomination?: string;
  course_type?: string;
  holes?: number;
  airport_type?: string;
  iata_code?: string;
  icao_code?: string;
  municipal_type?: string;
  description?: string;
  address?: string;
  phone?: string;
  website_url?: string;
  city_id?: string;
  county_id?: string;
  is_public?: boolean;
  district?: string;
  [key: string]: any;
}

interface LocationSidebarProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  isOpen?: boolean;
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  onPinClick?: (pinData: { id: string; name: string; coordinates: { lat: number; lng: number }; address?: string; description?: string }) => void;
  // Atlas layers
  layers?: AtlasLayer[];
  onToggleLayer?: (layerId: string) => void;
}

export default function LocationSidebar({ 
  map, 
  mapLoaded,
  isOpen = true,
  onLocationSelect,
  onPinClick,
  layers,
  onToggleLayer,
}: LocationSidebarProps) {
  // Auth state - use isLoading to ensure auth is initialized before making decisions
  const { user, account, isLoading: authLoading } = useAuthStateSafe();
  const { openWelcome, openOnboarding, openAccount } = useAppModalContextSafe();
  
  // Ref to access current auth state in event handlers (avoids stale closures)
  const userRef = useRef(user);
  const accountRef = useRef(account);
  const authLoadingRef = useRef(authLoading);
  
  useEffect(() => {
    userRef.current = user;
    accountRef.current = account;
    authLoadingRef.current = authLoading;
  }, [user, account, authLoading]);
  const { openWindow } = useWindowManager();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Check if POI mode is active
  const isPOIMode = searchParams.get('tab') === 'poi';
  
  // POI creation state
  const [poiClickLocation, setPoiClickLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [poiFeature, setPoiFeature] = useState<ExtractedFeature | null>(null);
  const [showDropPinButton, setShowDropPinButton] = useState(false);
  const [isCreatingPOI, setIsCreatingPOI] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // Local Selection State (not in URL)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const [selectedAtlasEntity, setSelectedAtlasEntity] = useState<AtlasEntity | null>(null);
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
    setSelectedPin(null);
    setSelectedAtlasEntity(null);
    setCapturedFeature(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // Local Modal State (not in URL)
  // ═══════════════════════════════════════════════════════════════════════════
  
  const [isIntelligenceModalOpen, setIsIntelligenceModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [isAtlasEntityModalOpen, setIsAtlasEntityModalOpen] = useState(false);
  
  const [analyticsPinId, setAnalyticsPinId] = useState<string | null>(null);
  const [analyticsPinName, setAnalyticsPinName] = useState<string | null>(null);
  const [atlasEntityModalMode, setAtlasEntityModalMode] = useState<'create' | 'edit'>('create');
  const [atlasEntityType, setAtlasEntityType] = useState<AtlasEntityType>('neighborhood');
  const [atlasEntityFeatureName, setAtlasEntityFeatureName] = useState<string | undefined>(undefined);
  const [atlasEntityFeatureProperties, setAtlasEntityFeatureProperties] = useState<Record<string, any> | undefined>(undefined);
  const [atlasEntityToEdit, setAtlasEntityToEdit] = useState<AtlasEntityData | undefined>(undefined);
  const [comingSoonFeature, setComingSoonFeature] = useState<string>('');

  // Modal openers
  const openIntelligenceModal = useCallback(() => {
    setIsIntelligenceModalOpen(true);
  }, []);

  const openAnalyticsModal = useCallback((pinId: string, pinName?: string) => {
    setAnalyticsPinName(pinName || null);
    setAnalyticsPinId(pinId);
    setIsAnalyticsModalOpen(true);
  }, []);

  const openComingSoonModal = useCallback((feature: string) => {
    setComingSoonFeature(feature);
    setIsComingSoonModalOpen(true);
  }, []);

  const openAtlasEntityModal = useCallback((
    mode: 'create' | 'edit',
    entityType: AtlasEntityType,
    featureName?: string,
    entityToEdit?: AtlasEntityData,
    featureProperties?: Record<string, any>
  ) => {
    setAtlasEntityType(entityType);
    setAtlasEntityFeatureName(featureName);
    setAtlasEntityFeatureProperties(featureProperties);
    setAtlasEntityToEdit(entityToEdit);
    setAtlasEntityModalMode(mode);
    setIsAtlasEntityModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsIntelligenceModalOpen(false);
    setIsAnalyticsModalOpen(false);
    setIsComingSoonModalOpen(false);
    setIsAtlasEntityModalOpen(false);
    setAnalyticsPinId(null);
    setAnalyticsPinName(null);
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
  const [activePanel, setActivePanel] = useState<'none' | 'menu' | 'controls'>('none');
  
  // Derived state for backward compatibility
  const isMenuOpen = activePanel === 'menu';
  const isMapControlsOpen = activePanel === 'controls';
  const [is3DMode, setIs3DMode] = useState(true); // Default to 3D
  const [showRoadLabels, setShowRoadLabels] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'moderation' | 'press'>('about');
  const [mapControlsTab, setMapControlsTab] = useState<'controls' | 'layers'>('controls');
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
  const [isDeletingAtlasEntity, setIsDeletingAtlasEntity] = useState(false);
  const [atlasEntityMessage, setAtlasEntityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [isScreenshotPreviewOpen, setIsScreenshotPreviewOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isPinDetailsExpanded, setIsPinDetailsExpanded] = useState(false);
  const [isAtlasEntityExpanded, setIsAtlasEntityExpanded] = useState(false);
  const [isLocationDetailsExpanded, setIsLocationDetailsExpanded] = useState(false);
  
  // Inline pin creation form state
  const [isDropHeartExpanded, setIsDropHeartExpanded] = useState(false);
  const [pinDescription, setPinDescription] = useState('');
  const [pinSelectedFile, setPinSelectedFile] = useState<File | null>(null);
  const [pinEventYear, setPinEventYear] = useState<string>('');
  
  const [pinFilePreview, setPinFilePreview] = useState<string | null>(null);
  const [pinVisibility, setPinVisibility] = useState<'public' | 'only_me'>('public');
  const [pinHideLocation, setPinHideLocation] = useState(false);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);
  const [isPinUploading, setIsPinUploading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [showVisibilityTooltip, setShowVisibilityTooltip] = useState(false);
  const [showCameraTooltip, setShowCameraTooltip] = useState(false);
  const pinFileInputRef = useRef<HTMLInputElement>(null);
  
  // Feature tracking hook - handles hover and click feature capture with throttling
  const {
    hoverFeature,
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

  // Reset pin form when location changes
  useEffect(() => {
    if (isDropHeartExpanded) {
      setIsDropHeartExpanded(false);
      setPinDescription('');
      setPinSelectedFile(null);
      setPinFilePreview(null);
      setPinVisibility('public');
      setPinError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData?.coordinates?.lat, locationData?.coordinates?.lng]);


  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const mapControlsRef = useRef<HTMLDivElement>(null);
  const mapControlsPanelRef = useRef<HTMLDivElement>(null);
  const spinAnimationRef = useRef<number | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const temporaryMarkerRef = useRef<any>(null);

  // Fetch current user's account info (ID, plan, and role)
  useEffect(() => {
    const fetchAccountInfo = async () => {
      if (!user) {
        setCurrentUserAccountId(null);
        setCurrentUserPlan('hobby');
        setIsAdmin(false);
        return;
      }

      try {
        const { data: account, error } = await supabase
          .from('accounts')
          .select('id, plan, role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching account info:', error);
          return;
        }

        if (account) {
          setCurrentUserAccountId(account.id);
          setCurrentUserPlan((account.plan as 'hobby' | 'pro' | 'plus') || 'hobby');
          setIsAdmin(account.role === 'admin');
        }
      } catch (err) {
        console.error('Error fetching account info:', err);
      }
    };

    fetchAccountInfo();
  }, [user]);

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

      // Create temporary marker element with heart image
      const el = document.createElement('div');
      el.className = 'temporary-pin-marker';
      el.style.cssText = `
        width: 32px;
        height: 32px;
        cursor: pointer;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const img = document.createElement('img');
      img.src = '/heart.png';
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
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
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  }, [searchLocations]);

  // Screenshot capture function
  const captureMapScreenshot = useCallback(async (): Promise<string | null> => {
    if (!map || !mapLoaded) {
      return null;
    }

    setIsCapturingScreenshot(true);

    try {
      // Wait for map to finish rendering
      await new Promise<void>((resolve) => {
        if ((map as any).loaded()) {
          resolve();
        } else {
          (map as any).once('idle', () => resolve());
        }
      });

      // Small delay to ensure everything is rendered
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      const canvas = (map as any).getCanvas() as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas not available');
      }

      // Check if canvas is valid
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas has invalid dimensions');
      }

      const dataUrl = canvas.toDataURL('image/png', 0.9);
      
      // Validate data URL
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Invalid screenshot data');
      }
      
      setIsCapturingScreenshot(false);
      return dataUrl;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      setIsCapturingScreenshot(false);
      return null;
    }
  }, [map, mapLoaded]);

  // Handle screenshot button click
  const handleScreenshotClick = useCallback(async () => {
    const screenshotData = await captureMapScreenshot();
    if (screenshotData) {
      setScreenshot(screenshotData);
      setIsScreenshotPreviewOpen(true);
    }
  }, [captureMapScreenshot]);

  // Handle suggestion select
  const handleSuggestionSelect = useCallback(async (feature: MapboxFeature) => {
    const coordinates = {
      lat: feature.center[1],
      lng: feature.center[0],
    };

    setSearchQuery(feature.place_name);
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

    // Add temporary pin
    addTemporaryPin(coordinates);

    // Dispatch event to close any open pin popup
    window.dispatchEvent(new CustomEvent('location-selected-on-map'));

    // Get feature metadata at selected location (convert coordinates to point)
    if (map && !map.removed) {
      const point = (map as any).project([coordinates.lng, coordinates.lat]);
      const pinMetadata = queryFeatureAtPoint(map, point);
      setPinFeature(pinMetadata);
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
    setPinHideLocation(false);
    setPinEventYear('');
    setPinError(null);
    if (pinFileInputRef.current) {
      pinFileInputRef.current.value = '';
    }
  }, []);

  const handlePinFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!pinDescription.trim() && !pinSelectedFile) {
      setPinError('Please add a caption or photo');
      return;
    }

    // Require authentication to create pins
    // Check ref to get current auth state (avoids stale closure issues)
    if (authLoadingRef.current) {
      setPinError('Checking authentication...');
      return;
    }

    if (!userRef.current) {
      setPinError('Please sign in to create pins');
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
      let mediaUrl: string | null = null;

      if (pinSelectedFile) {
        // Require signed-in user to upload media server-side
        // Check ref to get current auth state (avoids stale closure issues)
        if (!userRef.current) {
          throw new Error('Please sign in to upload photos and videos');
        }
        
        setIsPinUploading(true);
        
        const fileExt = pinSelectedFile.name.split('.').pop();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        // userRef.current is guaranteed to be non-null here (checked earlier)
        const accountId = userRef.current!.id;
        const fileName = `${accountId}/map-pins/${timestamp}-${random}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('map-pins-media')
          .upload(fileName, pinSelectedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('map-pins-media')
          .getPublicUrl(fileName);

        if (!urlData?.publicUrl) {
          throw new Error('Failed to get file URL');
        }

        mediaUrl = urlData.publicUrl;
        setIsPinUploading(false);
      }

      const locationIds = await LocationLookupService.getLocationIds(
        locationData.coordinates.lat,
        locationData.coordinates.lng
      );

      const cityId = locationIds.cityId && locationIds.cityId.length === 36 
        ? locationIds.cityId 
        : undefined;
      const countyId = locationIds.countyId && locationIds.countyId.length === 36 
        ? locationIds.countyId 
        : undefined;

      // If hide_location is enabled, fetch city coordinates
      let finalLat = locationData.coordinates.lat;
      let finalLng = locationData.coordinates.lng;
      
      // Use cityId from location lookup, or try locationData.cityId/parentCityId
      const effectiveCityId = cityId || locationData.cityId || locationData.parentCityId;
      
      if (pinHideLocation && effectiveCityId) {
        try {
          const { data: cityData, error: cityError } = await supabase
            .from('cities')
            .select('lat, lng')
            .eq('id', effectiveCityId)
            .single();
          
          if (!cityError && cityData && cityData.lat && cityData.lng) {
            finalLat = Number(cityData.lat);
            finalLng = Number(cityData.lng);
          } else {
            // If city coordinates not available, show error
            setPinError('City coordinates not available. Cannot hide location.');
            setIsPinSubmitting(false);
            setIsPinUploading(false);
            return;
          }
        } catch (err) {
          console.error('[LocationSidebar] Error fetching city coordinates:', err);
          setPinError('Failed to fetch city coordinates. Cannot hide location.');
          setIsPinSubmitting(false);
          setIsPinUploading(false);
          return;
        }
      } else if (pinHideLocation && !effectiveCityId) {
        // No cityId available
        setPinError('City not found. Cannot hide location without a city.');
        setIsPinSubmitting(false);
        setIsPinUploading(false);
        return;
      }

      // Capture location metadata from Mapbox feature
      const locationMetadata = pinFeature ? {
        layerId: pinFeature.layerId,
        sourceLayer: pinFeature.sourceLayer,
        name: pinFeature.name,
        category: pinFeature.category,
        class: pinFeature.properties?.class || null,
        type: pinFeature.properties?.type || null,
        properties: pinFeature.properties,
      } : null;

      // Capture atlas metadata if pin is on an atlas entity
      const atlasMetadata = selectedAtlasEntity ? {
        entityId: selectedAtlasEntity.id,
        entityType: selectedAtlasEntity.layerType,
        name: selectedAtlasEntity.name,
        emoji: selectedAtlasEntity.emoji,
      } : null;

      // Convert year to date string (January 1st of that year)
      const eventDate = pinEventYear 
        ? `${pinEventYear}-01-01T00:00:00.000Z`
        : null;

      const pinData: CreateMapPinData = {
        lat: finalLat,
        lng: finalLng,
        description: pinDescription.trim() || null,
        media_url: mediaUrl,
        city_id: effectiveCityId,
        county_id: countyId,
        visibility: pinVisibility,
        location_metadata: locationMetadata,
        atlas_metadata: atlasMetadata,
        event_date: eventDate,
        hide_location: pinHideLocation && effectiveCityId ? true : false,
      };

      await PublicMapPinService.createPin(pinData);

      // Reset form and remove temporary marker
      resetPinForm();
      removeTemporaryPin();

      // Trigger pins refresh via custom event
      window.dispatchEvent(new CustomEvent('pin-created'));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create pin';
      console.error('[LocationSidebar] Error creating pin:', errorMessage, err);
      setPinError(errorMessage);
    } finally {
      setIsPinSubmitting(false);
      setIsPinUploading(false);
    }
  }, [locationData, pinDescription, pinSelectedFile, pinVisibility, pinHideLocation, user, resetPinForm, removeTemporaryPin, pinFeature, selectedAtlasEntity, openOnboarding, openWelcome]);

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

  // Close map controls dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideButton = mapControlsRef.current?.contains(target);
      const isInsidePanel = mapControlsPanelRef.current?.contains(target);
      
      if (!isInsideButton && !isInsidePanel) {
        setActivePanel('none');
      }
    };

    if (isMapControlsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isMapControlsOpen]);

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
    };

    window.addEventListener('pin-popup-opening', handlePinPopupOpening as EventListener);

    return () => {
      window.removeEventListener('pin-popup-opening', handlePinPopupOpening as EventListener);
    };
  }, [removeTemporaryPin, clearSelection]);


  // Listen for atlas entity clicks
  useEffect(() => {
    const handleAtlasEntityClick = (event: CustomEvent<AtlasEntity>) => {
      const entity = event.detail;
      
      // Clear temporary pin
      removeTemporaryPin();
      
      // Set the selected atlas entity (clears other selections automatically)
      setSelectedAtlasEntity(entity);
      setAtlasEntityMessage(null);
      
      // Fly to the entity location
      if (map && mapLoaded && entity.lat && entity.lng) {
        (map as any).flyTo({
          center: [entity.lng, entity.lat],
          zoom: 14,
          duration: 1000,
        });
      }
    };

    window.addEventListener('atlas-entity-click', handleAtlasEntityClick as EventListener);

    return () => {
      window.removeEventListener('atlas-entity-click', handleAtlasEntityClick as EventListener);
    };
  }, [map, mapLoaded, removeTemporaryPin]);

  // Listen for double-click on map to show location and expand pin form
  useEffect(() => {
    const handleShowLocationForPin = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { lat, lng } = customEvent.detail;
      
      // Reverse geocode and select the location
      const geocodedData = await reverseGeocode(lat, lng);
      setLocationData({
        coordinates: { lat, lng },
        placeName: geocodedData.city || geocodedData.locality || undefined,
        address: geocodedData.address || undefined,
        type: 'map-click',
      });
      
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

    window.addEventListener('show-location-for-pin', handleShowLocationForPin);

    return () => {
      window.removeEventListener('show-location-for-pin', handleShowLocationForPin);
    };
  }, [map, mapLoaded, reverseGeocode, addTemporaryPin]);

  const handleMapClick = useCallback(async (e: MapboxMouseEvent) => {
    if (!map || !mapLoaded) return;
    
    const { lng, lat } = e.lngLat;
    
    // POI Mode: Check for POI label in map metadata
    if (isPOIMode) {
      try {
        // Query map metadata layer for POI label
        const feature = queryFeatureAtPoint(map, e.point);
        
        if (feature && feature.hasUsefulData && feature.name) {
          // POI label found - show drop pin button
          setPoiClickLocation({ lat, lng });
          setPoiFeature(feature);
          setShowDropPinButton(true);
          
          // Incrementally zoom in on click
          const mapboxMap = map as any;
          const currentZoom = mapboxMap.getZoom();
          const zoomIncrement = 2;
          const targetZoom = Math.min(currentZoom + zoomIncrement, MAP_CONFIG.MAX_ZOOM);
          
          mapboxMap.flyTo({
            center: [lng, lat],
            zoom: targetZoom,
            duration: 1000,
          });
          
          return; // Don't continue with normal map click behavior
        } else {
          // No POI label found - hide button
          setShowDropPinButton(false);
          setPoiClickLocation(null);
          setPoiFeature(null);
        }
      } catch (error) {
        console.error('[FloatingMapContainer] Error querying POI feature:', error);
        setShowDropPinButton(false);
      }
      return; // In POI mode, don't do normal map click behavior
    }
    
    // Normal mode: Check if click hit a pin or atlas entity - if so, don't show map click data
    try {
      const mapboxMap = map as any;
      const layersToCheck = [
        // User pins
        'map-pins-point',
        'map-pins-point-label',
        // Atlas layers
        'atlas-cities-points',
        'atlas-counties-points',
        'atlas-neighborhoods-points',
        'atlas-schools-points',
        'atlas-parks-points',
        'atlas-lakes-points',
        'atlas-watertowers-points',
        'atlas-cemeteries-points',
        'atlas-golf_courses-points',
        'atlas-hospitals-points',
        'atlas-airports-points',
        'atlas-churches-points',
        'atlas-municipals-points',
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

        // If a pin or atlas entity was clicked, don't show map click data (their click handlers will handle it)
        if (features.length > 0) {
          return;
        }
      }
    } catch (queryError) {
      // Continue with map click if query fails
    }

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

  }, [map, mapLoaded, addTemporaryPin, reverseGeocode, isPOIMode, user, account]);
  
  // Handle POI creation
  const handleCreatePOI = useCallback(async () => {
    if (!poiClickLocation || !poiFeature || !user || !account || isCreatingPOI) return;
    
    setIsCreatingPOI(true);
    
    try {
      const poiData: CreatePOIData = {
        name: poiFeature.name || poiFeature.displayLabel || 'Unnamed POI',
        category: poiFeature.category,
        type: poiFeature.properties.type || poiFeature.category,
        location: poiClickLocation,
        emoji: poiFeature.icon || null,
        description: poiFeature.displayLabel,
        mapbox_source: poiFeature.sourceLayer || null,
        mapbox_source_layer: poiFeature.sourceLayer || null,
        mapbox_layer_id: poiFeature.layerId || null,
        mapbox_properties: poiFeature.properties || null,
        metadata: {
          category: poiFeature.category,
          label: poiFeature.label,
          displayLabel: poiFeature.displayLabel,
        },
      };
      
      await POIService.createPOI(poiData);
      
      // Reset state
      setShowDropPinButton(false);
      setPoiClickLocation(null);
      setPoiFeature(null);
      
      // Dispatch event to refresh POI list
      window.dispatchEvent(new CustomEvent('poi-created'));
      
      // Show success feedback (optional)
      console.log('[FloatingMapContainer] POI created successfully');
    } catch (error) {
      console.error('[FloatingMapContainer] Error creating POI:', error);
      // You could show an error toast here
    } finally {
      setIsCreatingPOI(false);
    }
  }, [poiClickLocation, poiFeature, user, account, isCreatingPOI]);
  
  // Clear POI state when exiting POI mode
  useEffect(() => {
    if (!isPOIMode) {
      setShowDropPinButton(false);
      setPoiClickLocation(null);
      setPoiFeature(null);
    }
  }, [isPOIMode]);

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideButton = menuRef.current?.contains(target);
      const isInsidePanel = menuPanelRef.current?.contains(target);
      
      if (!isInsideButton && !isInsidePanel) {
        setActivePanel('none');
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isMenuOpen]);

  // Close location details when menu opens (but keep selected pin if it exists)
  useEffect(() => {
    if (isMenuOpen && locationData) {
      clearSelection();
      removeTemporaryPin();
    }
  }, [isMenuOpen, locationData, removeTemporaryPin, clearSelection]);

  // Close menu when any data opens
  // Close all dropdowns when location data appears
  useEffect(() => {
    if (locationData || selectedPin) {
      setActivePanel('none');
    }
  }, [locationData, selectedPin]);

  // Fast panel switching - single state update clears location and switches panel
  const openMenu = useCallback(() => {
    setShowSuggestions(false);
    setLocationData(null);
    setSelectedPin(null);
    setSelectedAtlasEntity(null);
    setPinFeature(null);
    setActivePanel('menu');
  }, []);

  const openMapControls = useCallback(() => {
    setShowSuggestions(false);
    setLocationData(null);
    setSelectedPin(null);
    setSelectedAtlasEntity(null);
    setPinFeature(null);
    setActivePanel('controls');
  }, []);

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

  // Sidebar expands if either location data, selected pin, selected atlas entity exists, or search is focused
  const hasData = locationData !== null || selectedPin !== null || selectedAtlasEntity !== null;
  const isExpanded = hasData || isSearchFocused;
  
  // Determine width based on state: panels open = wider, expanded = medium, collapsed = narrow
  const getSidebarWidth = () => {
    if (isMenuOpen || isMapControlsOpen) {
      // Panels open - widest
      return 'w-full lg:w-[500px]';
    } else if (isExpanded) {
      // Has data or search focused - medium
      return 'w-full lg:w-[500px]';
    } else {
      // Collapsed - narrow (default 500px)
      return 'w-full lg:w-[500px]';
    }
  };

  // Search input is always in the sidebar
  // When collapsed (no data), background is transparent but search stays visible
  // When expanded (has data), background appears with blur effect
  if (!isOpen) return null;

  return (
    <>
      {/* Sidebar Container */}
      <div 
        className={`
          fixed bottom-0 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-in-out
          h-auto max-h-full bg-transparent
          ${getSidebarWidth()}
        `}
        style={{
          pointerEvents: 'auto',
        }}
      >
        <div className="flex flex-col p-4 lg:p-4">
        {/* Cursor Tracker - Above sidebar */}
        <CursorTracker feature={hoverFeature} className="mb-2 hidden lg:block" />
        
        {/* Sidebar Card Container - Unified container for toolbar and all dropdowns */}
        <div className="relative bg-white border border-gray-200 rounded-lg overflow-hidden transition-all duration-300 ease-in-out" style={{ pointerEvents: 'auto', zIndex: 50 }}>
          {/* Inline Panels - Menu, Controls, or Suggestions - Above toolbar */}
          {isMenuOpen && (
            <div ref={menuPanelRef} className="border-b border-gray-200 transition-all duration-300 ease-in-out" onClick={(e) => e.stopPropagation()}>
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab('about'); }}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === 'about'
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }`}
                >
                  About
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab('moderation'); }}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === 'moderation'
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }`}
                >
                  Moderation
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab('press'); }}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === 'press'
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }`}
                >
                  Press
                </button>
              </div>

              {/* Tab Content */}
              <div className="max-h-80 overflow-y-auto">
                {activeTab === 'about' && (
                  <div className="p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">About Us</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.
                    </p>
                  </div>
                )}

                {activeTab === 'moderation' && (
                  <div className="p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Moderation Guidelines</h3>
                    <p className="text-xs text-gray-600 leading-relaxed mb-3">
                      Posts are moderated to maintain a safe and respectful environment for the For the Love of Minnesota community.
                    </p>
                    <div className="space-y-2">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">1. Breaches of Privacy:</span> Posts containing personal identifying information (names, phone numbers, email addresses, social media handles, exact addresses) without consent.
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">2. Hate Speech:</span> Posts that degrade or threaten based on race, ethnicity, citizenship, ability, sexuality, sex, gender, or class.
                      </div>
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">3. Spam/Unauthorized Advertising:</span> Spam posts or unauthorized advertisements that don&apos;t align with our community guidelines.
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mt-3">
                      Moderation is in place to ensure a safe and respectful environment for all Minnesota residents, neighbors, and professionals.
                    </p>
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-gray-900 mb-1">Request Removal</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        To request removal of a post or report content concerns, please contact{' '}
                        <a href="mailto:hi@fortheloveofminnesota.com" className="text-gray-900 hover:underline">
                          hi@fortheloveofminnesota.com
                        </a>
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'press' && (
                  <div className="p-4 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Press</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      For media inquiries, press releases, or interview requests about For the Love of Minnesota, please contact our team.
                    </p>
                    <div className="mt-3">
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Press Contact:{' '}
                        <a href="mailto:hi@fortheloveofminnesota.com" className="text-gray-900 hover:underline">
                          hi@fortheloveofminnesota.com
                        </a>
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Map Controls Panel - Inline */}
          {isMapControlsOpen && (
            <div ref={mapControlsPanelRef} className="border-b border-gray-200 transition-all duration-300 ease-in-out" onClick={(e) => e.stopPropagation()}>
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={(e) => { e.stopPropagation(); setMapControlsTab('controls'); }}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                    mapControlsTab === 'controls'
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }`}
                >
                  Controls
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMapControlsTab('layers'); }}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                    mapControlsTab === 'layers'
                      ? 'text-gray-900 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }`}
                >
                  Layers
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-2">
                {mapControlsTab === 'controls' && (
                  <>
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 mb-2">
                      <button
                        onClick={handleZoomIn}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Zoom In"
                      >
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>Zoom In</span>
                      </button>
                      <button
                        onClick={handleZoomOut}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        title="Zoom Out"
                      >
                        <MinusIcon className="w-3.5 h-3.5" />
                        <span>Zoom Out</span>
                      </button>
                    </div>

                    {/* 3D Toggle */}
                    <button
                      onClick={handleToggle3D}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                        is3DMode 
                          ? 'text-gray-900 bg-gray-100' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}
                    >
                      <CubeIcon className="w-3.5 h-3.5" />
                      <span>{is3DMode ? '3D View' : '2D View'}</span>
                      {is3DMode && <span className="ml-auto text-[9px] text-gray-500">ON</span>}
                    </button>

                    {/* Reset Rotation */}
                    <button
                      onClick={handleResetRotation}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="Reset Rotation"
                    >
                      <ArrowPathIcon className="w-3.5 h-3.5" />
                      <span>Reset Rotation</span>
                    </button>

                    {/* Divider */}
                    <div className="my-1.5 border-t border-gray-100" />

                    {/* Road Labels Toggle */}
                    <button
                      onClick={handleToggleRoadLabels}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                        showRoadLabels 
                          ? 'text-gray-900 bg-gray-100' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={showRoadLabels ? 'Hide Road Labels' : 'Show Road Labels'}
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      <span>Road Labels</span>
                      {showRoadLabels && <span className="ml-auto text-[9px] text-gray-500">ON</span>}
                    </button>

                    {/* Spin Map Toggle */}
                    <button
                      onClick={handleToggleSpin}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded transition-colors ${
                        isSpinning 
                          ? 'text-gray-900 bg-gray-100' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={isSpinning ? 'Stop Spinning' : 'Start Spinning'}
                    >
                      {isSpinning ? (
                        <StopIcon className="w-3.5 h-3.5" />
                      ) : (
                        <PlayIcon className="w-3.5 h-3.5" />
                      )}
                      <span>{isSpinning ? 'Stop Spin' : 'Spin Map'}</span>
                    </button>

                    {/* Divider */}
                    <div className="my-1.5 border-t border-gray-100" />

                    {/* Year Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Filter by Year
                      </label>
                      <input
                        type="number"
                        min={new Date().getFullYear() - 50}
                        max={new Date().getFullYear()}
                        value={searchParams.get('year') || ''}
                        onChange={(e) => {
                          const year = e.target.value ? parseInt(e.target.value, 10) : null;
                          const url = new URL(window.location.href);
                          if (year && !isNaN(year)) {
                            url.searchParams.set('year', year.toString());
                            // Trigger pins reload by dispatching event
                            window.dispatchEvent(new CustomEvent('pin-created'));
                          } else {
                            url.searchParams.delete('year');
                            window.dispatchEvent(new CustomEvent('pin-created'));
                          }
                          router.push(url.pathname + url.search);
                        }}
                        placeholder="All years"
                        className="w-full px-2 py-1.5 text-xs text-gray-900 border border-gray-200 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                      />
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Show only pins from this year
                      </p>
                    </div>
                  </>
                )}

                {mapControlsTab === 'layers' && (
                  <div>
                    {layers && layers.length > 0 ? (
                      <div className="space-y-0.5">
                        {layers.map((layer) => (
                          <button
                            key={layer.id}
                            onClick={() => onToggleLayer?.(layer.id)}
                            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{layer.icon}</span>
                              <span className="text-xs text-gray-900">{layer.name}</span>
                              {layer.count !== undefined && (
                                <span className="text-[10px] text-gray-500">({layer.count})</span>
                              )}
                            </div>
                            {layer.visible ? (
                              <EyeIcon className="w-4 h-4 text-gray-700" />
                            ) : (
                              <EyeSlashIcon className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 px-2">No layers available</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Suggestions Panel - Inline */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="border-b border-gray-200 max-h-64 overflow-y-auto transition-all duration-300 ease-in-out"
              style={{ pointerEvents: 'auto' }}
            >
              {suggestions.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => handleSuggestionSelect(feature)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-2.5 transition-colors border-b border-gray-100 last:border-b-0 ${
                    selectedIndex === index
                      ? 'bg-gray-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{feature.text}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{feature.place_name}</div>
                </button>
              ))}
            </div>
          )}

          {/* Toolbar Row */}
          <div className="relative flex items-center">
            {/* Hamburger Menu Icon */}
            <div ref={menuRef}>
              <button
                className={`flex items-center justify-center w-11 h-11 text-gray-700 hover:bg-gray-50 transition-all duration-150 pointer-events-auto ${
                  isMenuOpen ? 'bg-gray-100' : ''
                }`}
                title={isMenuOpen ? 'Close Menu' : 'Menu'}
                aria-label={isMenuOpen ? 'Close Menu' : 'Menu'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMenuOpen) {
                    setActivePanel('none');
                  } else {
                    openMenu();
                  }
                }}
              >
                {isMenuOpen ? (
                  <XMarkIcon className="w-5 h-5" />
                ) : (
                  <Bars3Icon className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Map Controls Icon */}
            <div ref={mapControlsRef} className="border-l border-gray-200">
              <button
                className={`flex items-center justify-center w-11 h-11 text-gray-700 hover:bg-gray-50 transition-all duration-150 pointer-events-auto ${
                  isMapControlsOpen ? 'bg-gray-100' : ''
                }`}
                title="Map Controls"
                aria-label="Map Controls"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isMapControlsOpen) {
                    setActivePanel('none');
                  } else {
                    openMapControls();
                  }
                }}
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Screenshot Icon */}
            <div className="border-l border-gray-200">
              <button
                className={`flex items-center justify-center w-11 h-11 text-gray-700 hover:bg-gray-50 transition-all duration-150 pointer-events-auto ${
                  isCapturingScreenshot ? 'bg-gray-100' : ''
                }`}
                title="Screenshot"
                aria-label="Capture Screenshot"
                onClick={(e) => {
                  e.stopPropagation();
                  handleScreenshotClick();
                }}
                disabled={isCapturingScreenshot || !mapLoaded}
              >
                {isCapturingScreenshot ? (
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                ) : (
                  <CameraIcon className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 border-l border-gray-200">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
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
                className="w-full pl-11 pr-10 py-3 text-sm bg-transparent border-0 text-gray-900 placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 transition-all"
                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 50 }}
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Content Sections - Only shown when expanded and no panel is open */}
          {isExpanded && !isMenuOpen && !isMapControlsOpen && !showSuggestions && (
            <div
              className="border-t border-gray-200 overflow-y-auto"
              style={{ 
                maxHeight: 'calc(100vh - 140px)',
                minHeight: 0,
              }}
            >
              <div className="p-4 space-y-3">

              {/* Search focused placeholder - shown when no location selected yet */}
              {isSearchFocused && !hasData && (
                <div className="text-center py-6">
                  <MapPinIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Search for a location or click on the map</p>
                  <p className="text-xs text-gray-400 mt-1">Location details will appear here</p>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  PRIMARY ACTION: Drop Heart - Inline expandable form
                  ═══════════════════════════════════════════════════════════════ */}
              {locationData && !selectedPin && (
                <div className="space-y-3">
                  {/* Expanded Form */}
                  {isDropHeartExpanded && (
                    <div className="space-y-2">
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
                          className="w-full px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none bg-transparent"
                          placeholder="What's going on here?"
                          rows={5}
                          disabled={isPinSubmitting || isPinUploading}
                        />
                        <div className="flex justify-end mt-0.5">
                          <span className={`text-[10px] ${pinDescription.length >= 240 ? 'text-red-500' : 'text-gray-400'}`}>
                            {pinDescription.length}/240
                          </span>
                        </div>
                      </div>

                      {/* Event Year Selector */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          When did this happen? (optional)
                        </label>
                        <input
                          type="number"
                          value={pinEventYear}
                          onChange={(e) => {
                            const yearValue = e.target.value;
                            setPinEventYear(yearValue);
                            
                            // Only validate when 4 digits are entered
                            if (yearValue && yearValue.length === 4) {
                              const year = parseInt(yearValue, 10);
                              const currentYear = new Date().getFullYear();
                              const hundredYearsAgo = currentYear - 100;
                              
                              if (isNaN(year)) {
                                setPinError('Please enter a valid year');
                                return;
                              }
                              
                              if (year > currentYear) {
                                setPinError('Year cannot be in the future');
                                return;
                              }
                              
                              if (year < hundredYearsAgo) {
                                setPinError('Year cannot be more than 100 years in the past');
                                return;
                              }
                              
                              setPinError(null);
                            } else if (!yearValue) {
                              // Clear error when field is empty
                              setPinError(null);
                            }
                            // Don't validate while typing (1-3 digits)
                          }}
                          min={new Date().getFullYear() - 100}
                          max={new Date().getFullYear()}
                          placeholder="e.g., 2025"
                          className="w-full px-3 py-2 text-xs text-gray-900 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                          disabled={isPinSubmitting || isPinUploading}
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Enter a year to filter this pin by year on the map (saved as January 1st of that year)
                        </p>
                      </div>

                      {/* Hide Location Toggle */}
                      {locationData && (
                        <div className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-md">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-900 mb-0.5">
                              Hide Location
                            </label>
                            <p className="text-[10px] text-gray-500">
                              {pinHideLocation 
                                ? 'Using city coordinates (defaults to city center)' 
                                : 'Use city coordinates instead of exact location'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPinHideLocation(!pinHideLocation)}
                            disabled={isPinSubmitting || isPinUploading}
                            className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                              pinHideLocation ? 'bg-gray-700' : 'bg-gray-300'
                            }`}
                            role="switch"
                            aria-checked={pinHideLocation}
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                pinHideLocation ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      )}

                      {/* Media Preview */}
                      {pinFilePreview && (
                        <div className="relative rounded-md overflow-hidden">
                          {pinSelectedFile?.type.startsWith('image/') ? (
                            <img
                              src={pinFilePreview}
                              alt="Preview"
                              className="w-full max-h-32 object-cover"
                            />
                          ) : (
                            <video
                              src={pinFilePreview}
                              className="w-full max-h-32 object-cover"
                              controls
                            />
                          )}
                          <button
                            type="button"
                            onClick={handleRemovePinFile}
                            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                            disabled={isPinSubmitting || isPinUploading}
                          >
                            <XCircleIcon className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      )}

                      {/* Camera Button and Visibility Toggle - Same Row */}
                      <div className="flex items-center justify-between gap-2">
                        {/* Camera Button */}
                        {!pinSelectedFile && (
                          <div 
                            className="relative"
                            onMouseEnter={() => !user && setShowCameraTooltip(true)}
                            onMouseLeave={() => setShowCameraTooltip(false)}
                          >
                            <label 
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                user 
                                  ? 'bg-gray-100 hover:bg-gray-200 cursor-pointer' 
                                  : 'bg-gray-50 cursor-not-allowed opacity-50'
                              }`}
                              onClick={!user ? (e) => {
                                e.preventDefault();
                                openWelcome();
                              } : undefined}
                            >
                              <input
                                ref={pinFileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                capture="environment"
                                onChange={handlePinFileSelect}
                                className="hidden"
                                disabled={isPinSubmitting || isPinUploading || !user}
                              />
                              <CameraIcon className={`w-4 h-4 ${user ? 'text-gray-600' : 'text-gray-400'}`} />
                            </label>
                            {!user && showCameraTooltip && (
                              <div className="absolute bottom-full left-0 mb-1 z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg p-2">
                                <p className="text-[10px] text-gray-600">
                                  Sign in to upload photos and videos
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Visibility Toggle */}
                        <div 
                          className="flex items-center gap-1.5 relative ml-auto"
                          onMouseEnter={() => !user && setShowVisibilityTooltip(true)}
                          onMouseLeave={() => setShowVisibilityTooltip(false)}
                        >
                          <span className={`text-[10px] ${pinVisibility === 'public' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                            Public
                          </span>
                          <button
                            type="button"
                            onClick={() => setPinVisibility(pinVisibility === 'public' ? 'only_me' : 'public')}
                            disabled={isPinSubmitting || isPinUploading || !user}
                            className={`relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                              pinVisibility === 'only_me' ? 'bg-gray-700' : 'bg-gray-300'
                            }`}
                            role="switch"
                            aria-checked={pinVisibility === 'only_me'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                pinVisibility === 'only_me' ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className={`text-[10px] ${pinVisibility === 'only_me' ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                            Only Me
                          </span>
                          
                          {!user && showVisibilityTooltip && (
                            <div className="absolute bottom-full right-0 mb-1 z-50 w-40 bg-white border border-gray-200 rounded-md shadow-lg p-2">
                              <p className="text-[10px] text-gray-600">
                                Sign in for private pins
                              </p>
                            </div>
                          )}
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
                          disabled={isPinSubmitting || isPinUploading || (!pinDescription.trim() && !pinSelectedFile) || !user}
                          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
                        >
                          {isPinUploading ? 'Uploading...' : isPinSubmitting ? 'Posting...' : 'Post'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Drop Heart Button */}
                  {!isDropHeartExpanded && (
                    <button
                      onClick={() => {
                        // Require authentication to create pins
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
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors shadow-sm"
                    >
                      <span>Drop</span>
                      <HeartIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  VIEWING SECTION: What the user clicked on (read-only context)
                  ═══════════════════════════════════════════════════════════════ */}
              
              {/* Pin Details - Accordion */}
              {selectedPin && (
                <div className="border-b border-gray-200">
                  {/* Accordion Header */}
                  <div
                    onClick={() => setIsPinDetailsExpanded(!isPinDetailsExpanded)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-900 truncate">{selectedPin.name || 'Pin'}</span>
                      {selectedPin.account?.username && (
                        <span className="text-xs text-gray-500 truncate">· @{selectedPin.account.username}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPin(null);
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-900 transition-colors"
                        title="Close"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                      {isPinDetailsExpanded ? (
                        <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Accordion Content - Packed Data */}
                  {isPinDetailsExpanded && (
                    <div className="px-2 pb-2 space-y-2">
                      {/* Account + Date Row */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
                        {selectedPin.account && (
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {selectedPin.account.image_url ? (
                              <img 
                                src={selectedPin.account.image_url} 
                                alt={selectedPin.account.username || 'User'} 
                                className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-700 font-medium flex-shrink-0">
                                {(selectedPin.account.username || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            {selectedPin.account.username ? (
                              <Link 
                                href={`/profile/${selectedPin.account.username}`}
                                className="text-xs font-medium text-gray-900 hover:underline truncate"
                              >
                                @{selectedPin.account.username}
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-600">User</span>
                            )}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-500 flex-shrink-0">
                          {new Date(selectedPin.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      {/* Description + Media */}
                      {selectedPin.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {selectedPin.description}
                        </p>
                      )}
                      {selectedPin.media_url && (
                        <div className="rounded-md overflow-hidden">
                          {selectedPin.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img 
                              src={selectedPin.media_url} 
                              alt="Pin media" 
                              className="w-full max-h-32 object-cover"
                            />
                          ) : selectedPin.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video 
                              src={selectedPin.media_url} 
                              controls 
                              className="w-full max-h-32"
                            />
                          ) : null}
                        </div>
                      )}
                      
                      {/* Analytics Row - Compact */}
                      {selectedPin.id && (
                        <div className="pt-1.5 border-t border-gray-100 space-y-1.5">
                          <PinStatsCard pinId={selectedPin.id} compact={true} />
                          <button
                            onClick={() => {
                              setAnalyticsPinId(selectedPin.id);
                              setAnalyticsPinName(selectedPin.name || null);
                              setIsAnalyticsModalOpen(true);
                            }}
                            className="w-full text-[10px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 px-2 py-1 rounded transition-colors text-left"
                          >
                            View Full Analytics →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Atlas Entity Details - Accordion */}
              {selectedAtlasEntity && (
                <div className="border-b border-gray-200">
                  {/* Accordion Header */}
                  <div
                    onClick={() => setIsAtlasEntityExpanded(!isAtlasEntityExpanded)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-xs">{selectedAtlasEntity.emoji}</span>
                      <span className="text-xs font-medium text-gray-900 truncate">{selectedAtlasEntity.name}</span>
                      <span className="text-[10px] text-gray-500 truncate">
                        {selectedAtlasEntity.layerType === 'schools' && selectedAtlasEntity.school_type ? `· ${selectedAtlasEntity.school_type.replace('_', ' ')}` :
                         selectedAtlasEntity.layerType === 'parks' && selectedAtlasEntity.park_type ? `· ${selectedAtlasEntity.park_type.replace('_', ' ')}` :
                         selectedAtlasEntity.layerType === 'hospitals' && selectedAtlasEntity.hospital_type ? `· ${selectedAtlasEntity.hospital_type.replace('_', ' ')}` :
                         selectedAtlasEntity.layerType === 'airports' && selectedAtlasEntity.airport_type ? `· ${selectedAtlasEntity.airport_type.replace('_', ' ')}` :
                         selectedAtlasEntity.layerType === 'churches' && selectedAtlasEntity.church_type ? `· ${selectedAtlasEntity.church_type.replace('_', ' ')}` :
                         selectedAtlasEntity.layerType === 'municipals' && selectedAtlasEntity.municipal_type ? `· ${selectedAtlasEntity.municipal_type.replace('_', ' ')}` :
                         selectedAtlasEntity.layerType === 'golf_courses' && selectedAtlasEntity.course_type ? `· ${selectedAtlasEntity.course_type.replace('_', ' ')}` :
                         `· ${selectedAtlasEntity.layerType.replace('_', ' ')}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAtlasEntity(null);
                          setAtlasEntityMessage(null);
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-900 transition-colors"
                        title="Close"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                      {isAtlasEntityExpanded ? (
                        <ChevronUpIcon className="w-3 h-3 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                      )}
                    </div>
                  </div>
                  
                  {/* Accordion Content - Packed Data */}
                  {isAtlasEntityExpanded && (
                    <div className="px-2 pb-2 space-y-2">
                      {/* Type + Details Row */}
                      <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-gray-100">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-500">
                            {selectedAtlasEntity.layerType === 'schools' && selectedAtlasEntity.school_type && (
                              <span className="capitalize">{selectedAtlasEntity.school_type.replace('_', ' ')} School</span>
                            )}
                            {selectedAtlasEntity.layerType === 'parks' && selectedAtlasEntity.park_type && (
                              <span className="capitalize">{selectedAtlasEntity.park_type.replace('_', ' ')} Park</span>
                            )}
                            {selectedAtlasEntity.layerType === 'watertowers' && <span>Watertower</span>}
                            {selectedAtlasEntity.layerType === 'cemeteries' && <span>Cemetery</span>}
                            {selectedAtlasEntity.layerType === 'golf_courses' && selectedAtlasEntity.course_type && (
                              <span className="capitalize">{selectedAtlasEntity.course_type.replace('_', ' ')} Golf Course</span>
                            )}
                            {selectedAtlasEntity.layerType === 'golf_courses' && !selectedAtlasEntity.course_type && (
                              <span>Golf Course</span>
                            )}
                            {selectedAtlasEntity.layerType === 'hospitals' && selectedAtlasEntity.hospital_type && (
                              <span className="capitalize">{selectedAtlasEntity.hospital_type.replace('_', ' ')} Hospital</span>
                            )}
                            {selectedAtlasEntity.layerType === 'hospitals' && !selectedAtlasEntity.hospital_type && (
                              <span>Hospital</span>
                            )}
                            {selectedAtlasEntity.layerType === 'airports' && selectedAtlasEntity.airport_type && (
                              <span className="capitalize">{selectedAtlasEntity.airport_type.replace('_', ' ')} Airport</span>
                            )}
                            {selectedAtlasEntity.layerType === 'airports' && !selectedAtlasEntity.airport_type && (
                              <span>Airport</span>
                            )}
                            {selectedAtlasEntity.layerType === 'churches' && selectedAtlasEntity.church_type && (
                              <span className="capitalize">{selectedAtlasEntity.church_type.replace('_', ' ')} Church</span>
                            )}
                            {selectedAtlasEntity.layerType === 'churches' && !selectedAtlasEntity.church_type && (
                              <span>Church</span>
                            )}
                            {selectedAtlasEntity.layerType === 'municipals' && selectedAtlasEntity.municipal_type && (
                              <span className="capitalize">{selectedAtlasEntity.municipal_type.replace('_', ' ')}</span>
                            )}
                            {selectedAtlasEntity.layerType === 'municipals' && !selectedAtlasEntity.municipal_type && (
                              <span>Municipal Building</span>
                            )}
                            {selectedAtlasEntity.layerType === 'cities' && <span>City</span>}
                            {selectedAtlasEntity.layerType === 'counties' && <span>County</span>}
                            {selectedAtlasEntity.layerType === 'neighborhoods' && <span>Neighborhood</span>}
                            {selectedAtlasEntity.layerType === 'lakes' && <span>Lake</span>}
                          </div>
                          {selectedAtlasEntity.layerType === 'churches' && selectedAtlasEntity.denomination && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {selectedAtlasEntity.denomination}
                            </div>
                          )}
                          {selectedAtlasEntity.layerType === 'golf_courses' && selectedAtlasEntity.holes && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {selectedAtlasEntity.holes} holes
                            </div>
                          )}
                          {selectedAtlasEntity.layerType === 'airports' && (selectedAtlasEntity.iata_code || selectedAtlasEntity.icao_code) && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {selectedAtlasEntity.iata_code && <span>IATA: {selectedAtlasEntity.iata_code}</span>}
                              {selectedAtlasEntity.iata_code && selectedAtlasEntity.icao_code && <span> · </span>}
                              {selectedAtlasEntity.icao_code && <span>ICAO: {selectedAtlasEntity.icao_code}</span>}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono flex-shrink-0 text-right">
                          <div>{selectedAtlasEntity.lat.toFixed(6)}</div>
                          <div>{selectedAtlasEntity.lng.toFixed(6)}</div>
                        </div>
                      </div>
                      
                      {/* Address + Contact Info - Compact Grid */}
                      {(selectedAtlasEntity.address || selectedAtlasEntity.phone || selectedAtlasEntity.website_url) && (
                        <div className="space-y-1 pb-1.5 border-b border-gray-100">
                          {selectedAtlasEntity.address && (
                            <div className="text-xs text-gray-600">{selectedAtlasEntity.address}</div>
                          )}
                          {selectedAtlasEntity.phone && (
                            <div className="text-[10px] text-gray-500">Phone: {selectedAtlasEntity.phone}</div>
                          )}
                          {selectedAtlasEntity.website_url && (
                            <a 
                              href={selectedAtlasEntity.website_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-gray-500 hover:text-gray-900 underline block"
                            >
                              Website →
                            </a>
                          )}
                        </div>
                      )}
                      
                      {/* Description */}
                      {selectedAtlasEntity.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {selectedAtlasEntity.description}
                        </p>
                      )}
                      
                      {/* Explore Links - Inline */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedAtlasEntity.layerType === 'cities' && selectedAtlasEntity.slug && (
                          <Link 
                            href={`/explore/city/${selectedAtlasEntity.slug}`}
                            className="text-[10px] text-gray-500 hover:text-gray-900 underline"
                          >
                            Explore City →
                          </Link>
                        )}
                        {selectedAtlasEntity.layerType === 'counties' && selectedAtlasEntity.slug && (
                          <Link 
                            href={`/explore/county/${selectedAtlasEntity.slug}`}
                            className="text-[10px] text-gray-500 hover:text-gray-900 underline"
                          >
                            Explore County →
                          </Link>
                        )}
                      </div>

                      {/* Admin Actions - Compact */}
                      {isAdmin && selectedAtlasEntity.layerType !== 'cities' && selectedAtlasEntity.layerType !== 'counties' && (
                        <div className="pt-1.5 border-t border-gray-100 space-y-1">
                          <div className="text-[9px] text-gray-400 font-medium">Admin</div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                          // Map layerType to singular entityType
                          const typeMap: Record<string, AtlasEntityType> = {
                            neighborhoods: 'neighborhood',
                            schools: 'school',
                            parks: 'park',
                            lakes: 'lake',
                            watertowers: 'watertower',
                            cemeteries: 'cemetery',
                            golf_courses: 'golf_course',
                            hospitals: 'hospital',
                            airports: 'airport',
                            churches: 'church',
                            municipals: 'municipal',
                            roads: 'road',
                          };
                          const entityType = typeMap[selectedAtlasEntity.layerType];
                          if (entityType) {
                            setAtlasEntityType(entityType);
                            setAtlasEntityModalMode('edit');
                            setAtlasEntityToEdit({
                              id: selectedAtlasEntity.id,
                              name: selectedAtlasEntity.name,
                              slug: selectedAtlasEntity.slug,
                              lat: selectedAtlasEntity.lat,
                              lng: selectedAtlasEntity.lng,
                              description: selectedAtlasEntity.description,
                              website_url: selectedAtlasEntity.website_url,
                              phone: selectedAtlasEntity.phone,
                              address: selectedAtlasEntity.address,
                              city_id: selectedAtlasEntity.city_id,
                              county_id: selectedAtlasEntity.county_id,
                              school_type: selectedAtlasEntity.school_type,
                              is_public: selectedAtlasEntity.is_public,
                              district: selectedAtlasEntity.district,
                              park_type: selectedAtlasEntity.park_type,
                              hospital_type: selectedAtlasEntity.hospital_type,
                              course_type: selectedAtlasEntity.course_type,
                              holes: selectedAtlasEntity.holes,
                              airport_type: selectedAtlasEntity.airport_type,
                              iata_code: selectedAtlasEntity.iata_code,
                              icao_code: selectedAtlasEntity.icao_code,
                              church_type: selectedAtlasEntity.church_type,
                              denomination: selectedAtlasEntity.denomination,
                              municipal_type: selectedAtlasEntity.municipal_type,
                            });
                            setIsAtlasEntityModalOpen(true);
                          } else {
                            // For unknown entity types, show a message that editing is coming soon
                            setAtlasEntityMessage({ 
                              type: 'error', 
                              text: 'Edit functionality coming soon for this entity type'
                            });
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-700 bg-transparent border border-gray-200 hover:bg-gray-50 rounded transition-colors"
                      >
                        <Cog6ToothIcon className="w-3 h-3 text-gray-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to delete "${selectedAtlasEntity.name}"? This action cannot be undone.`)) {
                            return;
                          }
                          
                          setIsDeletingAtlasEntity(true);
                          setAtlasEntityMessage(null);
                          
                          try {
                            // Call appropriate delete function based on type
                            switch (selectedAtlasEntity.layerType) {
                              case 'neighborhoods':
                                await deleteNeighborhood(selectedAtlasEntity.id);
                                break;
                              case 'schools':
                                await deleteSchool(selectedAtlasEntity.id);
                                break;
                              case 'parks':
                                await deletePark(selectedAtlasEntity.id);
                                break;
                              case 'lakes':
                                await deleteLake(selectedAtlasEntity.id);
                                break;
                              case 'watertowers':
                                await deleteWatertower(selectedAtlasEntity.id);
                                break;
                              case 'cemeteries':
                                await deleteCemetery(selectedAtlasEntity.id);
                                break;
                              case 'golf_courses':
                                await deleteGolfCourse(selectedAtlasEntity.id);
                                break;
                              case 'hospitals':
                                await deleteHospital(selectedAtlasEntity.id);
                                break;
                              case 'airports':
                                await deleteAirport(selectedAtlasEntity.id);
                                break;
                              case 'churches':
                                await deleteChurch(selectedAtlasEntity.id);
                                break;
                              case 'municipals':
                                await deleteMunicipal(selectedAtlasEntity.id);
                                break;
                              case 'roads':
                                await deleteRoad(selectedAtlasEntity.id);
                                break;
                            }
                            
                            // Refresh the layer
                            window.dispatchEvent(new CustomEvent('atlas-layer-refresh', {
                              detail: { layerId: selectedAtlasEntity.layerType }
                            }));
                            
                            setAtlasEntityMessage({ type: 'success', text: `Deleted "${selectedAtlasEntity.name}"` });
                            
                            // Clear selection after short delay
                            setTimeout(() => {
                              setSelectedAtlasEntity(null);
                              setAtlasEntityMessage(null);
                            }, 1500);
                          } catch (error) {
                            console.error('Error deleting entity:', error);
                            setAtlasEntityMessage({ 
                              type: 'error', 
                              text: error instanceof Error ? error.message : 'Failed to delete'
                            });
                          } finally {
                            setIsDeletingAtlasEntity(false);
                          }
                        }}
                        disabled={isDeletingAtlasEntity}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-red-600 bg-transparent border border-red-300 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      >
                        <XMarkIcon className="w-3 h-3" />
                        <span>{isDeletingAtlasEntity ? '...' : 'Delete'}</span>
                      </button>
                      
                      {atlasEntityMessage && (
                        <div className={`px-2 py-1 text-[10px] rounded ${
                          atlasEntityMessage.type === 'success' 
                            ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {atlasEntityMessage.text}
                        </div>
                      )}
                    </div>
                    </div>
                  )}
                </div>
                )}
                </div>
              )}

              {/* Location Details - Accordion */}
              {locationData && !isDropHeartExpanded && (
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
                            {isAdmin && (
                              <button
                                onClick={() => openAtlasEntityModal('create', 'neighborhood', locationData.neighborhood)}
                                className="text-[9px] text-purple-500 hover:text-purple-700 ml-auto"
                                title="Add to Atlas"
                              >
                                + Add
                              </button>
                            )}
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
                            {locationData.cityId && !locationData.parentCity && locationData.citySlug && (
                              <button
                                onClick={() => window.open(`/explore/city/${locationData.citySlug}`, '_blank')}
                                className="text-[9px] text-gray-400 hover:text-gray-900 underline ml-auto"
                              >
                                Explore
                              </button>
                            )}
                            {isAdmin && !locationData.cityId && (
                              <button
                                onClick={() => openAtlasEntityModal('create', 'neighborhood', locationData.locality)}
                                className="text-[9px] text-amber-500 hover:text-amber-700 ml-auto"
                                title="Add as Neighborhood"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* City */}
                        {locationData.city && (
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 text-[9px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded">City</span>
                            <span className="text-xs text-gray-700 truncate">{locationData.city}</span>
                            {locationData.citySlug && (
                              <button
                                onClick={() => router.push(`/explore/city/${locationData.citySlug}`)}
                                className="text-[9px] text-gray-400 hover:text-gray-900 underline ml-auto"
                              >
                                Explore
                              </button>
                            )}
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
                            {locationData.parentCitySlug && (
                              <button
                                onClick={() => window.open(`/explore/city/${locationData.parentCitySlug}`, '_blank')}
                                className="text-[9px] text-gray-400 hover:text-gray-900 underline ml-auto"
                              >
                                Explore
                              </button>
                            )}
                          </div>
                        )}

                        {/* County */}
                        {locationData.county && (
                          <div className="flex items-center gap-1">
                            <span className="px-1 py-0.5 text-[9px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">Co</span>
                            <span className="text-xs text-gray-700 truncate">{locationData.county}</span>
                            {locationData.countySlug && (
                              <button
                                onClick={() => window.open(`/explore/county/${locationData.countySlug}`, '_blank')}
                                className="text-[9px] text-gray-400 hover:text-gray-900 underline ml-auto"
                              >
                                Explore
                              </button>
                            )}
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
                  ═══════════════════════════════════════════════════════════════ */}
              {locationData && pinFeature && !isDropHeartExpanded && (
                <div className="relative">
                  {/* Accordion Button - Icon and Name */}
                  <button
                    onClick={() => setIsMetadataOpen(!isMetadataOpen)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-base flex-shrink-0">{pinFeature.icon}</span>
                      <span className="text-sm font-medium text-gray-900 truncate">
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

                  {/* Accordion Content - Type info, Layer info, and Properties */}
                  {isMetadataOpen && (
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
                  SECONDARY ACTIONS: User-facing tools (simplified)
                  ═══════════════════════════════════════════════════════════════ */}
              {locationData && !selectedPin && !isDropHeartExpanded && (
                <div className="space-y-2">
                  {/* Intelligence - Only show for houses (building type=house) */}
                  {pinFeature?.showIntelligence && (
                    <button
                      onClick={() => {
                        setIsIntelligenceModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      <span>Property Intelligence</span>
                    </button>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  ADMIN PANEL: Compact admin tools - All open modal for review
                  ═══════════════════════════════════════════════════════════════ */}
              {isAdmin && locationData && (
                <div className="pt-2 border-t border-gray-200">
                  {(() => {
                    // Use atlasType from extracted feature (computed in featureService)
                    // Maps all detected categories to proper atlas entity types
                    const detectedAtlasType = pinFeature?.atlasType as AtlasEntityType | null;
                    const featureIcon = pinFeature?.icon || '📍';
                    const featureLabel = pinFeature?.label || 'Location';
                    
                    // All entity types for compact grid (all 13 atlas types)
                    const allEntities: Array<{ type: AtlasEntityType; icon: string; label: string }> = [
                      { type: 'neighborhood', icon: '🏘️', label: 'Nbhd' },
                      { type: 'school', icon: '🏫', label: 'School' },
                      { type: 'park', icon: '🌳', label: 'Park' },
                      { type: 'lake', icon: '💧', label: 'Lake' },
                      { type: 'hospital', icon: '🏥', label: 'Hospital' },
                      { type: 'church', icon: '⛪', label: 'Church' },
                      { type: 'cemetery', icon: '🪦', label: 'Cemetery' },
                      { type: 'airport', icon: '✈️', label: 'Airport' },
                      { type: 'golf_course', icon: '⛳', label: 'Golf' },
                      { type: 'watertower', icon: '🗼', label: 'Tower' },
                      { type: 'municipal', icon: '🏛️', label: 'Municipal' },
                      { type: 'road', icon: '🛣️', label: 'Road' },
                      { type: 'radio_and_news', icon: '📻', label: 'News' },
                    ];
                    
                    // Get recommended entity info
                    const recommendedEntity = detectedAtlasType 
                      ? allEntities.find(e => e.type === detectedAtlasType)
                      : null;
                    
                    // Open modal for entity creation - pass properties for pre-filling
                    const handleOpenCreateModal = (entityType: AtlasEntityType) => {
                      openAtlasEntityModal('create', entityType, pinFeature?.name || undefined, undefined, pinFeature?.properties);
                    };
                    
                    return (
                      <>
                        {/* Contextual Create Button - Show when atlas type detected */}
                        {detectedAtlasType && recommendedEntity && (
                          <button
                            onClick={() => handleOpenCreateModal(detectedAtlasType)}
                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                          >
                            <span>{recommendedEntity.icon}</span>
                            <span>+ Create {recommendedEntity.label}</span>
                            {pinFeature?.name && (
                              <span className="opacity-70 truncate max-w-[80px]">&quot;{pinFeature.name}&quot;</span>
                            )}
                          </button>
                        )}
                        
                        {/* Admin Tools Toggle - More options or create entity */}
                        <button
                          onClick={() => setIsAdminToolsOpen(!isAdminToolsOpen)}
                          className={`w-full flex items-center justify-between px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-700 transition-colors ${detectedAtlasType ? 'mt-1' : ''}`}
                        >
                          <div className="flex items-center gap-1">
                            <WrenchScrewdriverIcon className="w-3 h-3" />
                            <span>{detectedAtlasType ? 'Other types' : 'Create Entity'}</span>
                          </div>
                          {isAdminToolsOpen ? (
                            <ChevronUpIcon className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronDownIcon className="w-2.5 h-2.5" />
                          )}
                        </button>
                        
                        {/* Compact Grid of All Entity Buttons */}
                        {isAdminToolsOpen && (
                          <div className="mt-1.5 grid grid-cols-4 gap-1">
                            {allEntities.map((entity) => (
                              <button
                                key={entity.type}
                                onClick={() => handleOpenCreateModal(entity.type)}
                                className={`flex flex-col items-center gap-0.5 px-1 py-1.5 text-[9px] rounded transition-colors border ${
                                  entity.type === detectedAtlasType 
                                    ? 'text-gray-900 bg-gray-100 border-gray-300' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-100'
                                }`}
                                title={`Create ${entity.label}`}
                              >
                                <span className="text-sm">{entity.icon}</span>
                                <span className="truncate w-full text-center">{entity.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        
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
                                
                                window.dispatchEvent(new CustomEvent('atlas-layer-refresh', { detail: { layerId: 'cities' } }));
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
      </div>

      {/* Intelligence Modal */}
      <IntelligenceModal
        isOpen={isIntelligenceModalOpen}
        onClose={() => setIsIntelligenceModalOpen(false)}
        locationData={selectedPin ? {
          coordinates: selectedPin.coordinates,
          placeName: selectedPin.name,
          address: selectedPin.address || undefined,
          type: 'pin-click',
        } : locationData}
        pinFeature={selectedPin ? {
          type: 'pin',
          name: selectedPin.name,
          properties: {
            id: selectedPin.id,
            description: selectedPin.description || undefined,
            created_at: selectedPin.created_at,
            ...(selectedPin.address ? { address: selectedPin.address } : {}),
          },
        } : pinFeature ? {
          // Convert ExtractedFeature to old FeatureMetadata format
          type: pinFeature.layerId,
          name: pinFeature.name || undefined,
          properties: pinFeature.properties,
          showIntelligence: pinFeature.showIntelligence,
        } : null}
      />

      {/* Pin Analytics Modal */}
      {analyticsPinId && (
        <PinAnalyticsModal
          isOpen={isAnalyticsModalOpen}
          onClose={() => {
            setIsAnalyticsModalOpen(false);
            setAnalyticsPinId(null);
            setAnalyticsPinName(null);
          }}
          pinId={analyticsPinId}
          pinName={analyticsPinName || undefined}
          isOwner={!!(currentUserAccountId && selectedPin?.account?.id === currentUserAccountId)}
          isPro={currentUserPlan === 'pro'}
          onUpgrade={() => {
            // Close analytics modal and open account modal with billing tab
            setIsAnalyticsModalOpen(false);
            setAnalyticsPinId(null);
            setAnalyticsPinName(null);
            // Open account modal via context
            openAccount('billing');
          }}
        />
      )}

      {/* POI Drop Pin Button - Shows when POI label is found */}
      {isPOIMode && showDropPinButton && poiFeature && poiClickLocation && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white border border-gray-200 rounded-md shadow-lg p-3 min-w-[200px]">
            <div className="text-xs text-gray-600 mb-2">
              <div className="font-medium text-gray-900">{poiFeature.name || poiFeature.displayLabel}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{poiFeature.category}</div>
            </div>
            <button
              onClick={handleCreatePOI}
              disabled={isCreatingPOI || !user || !account}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingPOI ? (
                <>
                  <ArrowPathIcon className="w-3 h-3 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <MapPinIcon className="w-3 h-3" />
                  <span>Drop Pin</span>
                </>
              )}
            </button>
            {(!user || !account) && (
              <div className="text-[10px] text-gray-500 mt-1.5 text-center">
                Sign in to create POI
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Atlas Entity Modal (Admin Only) - Supports Create and Edit modes */}
      <AtlasEntityModal
        isOpen={isAtlasEntityModalOpen}
        onClose={() => {
          setIsAtlasEntityModalOpen(false);
          setAtlasEntityToEdit(undefined);
        }}
        entityType={atlasEntityType}
        mode={atlasEntityModalMode}
        coordinates={atlasEntityModalMode === 'create' ? locationData?.coordinates : undefined}
        featureName={atlasEntityModalMode === 'create' ? atlasEntityFeatureName : undefined}
        cityName={atlasEntityModalMode === 'create' ? locationData?.city : undefined}
        countyName={atlasEntityModalMode === 'create' ? locationData?.county : undefined}
        address={atlasEntityModalMode === 'create' ? locationData?.address : undefined}
        featureProperties={atlasEntityModalMode === 'create' ? atlasEntityFeatureProperties : undefined}
        existingEntity={atlasEntityModalMode === 'edit' ? atlasEntityToEdit : undefined}
        onSuccess={() => {
          // Clear the selected atlas entity after successful edit
          if (atlasEntityModalMode === 'edit') {
            setSelectedAtlasEntity(null);
          }
          console.log(`Successfully ${atlasEntityModalMode === 'edit' ? 'updated' : 'created'} ${atlasEntityType}`);
        }}
      />

      {/* Screenshot Preview Modal */}
      {isScreenshotPreviewOpen && screenshot && (
        <div className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Map Screenshot</h3>
              <button
                onClick={() => {
                  setIsScreenshotPreviewOpen(false);
                  setScreenshot(null);
                }}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Screenshot Image */}
            <div className="relative bg-gray-100 overflow-auto max-h-[calc(90vh-120px)]">
              <img
                src={screenshot}
                alt="Map screenshot"
                className="w-full h-auto"
              />
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 p-3 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsScreenshotPreviewOpen(false);
                  setScreenshot(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  if (screenshot) {
                    const link = document.createElement('a');
                    link.download = `map-screenshot-${new Date().toISOString().split('T')[0]}.png`;
                    link.href = screenshot;
                    link.click();
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

