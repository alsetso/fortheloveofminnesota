'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { MapPinIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface AddCoordinatesMapProps {
  initialCoordinates?: Coordinates | null;
  onCoordinatesChange: (coordinates: Coordinates | null) => void;
  height?: string;
  className?: string;
  placeholder?: string;
  externalSearchQuery?: string; // Allow external control of search query
  onSearchTriggered?: () => void; // Callback when search is triggered externally
  autoFocus?: boolean; // Keep focus on search input
}

export default function AddCoordinatesMap({
  initialCoordinates,
  onCoordinatesChange,
  height = '400px',
  className = '',
  placeholder = 'Search for a location...',
  externalSearchQuery,
  onSearchTriggered,
  autoFocus = false,
}: AddCoordinatesMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const marker = useRef<import('mapbox-gl').Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentCoordinates, setCurrentCoordinates] = useState<Coordinates | null>(initialCoordinates || null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Add or update marker - simple: if coordinates exist, show marker
  const addMarker = useCallback(async (coordinates: Coordinates) => {
    // Wait for map to be ready
    const waitForMap = () => {
      return new Promise<import('mapbox-gl').Map | null>((resolve) => {
        if (map.current && map.current.loaded() && !map.current.removed) {
          resolve(map.current);
          return;
        }
        
        const checkInterval = setInterval(() => {
          if (map.current && map.current.loaded() && !map.current.removed) {
            clearInterval(checkInterval);
            resolve(map.current);
          }
        }, 50);
        
        // Timeout after 3 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(null);
        }, 3000);
      });
    };

    const mapInstance = await waitForMap();
    if (!mapInstance) {
      console.warn('Map not ready, cannot add marker');
      return;
    }

    // Remove existing marker
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }

    // Create marker element
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.cssText = `
      width: 32px;
      height: 32px;
      background-color: #C2B289;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
    `;

    // Add inner dot
    const innerDot = document.createElement('div');
    innerDot.style.cssText = `
      width: 12px;
      height: 12px;
      background-color: white;
      border-radius: 50%;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    `;
    el.appendChild(innerDot);

    // Create marker
    try {
      const mapbox = await loadMapboxGL();
      
      // Double check map is still valid
      if (!mapInstance || mapInstance.removed) {
        console.warn('Map was removed, cannot add marker');
        return;
      }
      
      const newMarker = new mapbox.Marker(el)
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(mapInstance);

      marker.current = newMarker;
    } catch (error) {
      console.error('Error adding marker to map:', error);
    }
  }, []);

  // Fly to coordinates - simple: if map exists, fly to location
  const flyTo = useCallback(async (coordinates: Coordinates, zoom?: number) => {
    console.log('flyTo called with:', coordinates, 'zoom:', zoom);
    
    // Wait for map to be ready
    const waitForMap = () => {
      return new Promise<import('mapbox-gl').Map | null>((resolve) => {
        if (map.current && map.current.loaded() && !map.current.removed) {
          console.log('Map ready immediately');
          resolve(map.current);
          return;
        }
        
        console.log('Waiting for map to be ready...');
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (map.current && map.current.loaded() && !map.current.removed) {
            console.log('Map ready after', attempts, 'attempts');
            clearInterval(checkInterval);
            resolve(map.current);
          }
        }, 50);
        
        // Timeout after 3 seconds
        setTimeout(() => {
          console.warn('Map wait timeout');
          clearInterval(checkInterval);
          resolve(null);
        }, 3000);
      });
    };

    const mapInstance = await waitForMap();
    if (mapInstance && !mapInstance.removed) {
      try {
        console.log('Flying to:', [coordinates.lng, coordinates.lat]);
        mapInstance.flyTo({
          center: [coordinates.lng, coordinates.lat],
          zoom: zoom || 15,
          duration: 1500,
        });
      } catch (error) {
        console.error('Error flying to location:', error);
      }
    } else {
      console.warn('Map instance not available for flyTo');
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    const initMap = async () => {
      try {
        // Import Mapbox CSS
        await import('mapbox-gl/dist/mapbox-gl.css');
        
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) return;

        const center = initialCoordinates
          ? [initialCoordinates.lng, initialCoordinates.lat] as [number, number]
          : MAP_CONFIG.DEFAULT_CENTER;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center,
          zoom: initialCoordinates ? 15 : MAP_CONFIG.DEFAULT_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstance.on('load', async () => {
          console.log('Map loaded event fired');
          setMapLoaded(true);
          
          // Small delay to ensure map is fully ready
          setTimeout(async () => {
            // Add initial marker and fly to location if coordinates exist
            if (initialCoordinates) {
              console.log('Adding initial marker for:', initialCoordinates);
              setCurrentCoordinates(initialCoordinates);
              await addMarker(initialCoordinates);
              await flyTo(initialCoordinates, 15);
            }
            
            // Also check if currentCoordinates exist (from search)
            if (currentCoordinates && !initialCoordinates) {
              console.log('Adding marker for current coordinates:', currentCoordinates);
              await addMarker(currentCoordinates);
              await flyTo(currentCoordinates, 15);
            }
          }, 200);
        });

        // Handle map clicks to place marker
        mapInstance.on('click', async (e) => {
          const coordinates = {
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
          };
          await addMarker(coordinates);
          setCurrentCoordinates(coordinates);
          onCoordinatesChange(coordinates);
        });

        map.current = mapInstance;
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      if (marker.current) {
        marker.current.remove();
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, [initialCoordinates, addMarker, onCoordinatesChange]);

  // Update marker when initialCoordinates change externally - simple: if new coords, update marker and fly
  useEffect(() => {
    if (!mapLoaded || !initialCoordinates) return;

    const coordsChanged = 
      !currentCoordinates ||
      Math.abs(currentCoordinates.lat - initialCoordinates.lat) > 0.0001 ||
      Math.abs(currentCoordinates.lng - initialCoordinates.lng) > 0.0001;

    if (coordsChanged) {
      setCurrentCoordinates(initialCoordinates);
      addMarker(initialCoordinates);
      flyTo(initialCoordinates, 15);
    }
  }, [initialCoordinates, mapLoaded, addMarker, flyTo, currentCoordinates]);

  // Handle external search query changes - just set the query and keep focus
  useEffect(() => {
    if (externalSearchQuery && externalSearchQuery !== searchQuery) {
      setSearchQuery(externalSearchQuery);
      // Keep focus on search input if autoFocus is enabled
      if (autoFocus && searchInputRef.current) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
      // Trigger search after 2 seconds
      const timer = setTimeout(() => {
        // Call searchLocations directly
        if (externalSearchQuery.trim() && externalSearchQuery.length >= 2) {
          setIsSearching(true);
          const token = MAP_CONFIG.MAPBOX_TOKEN;
          if (token) {
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(externalSearchQuery)}.json`;
            const params = new URLSearchParams({
              access_token: token,
              country: 'us',
              bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
              types: 'address,poi,place',
              limit: '8',
              proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
            });

            fetch(`${url}?${params}`)
              .then(response => {
                if (!response.ok) throw new Error('Location search failed');
                return response.json();
              })
              .then(data => {
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
              })
              .catch(error => {
                console.error('Location search error:', error);
                setSuggestions([]);
                setShowSuggestions(false);
              })
              .finally(() => {
                setIsSearching(false);
                onSearchTriggered?.();
              });
          }
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [externalSearchQuery, searchQuery, onSearchTriggered, autoFocus]);

  // Keep focus on search input when autoFocus is enabled
  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus();
      // Re-focus if it loses focus
      const handleBlur = () => {
        if (autoFocus && searchInputRef.current) {
          setTimeout(() => searchInputRef.current?.focus(), 100);
        }
      };
      searchInputRef.current.addEventListener('blur', handleBlur);
      return () => {
        searchInputRef.current?.removeEventListener('blur', handleBlur);
      };
    }
  }, [autoFocus]);

  // Search for locations
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

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    searchLocations(value);
  };

  // Handle suggestion select - immediately add marker and fly to location
  const handleSuggestionSelect = async (feature: MapboxFeature) => {
    const coordinates = {
      lng: feature.center[0],
      lat: feature.center[1],
    };

    // Update state immediately
    setSearchQuery(feature.place_name);
    setShowSuggestions(false);
    setCurrentCoordinates(coordinates);
    onCoordinatesChange(coordinates);
    searchInputRef.current?.blur();
    
    // Immediately add marker and fly to location
    // Don't wait - execute right away
    if (map.current && map.current.loaded() && !map.current.removed) {
      // Map is ready, add marker and fly immediately
      try {
        await addMarker(coordinates);
        await flyTo(coordinates, 15);
      } catch (error) {
        console.error('Error adding marker/flying:', error);
      }
    } else {
      // Map not ready yet, wait for it then add marker and fly
      const waitAndAdd = async () => {
        let attempts = 0;
        const maxAttempts = 60; // 3 seconds max
        
        while (attempts < maxAttempts) {
          if (map.current && map.current.loaded() && !map.current.removed) {
            try {
              await addMarker(coordinates);
              await flyTo(coordinates, 15);
              break;
            } catch (error) {
              console.error('Error adding marker/flying:', error);
              break;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50));
          attempts++;
        }
      };
      
      waitAndAdd();
    }
  };

  // Clear coordinates
  const handleClear = () => {
    if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }
    setCurrentCoordinates(null);
    setSearchQuery('');
    onCoordinatesChange(null);
  };

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

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div className="relative border border-gray-300 rounded-lg overflow-hidden" style={{ height }}>
        <div ref={mapContainer} className="w-full h-full" />
        
        {/* Instructions Overlay */}
        {!currentCoordinates && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm text-sm text-gray-600">
            <MapPinIcon className="w-4 h-4 inline mr-2" />
            Click on the map or search to place a pin
          </div>
        )}

        {/* Coordinates Display */}
        {currentCoordinates && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 mb-1">Coordinates</div>
            <div className="text-sm font-mono text-gray-900">
              {currentCoordinates.lat.toFixed(6)}, {currentCoordinates.lng.toFixed(6)}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="mt-2 text-xs text-red-600 hover:text-red-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mt-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gold-600"></div>
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {suggestions.map((feature, index) => (
              <button
                key={feature.id || index}
                type="button"
                onClick={() => handleSuggestionSelect(feature)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
              >
                <div className="font-medium text-gray-900">{feature.text}</div>
                <div className="text-sm text-gray-500">{feature.place_name}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

