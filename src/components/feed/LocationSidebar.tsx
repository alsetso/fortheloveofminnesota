'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { XMarkIcon, MagnifyingGlassIcon, Bars3Icon, Cog6ToothIcon, InformationCircleIcon, MapPinIcon, FingerPrintIcon, Square3Stack3DIcon, SparklesIcon } from '@heroicons/react/24/outline';
import IntelligenceModal from './IntelligenceModal';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import type { MapboxMapInstance, MapboxMouseEvent } from '@/types/mapbox-events';
import PinStatsCard from '@/components/pins/PinStatsCard';
import PinTrendingBadge from '@/components/pins/PinTrendingBadge';
import PinAnalyticsModal from '@/components/pins/PinAnalyticsModal';

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

interface FeatureMetadata {
  type: string;
  name?: string;
  properties: Record<string, any>;
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
  onCloseCreatePinModal
}: LocationSidebarProps) {
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const temporaryMarkerRef = useRef<any>(null);
  const pathname = usePathname();

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
    
    // Clear selected pin when selecting a new location
    setSelectedPin(null);
    
    setLocationData({
      coordinates,
      placeName: feature.place_name,
      address: feature.place_name,
      type: 'search',
    });

    // Add temporary pin
    addTemporaryPin(coordinates);

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
  const reverseGeocode = useCallback(async (lng: number, lat: number): Promise<string | null> => {
    const token = MAP_CONFIG.MAPBOX_TOKEN;
    if (!token) {
      return null;
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
        return null;
      }

      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        return null;
      }

      return data.features[0].place_name || null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }, []);

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
      const address = await reverseGeocode(pin.coordinates.lng, pin.coordinates.lat);
      
      // Set selected pin data with address
      setSelectedPin({
        ...pin,
        address: address || null,
      });
      
      // Set location data to open sidebar
      setLocationData({
        coordinates: pin.coordinates,
        placeName: pin.name,
        address: address || undefined,
        type: 'pin-click',
      });
      
      // Update search input with pin name or address
      setSearchQuery(address || pin.name);
      
      // Clear pin feature metadata (we're showing pin data instead)
      setPinFeature(null);
      
      // Call onPinClick callback if provided
      if (onPinClick) {
        onPinClick({
          id: pin.id,
          name: pin.name,
          coordinates: pin.coordinates,
          address: address || undefined,
          description: pin.description || undefined,
        });
      }
    };

    window.addEventListener('open-pin-sidebar', handleOpenPinSidebar as EventListener);

    return () => {
      window.removeEventListener('open-pin-sidebar', handleOpenPinSidebar as EventListener);
    };
  }, [onPinClick, reverseGeocode, map, mapLoaded, onLocationSelect]);

  const handleMapClick = useCallback(async (e: MapboxMouseEvent) => {
    if (!map || !mapLoaded) return;
    
    const { lng, lat } = e.lngLat;
    
    // Check if click hit a pin - if so, don't show map click data
    try {
      const mapboxMap = map as any;
      const layersToCheck = [
        'map-pins-unclustered-point',
        'map-pins-unclustered-point-label',
        'map-pins-clusters',
        'map-pins-cluster-count',
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

        // If a pin was clicked, don't show map click data (pin click handler will show it)
        if (features.length > 0) {
          return;
        }
      }
    } catch (queryError) {
      // Continue with map click if query fails
    }

    // Add temporary pin
    addTemporaryPin({ lat, lng });

    // Clear selected pin when clicking on map (not a pin)
    setSelectedPin(null);

    // Get feature metadata at pin location
    const pinMetadata = getFeatureMetadata(e.point);
    setPinFeature(pinMetadata);

    // Reverse geocode to get address
    const address = await reverseGeocode(lng, lat);
    const placeName = address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    // Update search input with address
    setSearchQuery(placeName);

    // Set location data with address
    setLocationData({
      coordinates: { lat, lng },
      placeName: address || undefined,
      address: address || undefined,
      type: 'map-click',
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

  // Sidebar expands if either location data or selected pin exists
  const hasData = locationData !== null || selectedPin !== null;
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
        <div className={`relative bg-white rounded-lg border border-gray-200 shadow-sm ${hasData ? 'mb-0 border-b-0 rounded-b-none lg:rounded-b-none' : ''}`} style={{ pointerEvents: 'auto', zIndex: 50 }}>
          <div className="relative flex items-center">
            {/* Hamburger Menu Icon - Inside Input */}
            <div className="relative" ref={menuRef}>
              <button
                className={`flex items-center justify-center w-11 h-11 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all duration-150 rounded-l-lg pointer-events-auto ${
                  isMenuOpen ? 'bg-gray-50 text-gray-900' : ''
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
                <div className="absolute left-0 top-full mt-1 w-80 bg-white rounded-lg border border-gray-200 shadow-xl z-50">
                  {/* Tabs */}
                  <div className="flex border-b border-gray-200">
                    <button
                      onClick={() => setActiveTab('about')}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                        activeTab === 'about'
                          ? 'text-gray-900 border-gray-900'
                          : 'text-gray-500 hover:text-gray-700 border-transparent'
                      }`}
                    >
                      About
                    </button>
                    <button
                      onClick={() => setActiveTab('moderation')}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors border-b-2 ${
                        activeTab === 'moderation'
                          ? 'text-gray-900 border-gray-900 bg-gray-50'
                          : 'text-gray-500 hover:text-gray-700 border-transparent'
                      }`}
                    >
                      Moderation
                    </button>
                    <button
                      onClick={() => setActiveTab('press')}
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
                  <div className="max-h-96 overflow-y-auto">
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
                            <a href="mailto:hi@fortheloveofminnesota.com" className="text-blue-600 hover:underline">
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
                            <a href="mailto:hi@fortheloveofminnesota.com" className="text-blue-600 hover:underline">
                              hi@fortheloveofminnesota.com
                            </a>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Footer Links */}
                    <div className="border-t border-gray-200 p-4">
                      <div className="grid grid-cols-2 gap-px border border-gray-200">
                        <Link href="/faqs" className="px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-center border-r border-gray-200">
                          FAQs
                        </Link>
                        <Link href="/terms" className="px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-center">
                          Terms of Use
                        </Link>
                        <Link href="/privacy" className="px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-center border-r border-gray-200 border-t border-gray-200">
                          Privacy Policy
                        </Link>
                        <Link href="/contact" className="px-3 py-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-center border-t border-gray-200">
                          Contact
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="relative flex-1 border-l border-gray-200">
              {/* Search Icon */}
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              
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

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-lg border border-gray-200 shadow-xl max-h-64 overflow-y-auto"
              style={{ pointerEvents: 'auto', zIndex: 60 }}
            >
              {suggestions.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => handleSuggestionSelect(feature)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-2.5 transition-colors border-b border-gray-100 last:border-b-0 first:rounded-t-lg last:rounded-b-lg ${
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
        </div>

        {/* Border between search and location details */}
        {isExpanded && locationData && (
          <div className="w-full border-t border-gray-200"></div>
        )}

        {/* Content Sections - Only shown when expanded */}
        {isExpanded && (
          <div 
            className="overflow-y-auto bg-white rounded-b-lg lg:rounded-b-lg"
            style={{ 
              maxHeight: 'calc(100vh - 140px)',
              minHeight: 0,
            }}
          >
            <div className="p-4 space-y-3">
              
              {/* Pin Details - Shown when an existing pin is clicked */}
              {selectedPin && (
                <div className="space-y-3 mb-4 pb-4 border-b border-gray-200 relative">
                  <button
                    onClick={() => {
                      setSelectedPin(null);
                    }}
                    className="absolute top-0 right-0 p-1 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Close Pin Details"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                  <div>
                    {/* Account Info */}
                    {selectedPin.account && (
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                        {selectedPin.account.image_url ? (
                          <img 
                            src={selectedPin.account.image_url} 
                            alt={selectedPin.account.username || 'User'} 
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-medium">
                            {(selectedPin.account.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-medium text-gray-900">
                          {selectedPin.account.username || 'Unknown User'}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between gap-2 mb-2 pr-6">
                      <h3 className="text-sm font-semibold text-gray-900">{selectedPin.name}</h3>
                      {selectedPin.id && (
                        <PinTrendingBadge pinId={selectedPin.id} className="flex-shrink-0" />
                      )}
                    </div>
                    {selectedPin.description && (
                      <p className="text-xs text-gray-700 mb-2 leading-relaxed">
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
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(selectedPin.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Pin Analytics */}
                  {selectedPin.id && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <PinStatsCard pinId={selectedPin.id} compact={true} />
                      <button
                        onClick={() => {
                          setAnalyticsPinId(selectedPin.id);
                          setAnalyticsPinName(selectedPin.name || null);
                          setIsAnalyticsModalOpen(true);
                        }}
                        className="w-full text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-2 py-1.5 rounded transition-colors text-left"
                      >
                        View Full Analytics →
                      </button>
                    </div>
                  )}

                  {/* Intelligence Button for Selected Pin */}
                  <div className="pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setIsIntelligenceModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-md transition-colors"
                    >
                      <SparklesIcon className="w-4 h-4 text-gray-500" />
                      <span>Intelligence</span>
                    </button>
                  </div>
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
                    className="absolute top-0 right-0 p-1 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Close Location Details"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 pr-6">Location Details</h3>
                    {(locationData.address || locationData.placeName) && (
                      <p className="text-sm text-gray-700 mb-1">
                        {locationData.address || locationData.placeName}
                      </p>
                    )}
                    <div className="text-xs text-gray-600 mt-2">
                      <div>Lat: {locationData.coordinates.lat.toFixed(6)}</div>
                      <div>Lng: {locationData.coordinates.lng.toFixed(6)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tools Section - Only show for location data (temporary pin), not for existing pins */}
              {locationData && !selectedPin && (onCreatePin || onSkipTrace || onDrawArea) && (
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2">Tools</h4>
                  <div className="space-y-2">
                    {onCreatePin && (
                      <button
                        onClick={() => {
                          onCreatePin(locationData.coordinates);
                          // Don't close location details - they'll be hidden by the modal but should remain
                          // Keep temporary pin visible until modal closes or pin is created
                          // Location details will be restored when modal closes via back button
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-md transition-colors"
                      >
                        <MapPinIcon className="w-4 h-4 text-gray-500" />
                        <span>Create Pin</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsIntelligenceModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-md transition-colors"
                    >
                      <SparklesIcon className="w-4 h-4 text-gray-500" />
                      <span>Intelligence</span>
                    </button>
                    {onSkipTrace && (
                      <button
                        onClick={() => {
                          // Coming soon - do nothing
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-md transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FingerPrintIcon className="w-4 h-4 text-gray-500" />
                          <span>Skip Trace</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-normal">Coming Soon</span>
                      </button>
                    )}
                    {onDrawArea && (
                      <button
                        onClick={() => {
                          // Coming soon - do nothing
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-md transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Square3Stack3DIcon className="w-4 h-4 text-gray-500" />
                          <span>Draw Area</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-normal">Coming Soon</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Pin Location Metadata - Static */}
              {pinFeature && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2">
                    Pin Location: {pinFeature.name || pinFeature.type}
                  </h4>
                  {Object.keys(pinFeature.properties).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(pinFeature.properties).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="text-xs text-gray-600">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


              {/* Cursor Position Metadata - Dynamic */}
              {hoverFeature && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2">
                    Cursor: {hoverFeature.name || hoverFeature.type}
                  </h4>
                  {Object.keys(hoverFeature.properties).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(hoverFeature.properties).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="text-xs text-gray-600">
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
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
        />
      )}
    </>
  );
}

