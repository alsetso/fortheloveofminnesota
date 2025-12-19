'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import type { MapboxMapInstance, MapboxMouseEvent } from '@/types/mapbox-events';

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

interface FeatureMetadata {
  type: string;
  name?: string;
  properties: Record<string, any>;
}

interface LocationSidebarProps {
  map: MapboxMapInstance | null;
  mapLoaded: boolean;
  onLocationSelect?: (coordinates: { lat: number; lng: number }) => void;
  onPinClick?: (pinData: { id: string; name: string; coordinates: { lat: number; lng: number }; address?: string; description?: string }) => void;
}

export default function LocationSidebar({ 
  map, 
  mapLoaded,
  onLocationSelect,
  onPinClick
}: TestMapLocationSidebarProps) {
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pinFeature, setPinFeature] = useState<FeatureMetadata | null>(null);
  const [hoverFeature, setHoverFeature] = useState<FeatureMetadata | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const temporaryMarkerRef = useRef<any>(null);

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

      // Create temporary marker element - white dot with black center
      const el = document.createElement('div');
      el.className = 'temporary-pin-marker';
      el.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #ffffff;
        border: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        pointer-events: none;
      `;

      // Create black center dot
      const centerDot = document.createElement('div');
      centerDot.style.cssText = `
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #000000;
      `;
      el.appendChild(centerDot);

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

  // Listen for pin click events
  useEffect(() => {
    if (!onPinClick) return;

    const handlePinClick = (event: CustomEvent) => {
      const pinData = event.detail;
      setLocationData({
        coordinates: pinData.coordinates,
        placeName: pinData.name,
        address: pinData.address,
        type: 'pin-click',
      });
    };

    window.addEventListener('test-map-pin-click', handlePinClick as EventListener);

    return () => {
      window.removeEventListener('test-map-pin-click', handlePinClick as EventListener);
    };
  }, [onPinClick]);

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

    searchInputRef.current?.blur();
  }, [map, mapLoaded, onLocationSelect, addTemporaryPin]);

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

  const handleMapClick = useCallback(async (e: MapboxMouseEvent) => {
    if (!map || !mapLoaded) return;
    
    const { lng, lat } = e.lngLat;
    
    // Check if click hit a pin - if so, don't show map click data
    try {
      const mapboxMap = map as any;
      const layersToCheck = [
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

  }, [map, mapLoaded, addTemporaryPin, reverseGeocode, getFeatureMetadata]);

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

  const hasData = locationData !== null;
  const isExpanded = hasData;

  // Search input is always in the sidebar
  // When collapsed (no data), background is transparent but search stays visible
  // When expanded (has data), background appears with blur effect
  return (
    <div 
      className={`
        fixed left-14 top-0 bottom-0 z-40 transition-all duration-300 ease-in-out
        ${isExpanded ? 'w-80' : 'w-64'}
      `}
      style={{
        backgroundColor: isExpanded ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
        pointerEvents: 'auto',
      }}
    >
      <div className="flex flex-col h-full p-4">
        {/* Search Input - Always Visible */}
        <div className={`relative ${hasData ? 'mb-4' : ''}`} style={{ pointerEvents: 'auto', zIndex: 50 }}>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-white/95 backdrop-blur-sm border border-white/30 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 50 }}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md rounded-lg border border-white/30 shadow-lg max-h-64 overflow-y-auto"
              style={{ pointerEvents: 'auto', zIndex: 60 }}
            >
              {suggestions.map((feature, index) => (
                <button
                  key={feature.id}
                  onClick={() => handleSuggestionSelect(feature)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 transition-colors border-b border-white/10 last:border-b-0 ${
                    selectedIndex === index
                      ? 'bg-white/70'
                      : 'hover:bg-white/50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{feature.text}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{feature.place_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Location Details - Only shown when expanded */}
        {isExpanded && locationData && (
          <div className="flex-1 overflow-y-auto">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 relative border border-gray-200">
                  <button
                    onClick={() => {
                      setLocationData(null);
                      setPinFeature(null);
                      removeTemporaryPin();
                    }}
                    className="absolute top-2 right-2 p-1 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Close"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Location Details</h3>
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
  );
}



