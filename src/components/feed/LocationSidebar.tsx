'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { XMarkIcon, MagnifyingGlassIcon, Bars3Icon, Cog6ToothIcon, InformationCircleIcon, MapPinIcon, FingerPrintIcon, Square3Stack3DIcon, SparklesIcon, BuildingOffice2Icon, ExclamationTriangleIcon, AcademicCapIcon, SunIcon, GlobeAmericasIcon } from '@heroicons/react/24/outline';
import IntelligenceModal from './IntelligenceModal';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import type { MapboxMapInstance, MapboxMouseEvent } from '@/types/mapbox-events';
import PinStatsCard from '@/components/pins/PinStatsCard';
import PinTrendingBadge from '@/components/pins/PinTrendingBadge';
import PinAnalyticsModal from '@/components/pins/PinAnalyticsModal';
import AtlasEntityModal, { type AtlasEntityData } from '@/components/atlas/AtlasEntityModal';
import type { AtlasEntityType } from '@/features/atlas/services/atlasService';
import { findCityByName, updateCityCoordinates, createLake, checkLakeExists, deleteNeighborhood, deleteSchool, deletePark, deleteLake } from '@/features/atlas/services/atlasService';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Helper to get friendly category label from mapbox feature properties
function getFeatureCategory(properties: Record<string, any>, type: string): string | null {
  const cls = properties.class || properties.road_class || properties.landuse_class;
  const typ = properties.type || properties.road_type || properties.water_type || properties.landuse_type || type;
  
  // Check if this is a water layer (layer ID contains 'water')
  if (type.includes('water') || properties.water_type) {
    return 'Lake';
  }
  
  // Map raw values to friendly labels
  const categoryMap: Record<string, string> = {
    // Roads
    'tertiary': 'Road',
    'secondary': 'Road',
    'primary': 'Road',
    'street_major': 'Street',
    'street_minor': 'Street',
    'street': 'Street',
    'motorway': 'Highway',
    'trunk': 'Highway',
    'path': 'Path',
    'track': 'Trail',
    // Places
    'park_like': 'Park',
    'park': 'Park',
    'settlement': 'City',
    'settlement_subdivision': 'Neighborhood',
    'neighborhood': 'Neighborhood',
    // Water
    'water': 'Lake',
    'lake': 'Lake',
    'pond': 'Lake',
    'river': 'Lake',
    'reservoir': 'Lake',
    // POI classes
    'education': 'School',
    'arts_and_entertainment': 'Entertainment',
    'lodging': 'Lodging',
    'food_and_drink': 'Food & Drink',
    'medical': 'Medical',
    'fuel': 'Gas Station',
    // POI types
    'University': 'School',
    'College': 'School',
    'School': 'School',
    'Stadium': 'Stadium',
    'Hotel': 'Hotel',
    'Restaurant': 'Restaurant',
    'Hospital': 'Hospital',
  };
  
  // Check type first, then class
  if (typ && categoryMap[typ]) return categoryMap[typ];
  if (cls && categoryMap[cls]) return categoryMap[cls];
  
  // Fallback: capitalize first meaningful value
  const fallback = cls || typ;
  if (fallback && typeof fallback === 'string') {
    return fallback.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return null;
}

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
  type?: 'map-click' | 'pin-click' | 'search';
  city?: string;
  county?: string;
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
    guest_id?: string | null;
  } | null;
}

interface FeatureMetadata {
  type: string;
  name?: string;
  properties: Record<string, any>;
}

interface AtlasEntity {
  id: string;
  name: string;
  slug?: string;
  layerType: 'cities' | 'counties' | 'neighborhoods' | 'schools' | 'parks' | 'lakes';
  emoji: string;
  lat: number;
  lng: number;
  school_type?: string;
  park_type?: string;
  description?: string;
  [key: string]: any;
}

interface LocationSidebarProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  isOpen?: boolean;
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  onPinClick?: (pinData: { id: string; name: string; coordinates: { lat: number; lng: number }; address?: string; description?: string }) => void;
  onCreatePin?: (coordinates: { lat: number; lng: number }) => void;
  onSkipTrace?: (coordinates: { lat: number; lng: number }) => void;
  onDrawArea?: (coordinates: { lat: number; lng: number }) => void;
  onRemoveTemporaryPin?: (removeFn: () => void) => void;
  onUpdateTemporaryPinColor?: (updateFn: (visibility: 'public' | 'only_me') => void) => void;
  onCloseCreatePinModal?: () => void;
}

export default function LocationSidebar({ 
  map, 
  mapLoaded,
  isOpen = true,
  onLocationSelect,
  onPinClick,
  onCreatePin,
  onSkipTrace,
  onDrawArea,
  onRemoveTemporaryPin,
  onUpdateTemporaryPinColor,
  onCloseCreatePinModal
}: LocationSidebarProps) {
  const { user } = useAuth();
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [selectedPin, setSelectedPin] = useState<PinData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pinFeature, setPinFeature] = useState<FeatureMetadata | null>(null);
  const [hoverFeature, setHoverFeature] = useState<FeatureMetadata | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'moderation' | 'press'>('about');
  const [isIntelligenceModalOpen, setIsIntelligenceModalOpen] = useState(false);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
  const [analyticsPinId, setAnalyticsPinId] = useState<string | null>(null);
  const [analyticsPinName, setAnalyticsPinName] = useState<string | null>(null);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState<string>('');
  const [currentUserAccountId, setCurrentUserAccountId] = useState<string | null>(null);
  const [currentUserPlan, setCurrentUserPlan] = useState<'hobby' | 'pro'>('hobby');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAtlasEntityModalOpen, setIsAtlasEntityModalOpen] = useState(false);
  const [atlasEntityType, setAtlasEntityType] = useState<AtlasEntityType>('neighborhood');
  const [atlasEntityFeatureName, setAtlasEntityFeatureName] = useState<string | undefined>(undefined);
  const [atlasEntityModalMode, setAtlasEntityModalMode] = useState<'create' | 'edit'>('create');
  const [atlasEntityToEdit, setAtlasEntityToEdit] = useState<AtlasEntityData | undefined>(undefined);
  const [isUpdatingCityCoords, setIsUpdatingCityCoords] = useState(false);
  const [cityUpdateMessage, setCityUpdateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isCreatingLake, setIsCreatingLake] = useState(false);
  const [lakeCreateMessage, setLakeCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedAtlasEntity, setSelectedAtlasEntity] = useState<AtlasEntity | null>(null);
  const [isDeletingAtlasEntity, setIsDeletingAtlasEntity] = useState(false);
  const [atlasEntityMessage, setAtlasEntityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const temporaryMarkerRef = useRef<any>(null);
  const pathname = usePathname();

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
          setCurrentUserPlan((account.plan as 'hobby' | 'pro') || 'hobby');
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

      // Create temporary marker element with pulsing animation
      const el = document.createElement('div');
      el.className = 'temporary-pin-marker';
      el.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #ef4444;
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        cursor: pointer;
        pointer-events: none;
      `;

      // Add animation keyframes if not already added
      if (!document.getElementById('temporary-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'temporary-marker-styles';
        style.textContent = `
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            }
            50% {
              box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Create marker
      const marker = new mapbox.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(map);

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

  // Update temporary pin color based on visibility
  const updateTemporaryPinColor = useCallback((visibility: 'public' | 'only_me') => {
    if (!temporaryMarkerRef.current) return;
    
    const el = temporaryMarkerRef.current.getElement();
    if (!el) return;

    if (visibility === 'only_me') {
      // Grey color for private pins
      el.style.backgroundColor = '#6b7280';
      el.style.boxShadow = '0 0 0 0 rgba(107, 114, 128, 0.7)';
    } else {
      // Red color for public pins
      el.style.backgroundColor = '#ef4444';
      el.style.boxShadow = '0 0 0 0 rgba(239, 68, 68, 0.7)';
    }

    // Update keyframe animation colors
    const styleEl = document.getElementById('temporary-marker-styles');
    if (styleEl) {
      const color = visibility === 'only_me' ? '107, 114, 128' : '239, 68, 68';
      styleEl.textContent = `
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(${color}, 0.7);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(${color}, 0);
          }
        }
      `;
    }
  }, []);

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

  // Handle suggestion select
  const handleSuggestionSelect = useCallback((feature: MapboxFeature) => {
    const coordinates = {
      lat: feature.center[1],
      lng: feature.center[0],
    };

    setSearchQuery(feature.place_name);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Clear selected pin and atlas entity when selecting a new location
    setSelectedPin(null);
    setSelectedAtlasEntity(null);

    setLocationData({
      coordinates,
      placeName: feature.place_name,
      address: feature.place_name,
      type: 'search',
    });

    // Add temporary pin
    addTemporaryPin(coordinates);

    // Dispatch event to close any open pin popup
    window.dispatchEvent(new CustomEvent('location-selected-on-map'));

    // Get feature metadata at selected location (convert coordinates to point)
    if (map && !map.removed) {
      const point = map.project([coordinates.lng, coordinates.lat]);
      const pinMetadata = getFeatureMetadata(point);
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

    // Close create pin modal if open when user selects a new location
    if (onCloseCreatePinModal) {
      onCloseCreatePinModal();
    }

    searchInputRef.current?.blur();
  }, [map, mapLoaded, onLocationSelect, addTemporaryPin, onCloseCreatePinModal]);

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

  // Query features at a specific point to get metadata
  const getFeatureMetadata = useCallback((point: { x: number; y: number }): FeatureMetadata | null => {
    if (!map || !mapLoaded || map.removed) return null;

    try {
      const mapboxMap = map as any;
      const features = mapboxMap.queryRenderedFeatures(point);

      if (features.length > 0) {
        // Filter out our custom layers (pins, etc.)
        const mapFeature = features.find((f: any) => {
          const layerId = f.layer?.id || '';
          return !layerId.includes('map-pins') && 
                 !layerId.includes('pin') &&
                 f.source !== 'map-pins';
        });

        if (mapFeature) {
          const layerId = mapFeature.layer?.id || '';
          const props = mapFeature.properties || {};
          
          const metadata: FeatureMetadata = {
            type: layerId || 'feature',
            name: props.name || props.name_en || undefined,
            properties: {},
          };

          // Extract building properties
          if (layerId.includes('building') || props.building) {
            if (props.height) metadata.properties.height = props.height;
            if (props.min_height) metadata.properties.min_height = props.min_height;
            if (props.type) metadata.properties.building_type = props.type;
          }

          // Extract water properties
          if (layerId.includes('water') || props.water) {
            if (props.type) metadata.properties.water_type = props.type;
          }

          // Extract road properties
          if (layerId.includes('road') || layerId.includes('highway') || props.road) {
            if (props.type) metadata.properties.road_type = props.type;
            if (props.class) metadata.properties.road_class = props.class;
            if (props.ref) metadata.properties.road_ref = props.ref;
          }

          // Extract place properties
          if (layerId.includes('place') || props.place) {
            if (props.type) metadata.properties.place_type = props.type;
          }

          // Extract land use properties
          if (layerId.includes('landuse') || props.landuse) {
            if (props.type) metadata.properties.landuse_type = props.type;
            if (props.class) metadata.properties.landuse_class = props.class;
          }

          // Add relevant properties
          const relevantKeys = ['type', 'class', 'ref', 'height', 'min_height', 'name', 'name_en'];
          relevantKeys.forEach(key => {
            if (props[key] !== null && props[key] !== undefined && props[key] !== '') {
              metadata.properties[key] = props[key];
            }
          });

          if (metadata.name || Object.keys(metadata.properties).length > 0) {
            return metadata;
          }
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[LocationSidebar] Error querying features:', error);
      }
    }
    return null;
  }, [map, mapLoaded]);


  // Reverse geocode coordinates to get address
  interface ReverseGeocodeResult {
    address: string | null;
    city: string | null;
    county: string | null;
  }

  const reverseGeocode = useCallback(async (lng: number, lat: number): Promise<ReverseGeocodeResult> => {
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    const emptyResult: ReverseGeocodeResult = { address: null, city: null, county: null };
    
    if (!token) {
      return emptyResult;
    }

    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;
      const params = new URLSearchParams({
        access_token: token,
        types: 'address,poi,place',
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
      
      // Extract city and county from context array
      let city: string | null = null;
      let county: string | null = null;
      
      if (feature.context && Array.isArray(feature.context)) {
        for (const ctx of feature.context) {
          // city is typically "place.xxx" in the context id
          if (ctx.id?.startsWith('place.')) {
            city = ctx.text || null;
          }
          // county is typically "district.xxx" in the context id
          if (ctx.id?.startsWith('district.')) {
            county = ctx.text || null;
          }
        }
      }

      return { address, city, county };
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return emptyResult;
    }
  }, []);

  // Listen for "pin-popup-opening" event to close location details when a pin popup opens
  useEffect(() => {
    const handlePinPopupOpening = () => {
      // Close location details when a pin popup opens
      setLocationData(null);
      setPinFeature(null);
      removeTemporaryPin();
    };

    window.addEventListener('pin-popup-opening', handlePinPopupOpening as EventListener);

    return () => {
      window.removeEventListener('pin-popup-opening', handlePinPopupOpening as EventListener);
    };
  }, [removeTemporaryPin]);

  // Listen for "open-pin-sidebar" event from popup "See More" button
  useEffect(() => {
    const handleOpenPinSidebar = async (event: CustomEvent) => {
      const { pin, flyToLocation } = event.detail;
      
      if (!pin) return;
      
      // Fly to location first if requested
      if (flyToLocation && map && mapLoaded && onLocationSelect) {
        onLocationSelect(pin.coordinates);
      }
      
      // Reverse geocode to get address for the pin
      const geocodeResult = await reverseGeocode(pin.coordinates.lng, pin.coordinates.lat);
      
      // Set selected pin data with address
      setSelectedPin({
        ...pin,
        address: geocodeResult.address || null,
      });
      
      // Set location data to open sidebar
      setLocationData({
        coordinates: pin.coordinates,
        placeName: pin.name,
        address: geocodeResult.address || undefined,
        type: 'pin-click',
        city: geocodeResult.city || undefined,
        county: geocodeResult.county || undefined,
      });
      
      // Update search input with pin name or address
      setSearchQuery(geocodeResult.address || pin.name);
      
      // Clear pin feature metadata (we're showing pin data instead)
      setPinFeature(null);
      
      // Call onPinClick callback if provided
      if (onPinClick) {
        onPinClick({
          id: pin.id,
          name: pin.name,
          coordinates: pin.coordinates,
          address: geocodeResult.address || undefined,
          description: pin.description || undefined,
        });
      }
    };

    window.addEventListener('open-pin-sidebar', handleOpenPinSidebar as EventListener);

    return () => {
      window.removeEventListener('open-pin-sidebar', handleOpenPinSidebar as EventListener);
    };
  }, [onPinClick, reverseGeocode, map, mapLoaded, onLocationSelect]);

  // Listen for atlas entity clicks
  useEffect(() => {
    const handleAtlasEntityClick = (event: CustomEvent<AtlasEntity>) => {
      const entity = event.detail;
      
      // Clear other selections
      setSelectedPin(null);
      setLocationData(null);
      setPinFeature(null);
      removeTemporaryPin();
      
      // Set the selected atlas entity
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

  const handleMapClick = useCallback(async (e: MapboxMouseEvent) => {
    if (!map || !mapLoaded) return;
    
    const { lng, lat } = e.lngLat;
    
    // Check if click hit a pin or atlas entity - if so, don't show map click data
    try {
      const mapboxMap = map as any;
      const layersToCheck = [
        // User pins
        'map-pins-unclustered-point',
        'map-pins-unclustered-point-label',
        'map-pins-clusters',
        'map-pins-cluster-count',
        // Atlas layers
        'atlas-cities-points',
        'atlas-counties-points',
        'atlas-neighborhoods-points',
        'atlas-schools-points',
        'atlas-parks-points',
        'atlas-lakes-points',
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

    // Add temporary pin
    addTemporaryPin({ lat, lng });

    // Dispatch event to close any open pin popup
    window.dispatchEvent(new CustomEvent('location-selected-on-map'));

    // Clear selected pin and atlas entity when clicking on map (not a pin)
    setSelectedPin(null);
    setSelectedAtlasEntity(null);

    // Get feature metadata at pin location
    const pinMetadata = getFeatureMetadata(e.point);
    setPinFeature(pinMetadata);

    // Reverse geocode to get address
    const geocodeResult = await reverseGeocode(lng, lat);
    const placeName = geocodeResult.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    // Update search input with address
    setSearchQuery(placeName);

    // Set location data with address and city/county
    setLocationData({
      coordinates: { lat, lng },
      placeName: geocodeResult.address || undefined,
      address: geocodeResult.address || undefined,
      type: 'map-click',
      city: geocodeResult.city || undefined,
      county: geocodeResult.county || undefined,
    });

    // Close create pin modal if open when user clicks a new location
    if (onCloseCreatePinModal) {
      onCloseCreatePinModal();
    }

  }, [map, mapLoaded, addTemporaryPin, reverseGeocode, getFeatureMetadata, onCloseCreatePinModal]);

  // Handle mouse move to get feature metadata at cursor position
  const handleMouseMove = useCallback((e: MapboxMouseEvent) => {
    if (!map || !mapLoaded || map.removed) return;
    
    const metadata = getFeatureMetadata(e.point);
    setHoverFeature(metadata);
  }, [map, mapLoaded, getFeatureMetadata]);

  // Register map click and mousemove handlers
  useEffect(() => {
    if (!map || !mapLoaded) return;

    map.on('click', handleMapClick);
    map.on('mousemove', handleMouseMove);

    return () => {
      if (map && !map.removed) {
        map.off('click', handleMapClick);
        map.off('mousemove', handleMouseMove);
      }
    };
  }, [map, mapLoaded, handleMapClick, handleMouseMove]);

  // Expose removeTemporaryPin function to parent
  useEffect(() => {
    if (onRemoveTemporaryPin) {
      onRemoveTemporaryPin(removeTemporaryPin);
    }
  }, [onRemoveTemporaryPin, removeTemporaryPin]);

  // Expose updateTemporaryPinColor function to parent
  useEffect(() => {
    if (onUpdateTemporaryPinColor) {
      onUpdateTemporaryPinColor(updateTemporaryPinColor);
    }
  }, [onUpdateTemporaryPinColor, updateTemporaryPinColor]);

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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
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
      setLocationData(null);
      setPinFeature(null);
      removeTemporaryPin();
    }
  }, [isMenuOpen, locationData, removeTemporaryPin]);

  // Close menu when any data opens
  useEffect(() => {
    if ((locationData || selectedPin) && isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [locationData, selectedPin, isMenuOpen]);


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

  // Sidebar expands if either location data, selected pin, or selected atlas entity exists
  const hasData = locationData !== null || selectedPin !== null || selectedAtlasEntity !== null;
  const isExpanded = hasData;

  // Search input is always in the sidebar
  // When collapsed (no data), background is transparent but search stays visible
  // When expanded (has data), background appears with blur effect
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Overlay Backdrop - Only shown on mobile when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/40 z-[35] lg:hidden"
          onClick={() => {
            setLocationData(null);
            setSelectedPin(null);
            setSelectedAtlasEntity(null);
            removeTemporaryPin();
          }}
        />
      )}

      {/* Sidebar Container */}
      <div 
        className={`
          fixed left-0 top-0 z-40 transition-all duration-300 ease-in-out
          h-auto max-h-screen
          ${isExpanded 
            ? 'w-full lg:w-80 bg-transparent' 
            : 'w-full lg:w-64 bg-transparent'
          }
        `}
        style={{
          pointerEvents: 'auto',
        }}
      >
        <div className="flex flex-col p-4 lg:p-4">
        {/* Search Input - Always Visible */}
        <div className={`relative bg-white/10 backdrop-blur rounded-lg border border-white/20 ${hasData ? 'mb-0 border-b-0 rounded-b-none lg:rounded-b-none' : ''}`} style={{ pointerEvents: 'auto', zIndex: 50 }}>
          <div className="relative flex items-center">
            {/* Hamburger Menu Icon - Inside Input */}
            <div className="relative" ref={menuRef}>
              <button
                className={`flex items-center justify-center w-11 h-11 text-white hover:bg-white/20 transition-all duration-150 rounded-l-lg pointer-events-auto ${
                  isMenuOpen ? 'bg-white/20' : ''
                }`}
                title={isMenuOpen ? 'Close Menu' : 'Menu'}
                aria-label={isMenuOpen ? 'Close Menu' : 'Menu'}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
              >
                {isMenuOpen ? (
                  <XMarkIcon className="w-5 h-5" />
                ) : (
                  <Bars3Icon className="w-5 h-5" />
                )}
              </button>

              {/* Menu Dropdown */}
              {isMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-80 bg-white/10 backdrop-blur rounded-lg border border-white/20 z-50">
                  {/* Tabs */}
                  <div className="flex border-b border-white/20">
                    <button
                      onClick={() => setActiveTab('about')}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                        activeTab === 'about'
                          ? 'text-white border-white'
                          : 'text-white/60 hover:text-white border-transparent'
                      }`}
                    >
                      About
                    </button>
                    <button
                      onClick={() => setActiveTab('moderation')}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                        activeTab === 'moderation'
                          ? 'text-white border-white bg-white/10'
                          : 'text-white/60 hover:text-white border-transparent'
                      }`}
                    >
                      Moderation
                    </button>
                    <button
                      onClick={() => setActiveTab('press')}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                        activeTab === 'press'
                          ? 'text-white border-white'
                          : 'text-white/60 hover:text-white border-transparent'
                      }`}
                    >
                      Press
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="max-h-96 overflow-y-auto">
                    {activeTab === 'about' && (
                      <div className="p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-white mb-2">About Us</h3>
                        <p className="text-xs text-white/80 leading-relaxed">
                          For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.
                        </p>
                      </div>
                    )}

                    {activeTab === 'moderation' && (
                      <div className="p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-white mb-2">Moderation Guidelines</h3>
                        <p className="text-xs text-white/80 leading-relaxed mb-3">
                          Posts are moderated to maintain a safe and respectful environment for the For the Love of Minnesota community.
                        </p>
                        <div className="space-y-2">
                          <div className="text-xs text-white/80">
                            <span className="font-medium">1. Breaches of Privacy:</span> Posts containing personal identifying information (names, phone numbers, email addresses, social media handles, exact addresses) without consent.
                          </div>
                          <div className="text-xs text-white/80">
                            <span className="font-medium">2. Hate Speech:</span> Posts that degrade or threaten based on race, ethnicity, citizenship, ability, sexuality, sex, gender, or class.
                          </div>
                          <div className="text-xs text-white/80">
                            <span className="font-medium">3. Spam/Unauthorized Advertising:</span> Spam posts or unauthorized advertisements that don&apos;t align with our community guidelines.
                          </div>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed mt-3">
                          Moderation is in place to ensure a safe and respectful environment for all Minnesota residents, neighbors, and professionals.
                        </p>
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-white mb-1">Request Removal</h4>
                          <p className="text-xs text-white/80 leading-relaxed">
                            To request removal of a post or report content concerns, please contact{' '}
                            <a href="mailto:hi@fortheloveofminnesota.com" className="text-white hover:underline">
                              hi@fortheloveofminnesota.com
                            </a>
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === 'press' && (
                      <div className="p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-white mb-2">Press</h3>
                        <p className="text-xs text-white/80 leading-relaxed">
                          For media inquiries, press releases, or interview requests about For the Love of Minnesota, please contact our team.
                        </p>
                        <div className="mt-3">
                          <p className="text-xs text-white/80 leading-relaxed">
                            Press Contact:{' '}
                            <a href="mailto:hi@fortheloveofminnesota.com" className="text-white hover:underline">
                              hi@fortheloveofminnesota.com
                            </a>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Footer Links */}
                    <div className="border-t border-white/20 p-4">
                      <div className="grid grid-cols-2 gap-px border border-white/20">
                        <Link href="/faqs" className="px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 text-center border-r border-white/20">
                          FAQs
                        </Link>
                        <Link href="/terms" className="px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 text-center">
                          Terms of Use
                        </Link>
                        <Link href="/privacy" className="px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 text-center border-r border-white/20 border-t border-white/20">
                          Privacy Policy
                        </Link>
                        <Link href="/contact" className="px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 text-center border-t border-white/20">
                          Contact
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative flex-1 border-l border-white/20">
              {/* Search Icon */}
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
              
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowSuggestions(false);
                    setSelectedIndex(-1);
                  }
                }}
                placeholder="Search locations..."
                className="w-full pl-11 pr-10 py-3 text-sm bg-transparent border-0 text-white placeholder-white/50 focus:outline-none focus:placeholder-white/30 transition-all"
                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 50 }}
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/20 max-h-64 overflow-y-auto"
              style={{ pointerEvents: 'auto', zIndex: 60 }}
            >
              {suggestions.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => handleSuggestionSelect(feature)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-2.5 transition-colors border-b border-white/10 last:border-b-0 first:rounded-t-lg last:rounded-b-lg ${
                    selectedIndex === index
                      ? 'bg-white/20'
                      : 'hover:bg-white/20'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{feature.text}</div>
                  <div className="text-xs text-white/60 mt-0.5">{feature.place_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>


        {/* Content Sections - Only shown when expanded */}
        {isExpanded && (
          <div 
            className="overflow-y-auto bg-white/10 backdrop-blur rounded-b-lg lg:rounded-b-lg"
            style={{ 
              maxHeight: 'calc(100vh - 140px)',
              minHeight: 0,
            }}
          >
            <div className="p-4 space-y-3">
              
              {/* Pin Details - Shown when an existing pin is clicked */}
              {selectedPin && (
                <div className="space-y-3 mb-4 pb-4 border-b border-white/20 relative">
                  <button
                    onClick={() => {
                      setSelectedPin(null);
                    }}
                    className="absolute top-0 right-0 p-1 text-white/70 hover:text-white transition-colors"
                    title="Close Pin Details"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                  <div>
                    {/* Account Info */}
                    {selectedPin.account && (
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/20">
                        {(() => {
                          const profileSlug = selectedPin.account.username || selectedPin.account.guest_id;
                          const displayName = selectedPin.account.username || 'Guest';
                          
                          if (profileSlug) {
                            return (
                              <Link 
                                href={`/profile/${profileSlug}`}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                              >
                                {selectedPin.account.image_url ? (
                                  <img 
                                    src={selectedPin.account.image_url} 
                                    alt={displayName} 
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs text-white font-medium">
                                    {displayName[0].toUpperCase()}
                                  </div>
                                )}
                                <span className="text-xs font-medium text-white hover:underline">
                                  {displayName}
                                </span>
                              </Link>
                            );
                          }
                          
                          return (
                            <>
                              {selectedPin.account.image_url ? (
                                <img 
                                  src={selectedPin.account.image_url} 
                                  alt={displayName} 
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs text-white font-medium">
                                  {displayName[0].toUpperCase()}
                                </div>
                              )}
                              <span className="text-xs font-medium text-white">
                                {displayName}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between gap-2 mb-2 pr-6">
                      <h3 className="text-sm font-semibold text-white">{selectedPin.name}</h3>
                      {selectedPin.id && (
                        <PinTrendingBadge pinId={selectedPin.id} className="flex-shrink-0" />
                      )}
                    </div>
                    {selectedPin.description && (
                      <p className="text-xs text-white/80 mb-2 leading-relaxed">
                        {selectedPin.description}
                      </p>
                    )}
                    {selectedPin.media_url && (
                      <div className="mb-2">
                        {selectedPin.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img 
                            src={selectedPin.media_url} 
                            alt="Pin media" 
                            className="w-full rounded-md max-h-40 object-cover"
                          />
                        ) : selectedPin.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video 
                            src={selectedPin.media_url} 
                            controls 
                            className="w-full rounded-md max-h-40"
                          />
                        ) : null}
                      </div>
                    )}
                    <div className="text-xs text-white/60 mt-2">
                      {new Date(selectedPin.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Pin Analytics */}
                  {selectedPin.id && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <PinStatsCard pinId={selectedPin.id} compact={true} />
                      <button
                        onClick={() => {
                          setAnalyticsPinId(selectedPin.id);
                          setAnalyticsPinName(selectedPin.name || null);
                          setIsAnalyticsModalOpen(true);
                        }}
                        className="w-full text-xs text-white/70 hover:text-white hover:bg-white/10 px-2 py-1.5 rounded transition-colors text-left"
                      >
                        View Full Analytics →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Atlas Entity Details - Shown when an atlas entity is clicked */}
              {selectedAtlasEntity && (
                <div className="space-y-3 mb-4 pb-4 border-b border-white/20 relative">
                  <button
                    onClick={() => {
                      setSelectedAtlasEntity(null);
                      setAtlasEntityMessage(null);
                    }}
                    className="absolute top-0 right-0 p-1 text-white/70 hover:text-white transition-colors"
                    title="Close"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 mb-2 pr-6">
                      <span className="text-lg">{selectedAtlasEntity.emoji}</span>
                      <h3 className="text-sm font-semibold text-white">{selectedAtlasEntity.name}</h3>
                    </div>
                    <div className="text-xs text-white/60 mb-2">
                      {selectedAtlasEntity.layerType === 'schools' && selectedAtlasEntity.school_type && (
                        <span className="capitalize">{selectedAtlasEntity.school_type.replace('_', ' ')} School</span>
                      )}
                      {selectedAtlasEntity.layerType === 'parks' && selectedAtlasEntity.park_type && (
                        <span className="capitalize">{selectedAtlasEntity.park_type.replace('_', ' ')} Park</span>
                      )}
                      {selectedAtlasEntity.layerType === 'cities' && <span>City</span>}
                      {selectedAtlasEntity.layerType === 'counties' && <span>County</span>}
                      {selectedAtlasEntity.layerType === 'neighborhoods' && <span>Neighborhood</span>}
                      {selectedAtlasEntity.layerType === 'lakes' && <span>Lake</span>}
                    </div>
                    {selectedAtlasEntity.description && (
                      <p className="text-xs text-white/80 mb-2 leading-relaxed">
                        {selectedAtlasEntity.description}
                      </p>
                    )}
                    <div className="text-xs text-white/50">
                      <div>Lat: {selectedAtlasEntity.lat.toFixed(6)}</div>
                      <div>Lng: {selectedAtlasEntity.lng.toFixed(6)}</div>
                    </div>
                    
                    {/* Explore Link for cities */}
                    {selectedAtlasEntity.layerType === 'cities' && selectedAtlasEntity.slug && (
                      <Link 
                        href={`/explore/city/${selectedAtlasEntity.slug}`}
                        className="block mt-2 text-xs text-white/70 hover:text-white underline transition-colors"
                      >
                        Explore {selectedAtlasEntity.name} →
                      </Link>
                    )}
                    
                    {/* Explore Link for counties */}
                    {selectedAtlasEntity.layerType === 'counties' && selectedAtlasEntity.slug && (
                      <Link 
                        href={`/explore/county/${selectedAtlasEntity.slug}`}
                        className="block mt-2 text-xs text-white/70 hover:text-white underline transition-colors"
                      >
                        Explore {selectedAtlasEntity.name} County →
                      </Link>
                    )}
                  </div>

                  {/* Admin Actions */}
                  {isAdmin && selectedAtlasEntity.layerType !== 'cities' && selectedAtlasEntity.layerType !== 'counties' && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-[10px] text-white/50 font-medium">Admin Actions</div>
                      
                      {/* Edit Button - Opens modal in edit mode */}
                      <button
                        onClick={() => {
                          // Map layerType to singular entityType
                          const typeMap: Record<string, AtlasEntityType> = {
                            neighborhoods: 'neighborhood',
                            schools: 'school',
                            parks: 'park',
                            lakes: 'lake',
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
                              city_id: selectedAtlasEntity.city_id,
                              county_id: selectedAtlasEntity.county_id,
                              school_type: selectedAtlasEntity.school_type,
                              is_public: selectedAtlasEntity.is_public,
                              district: selectedAtlasEntity.district,
                              park_type: selectedAtlasEntity.park_type,
                            });
                            setIsAtlasEntityModalOpen(true);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                      >
                        <Cog6ToothIcon className="w-4 h-4 text-white/70" />
                        <span>Edit {selectedAtlasEntity.layerType.slice(0, -1)}</span>
                      </button>
                      
                      {/* Delete Button */}
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-300 bg-transparent border border-red-500/30 hover:bg-red-500/20 rounded-md transition-colors disabled:opacity-50"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        <span>{isDeletingAtlasEntity ? 'Deleting...' : 'Delete'}</span>
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
                  )}
                </div>
              )}

              {/* Location Details - Shown when location data exists (tied to temporary pin) */}
              {locationData && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setLocationData(null);
                      setPinFeature(null);
                      removeTemporaryPin();
                    }}
                    className="absolute top-0 right-0 p-1 text-white/70 hover:text-white transition-colors"
                    title="Close Location Details"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 pr-6">Location Details</h3>
                    {(locationData.address || locationData.placeName) && (
                      <p className="text-sm text-white/80 mb-1">
                        {locationData.address || locationData.placeName}
                      </p>
                    )}
                    <div className="text-xs text-white/70 mt-2">
                      <div>Lat: {locationData.coordinates.lat.toFixed(6)}</div>
                      <div>Lng: {locationData.coordinates.lng.toFixed(6)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tools Section - Only show for location data (temporary pin), not for existing pins */}
              {locationData && !selectedPin && (onCreatePin || onSkipTrace || onDrawArea) && (
                <div className="pt-3 border-t border-white/20">
                  <h4 className="text-xs font-semibold text-white mb-2">Tools</h4>
                  <div className="space-y-2">
                    {onCreatePin && (
                      <button
                        onClick={() => {
                          onCreatePin(locationData.coordinates);
                          // Don't close location details - they'll be hidden by the modal but should remain
                          // Keep temporary pin visible until modal closes or pin is created
                          // Location details will be restored when modal closes via back button
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                      >
                        <MapPinIcon className="w-4 h-4 text-white/70" />
                        <span>Drop Heart</span>
                      </button>
                    )}
                    {/* Intelligence - Hide for road-type locations */}
                    {(() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const roadTypes = ['Road', 'Street', 'Highway', 'Path', 'Trail'];
                      const isRoad = pinCategory && roadTypes.includes(pinCategory);
                      if (isRoad) return null;
                      return (
                        <button
                          onClick={() => {
                            setIsIntelligenceModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                        >
                          <SparklesIcon className="w-4 h-4 text-white/70" />
                          <span>Intelligence</span>
                        </button>
                      );
                    })()}
                    {/* Report Incident - Only show for road-type locations */}
                    {(() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const roadTypes = ['Road', 'Street', 'Highway', 'Path', 'Trail'];
                      const isRoad = pinCategory && roadTypes.includes(pinCategory);
                      if (!isRoad) return null;
                      return (
                        <button
                          onClick={() => {
                            setComingSoonFeature('Report Incident');
                            setIsComingSoonModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-4 h-4 text-white/70" />
                            <span>Report Incident</span>
                          </div>
                          <span className="text-[10px] text-white/50 font-normal">Coming Soon</span>
                        </button>
                      );
                    })()}
                    {/* Create Neighborhood - Only show for admin users on neighborhood-type locations */}
                    {isAdmin && (() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const isNeighborhood = pinCategory === 'Neighborhood';
                      if (!isNeighborhood) return null;
                      return (
                        <button
                          onClick={() => {
                            setAtlasEntityType('neighborhood');
                            setAtlasEntityModalMode('create');
                            setAtlasEntityToEdit(undefined);
                            setAtlasEntityFeatureName(pinFeature?.name);
                            setIsAtlasEntityModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <BuildingOffice2Icon className="w-4 h-4 text-white/70" />
                            <span>Create Neighborhood</span>
                          </div>
                          <span className="text-[10px] text-white/50 font-normal">Admin</span>
                        </button>
                      );
                    })()}
                    {/* Create School - Only show for admin users on school/education-type locations */}
                    {isAdmin && (() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const isSchool = pinCategory === 'School';
                      if (!isSchool) return null;
                      return (
                        <button
                          onClick={() => {
                            setAtlasEntityType('school');
                            setAtlasEntityModalMode('create');
                            setAtlasEntityToEdit(undefined);
                            setAtlasEntityFeatureName(pinFeature?.name);
                            setIsAtlasEntityModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <AcademicCapIcon className="w-4 h-4 text-white/70" />
                            <span>Create School</span>
                          </div>
                          <span className="text-[10px] text-white/50 font-normal">Admin</span>
                        </button>
                      );
                    })()}
                    {/* Create Park - Only show for admin users on park-type locations */}
                    {isAdmin && (() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const isPark = pinCategory === 'Park';
                      if (!isPark) return null;
                      return (
                        <button
                          onClick={() => {
                            setAtlasEntityType('park');
                            setAtlasEntityModalMode('create');
                            setAtlasEntityToEdit(undefined);
                            setAtlasEntityFeatureName(pinFeature?.name);
                            setIsAtlasEntityModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <SunIcon className="w-4 h-4 text-white/70" />
                            <span>Create Park</span>
                          </div>
                          <span className="text-[10px] text-white/50 font-normal">Admin</span>
                        </button>
                      );
                    })()}
                    {/* Create Lake - Only show for admin users on water/lake-type locations */}
                    {isAdmin && (() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const isLake = pinCategory === 'Lake';
                      if (!isLake || !pinFeature?.name || !locationData?.coordinates) return null;
                      return (
                        <div className="space-y-1.5">
                          <button
                            onClick={async () => {
                              if (!pinFeature?.name || !locationData?.coordinates) return;
                              
                              setIsCreatingLake(true);
                              setLakeCreateMessage(null);
                              
                              try {
                                // Check if lake with this name already exists
                                const exists = await checkLakeExists(pinFeature.name);
                                
                                if (exists) {
                                  // Name not unique - open modal for manual resolution
                                  setAtlasEntityType('lake');
                                  setAtlasEntityModalMode('create');
                                  setAtlasEntityToEdit(undefined);
                                  setAtlasEntityFeatureName(pinFeature.name);
                                  setIsAtlasEntityModalOpen(true);
                                  setLakeCreateMessage({ type: 'error', text: `Lake "${pinFeature.name}" already exists. Please modify the name.` });
                                } else {
                                  // Name is unique - create directly
                                  await createLake({
                                    name: pinFeature.name,
                                    lat: locationData.coordinates.lat,
                                    lng: locationData.coordinates.lng,
                                  });
                                  
                                  // Refresh the lakes layer on the map (autoEnable to show immediately)
                                  window.dispatchEvent(new CustomEvent('atlas-layer-refresh', {
                                    detail: { layerId: 'lakes', autoEnable: true }
                                  }));
                                  
                                  setLakeCreateMessage({ type: 'success', text: `Created "${pinFeature.name}"` });
                                  
                                  // Clear message after 3 seconds
                                  setTimeout(() => setLakeCreateMessage(null), 3000);
                                }
                              } catch (error) {
                                console.error('Error creating lake:', error);
                                setLakeCreateMessage({ 
                                  type: 'error', 
                                  text: error instanceof Error ? error.message : 'Failed to create lake'
                                });
                              } finally {
                                setIsCreatingLake(false);
                              }
                            }}
                            disabled={isCreatingLake}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-2">
                              <GlobeAmericasIcon className="w-4 h-4 text-white/70" />
                              <span>{isCreatingLake ? 'Creating...' : 'Create Lake'}</span>
                            </div>
                            <span className="text-[10px] text-white/50 font-normal">Admin</span>
                          </button>
                          {lakeCreateMessage && (
                            <div className={`px-2 py-1 text-[10px] rounded ${
                              lakeCreateMessage.type === 'success' 
                                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                              {lakeCreateMessage.text}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Update City Coordinates - Only show for admin users on city-type locations */}
                    {isAdmin && (() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const isCity = pinCategory === 'City';
                      if (!isCity || !pinFeature?.name || !locationData?.coordinates) return null;
                      
                      return (
                        <div className="space-y-1.5">
                          <button
                            onClick={async () => {
                              if (!pinFeature?.name || !locationData?.coordinates) return;
                              
                              setIsUpdatingCityCoords(true);
                              setCityUpdateMessage(null);
                              
                              try {
                                // Find the city by name
                                const city = await findCityByName(pinFeature.name);
                                
                                if (!city) {
                                  setCityUpdateMessage({ type: 'error', text: `City "${pinFeature.name}" not found in database` });
                                  return;
                                }
                                
                                // Update the coordinates
                                await updateCityCoordinates(
                                  city.id,
                                  locationData.coordinates.lat,
                                  locationData.coordinates.lng
                                );
                                
                                // Refresh the cities layer on the map
                                window.dispatchEvent(new CustomEvent('atlas-layer-refresh', {
                                  detail: { layerId: 'cities' }
                                }));
                                
                                setCityUpdateMessage({ type: 'success', text: `Updated ${pinFeature.name} coordinates` });
                                
                                // Clear message after 3 seconds
                                setTimeout(() => setCityUpdateMessage(null), 3000);
                              } catch (error) {
                                console.error('Error updating city coordinates:', error);
                                setCityUpdateMessage({ 
                                  type: 'error', 
                                  text: error instanceof Error ? error.message : 'Failed to update coordinates'
                                });
                              } finally {
                                setIsUpdatingCityCoords(false);
                              }
                            }}
                            disabled={isUpdatingCityCoords}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-2">
                              <MapPinIcon className="w-4 h-4 text-white/70" />
                              <span>{isUpdatingCityCoords ? 'Updating...' : 'Update City Coordinates'}</span>
                            </div>
                            <span className="text-[10px] text-white/50 font-normal">Admin</span>
                          </button>
                          {cityUpdateMessage && (
                            <div className={`px-2 py-1 text-[10px] rounded ${
                              cityUpdateMessage.type === 'success' 
                                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                              {cityUpdateMessage.text}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* Hide Skip Trace and Draw Area for City, Road, Lake, Park, and School locations */}
                    {(() => {
                      const pinCategory = pinFeature ? getFeatureCategory(pinFeature.properties, pinFeature.type) : null;
                      const roadTypes = ['Road', 'Street', 'Highway', 'Path', 'Trail'];
                      const isCity = pinCategory === 'City';
                      const isRoad = pinCategory && roadTypes.includes(pinCategory);
                      const isLake = pinCategory === 'Lake';
                      const isPark = pinCategory === 'Park';
                      const isSchool = pinCategory === 'School';
                      if (isCity || isRoad || isLake || isPark || isSchool) return null;
                      return (
                        <>
                          {onSkipTrace && (
                            <button
                              onClick={() => {
                                setComingSoonFeature('Skip Trace');
                                setIsComingSoonModalOpen(true);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <FingerPrintIcon className="w-4 h-4 text-white/70" />
                                <span>Skip Trace</span>
                              </div>
                              <span className="text-[10px] text-white/50 font-normal">Coming Soon</span>
                            </button>
                          )}
                          {onDrawArea && (
                            <button
                              onClick={() => {
                                setComingSoonFeature('Draw Area');
                                setIsComingSoonModalOpen(true);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-white bg-transparent border border-white/20 hover:bg-white/10 rounded-md transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Square3Stack3DIcon className="w-4 h-4 text-white/70" />
                                <span>Draw Area</span>
                              </div>
                              <span className="text-[10px] text-white/50 font-normal">Coming Soon</span>
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Pin Location Metadata - Static */}
              {pinFeature && (
                <div className="mt-3 bg-white/5 rounded-md px-2 py-1.5">
                  <div className="text-[10px] text-white/60">
                    <span className="font-medium text-white/80">{pinFeature.name || pinFeature.type}</span>
                    {(() => {
                      const category = getFeatureCategory(pinFeature.properties, pinFeature.type);
                      return category ? <span> · {category}</span> : null;
                    })()}
                  </div>
                  {(() => {
                    const category = getFeatureCategory(pinFeature.properties, pinFeature.type);
                    if (category === 'City' && pinFeature.name) {
                      const citySlug = pinFeature.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                      return (
                        <Link href={`/explore/city/${citySlug}`} className="block text-[10px] text-white/70 hover:text-white underline transition-colors mt-1">
                          Explore City
                        </Link>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}


              {/* Cursor Position Metadata - Dynamic */}
              {hoverFeature && (
                <div className="mt-3 bg-white/5 rounded-md px-2 py-1.5">
                  <div className="text-[10px] text-white/60">
                    <span className="font-medium text-white/80">{hoverFeature.name || hoverFeature.type}</span>
                    {(() => {
                      const category = getFeatureCategory(hoverFeature.properties, hoverFeature.type);
                      return category ? <span> · {category}</span> : null;
                    })()}
                  </div>
                  {(() => {
                    const category = getFeatureCategory(hoverFeature.properties, hoverFeature.type);
                    if (category === 'City' && hoverFeature.name) {
                      const citySlug = hoverFeature.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                      return (
                        <Link href={`/explore/city/${citySlug}`} className="block text-[10px] text-white/70 hover:text-white underline transition-colors mt-1">
                          Explore City
                        </Link>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
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
        } : pinFeature}
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
            // Navigate to billing via URL params
            const url = new URL(window.location.href);
            url.searchParams.set('modal', 'account');
            url.searchParams.set('tab', 'billing');
            window.history.pushState({}, '', url.toString());
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}

      {/* Coming Soon Modal */}
      {isComingSoonModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsComingSoonModalOpen(false)}
          />
          <div className="relative bg-white/10 backdrop-blur rounded-md border border-white/20 p-[10px] max-w-sm w-full">
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-4 h-4 text-white/70" />
              <span className="text-sm font-semibold text-white">{comingSoonFeature}</span>
            </div>
            <p className="text-xs text-white/80 mb-3">
              This feature is coming soon. We&apos;re working hard to bring you powerful new tools.
            </p>
            <button
              onClick={() => setIsComingSoonModalOpen(false)}
              className="w-full px-3 py-2 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
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
        existingEntity={atlasEntityModalMode === 'edit' ? atlasEntityToEdit : undefined}
        onSuccess={() => {
          // Clear the selected atlas entity after successful edit
          if (atlasEntityModalMode === 'edit') {
            setSelectedAtlasEntity(null);
          }
          console.log(`Successfully ${atlasEntityModalMode === 'edit' ? 'updated' : 'created'} ${atlasEntityType}`);
        }}
      />
    </>
  );
}

