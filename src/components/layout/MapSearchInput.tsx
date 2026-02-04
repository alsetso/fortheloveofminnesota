'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchState } from '@/contexts/SearchStateContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/features/ui/hooks/useToast';

interface CityResult {
  id: string;
  ctu_class: 'CITY' | 'TOWNSHIP' | 'UNORGANIZED TERRITORY';
  feature_name: string;
  county_name: string;
  county_code: string | null;
  population: number | null;
  geometry: any; // GeoJSON geometry
}

interface SearchResults {
  cities: CityResult[];
}

interface MapSearchInputProps {
  map?: any;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
  modalState?: {
    isAccountModalOpen: boolean;
    openAccount: () => void;
    openMapStyles: () => void;
    openDynamicSearch: (data?: any, type?: 'news' | 'people') => void;
    closeAccount: () => void;
    closeMapStyles: () => void;
    closeDynamicSearch: () => void;
    isModalOpen: (type: 'account' | 'mapStyles' | 'dynamicSearch') => boolean;
  };
  /** Whether search input should show active styling (when footer is in tall state) */
  isActive?: boolean;
}

export default function MapSearchInput({ map, onLocationSelect, modalState, isActive }: MapSearchInputProps) {
  const router = useRouter();
  const { 
    isSearchActive, 
    searchQuery, 
    activateSearch, 
    deactivateSearch, 
    clearSearch, 
    updateQuery,
  } = useSearchState();
  
  const [searchResults, setSearchResults] = useState<SearchResults>({ cities: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { success, info } = useToast();

  // Calculate center from GeoJSON geometry (handles Polygon, MultiPolygon, FeatureCollection, or direct geometry)
  const getCenterFromGeometry = (geometry: any): { lat: number; lng: number } | null => {
    if (!geometry) return null;
    
    try {
      // Handle FeatureCollection
      if (geometry.type === 'FeatureCollection' && geometry.features && geometry.features.length > 0) {
        return getCenterFromGeometry(geometry.features[0].geometry);
      }
      
      // Handle Feature
      if (geometry.type === 'Feature' && geometry.geometry) {
        return getCenterFromGeometry(geometry.geometry);
      }
      
      // Handle Point
      if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
        return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
      }
      
      // Handle Polygon
      if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
        const ring = geometry.coordinates[0]; // First ring (exterior ring)
        if (Array.isArray(ring) && ring.length > 0) {
          let sumLng = 0;
          let sumLat = 0;
          let count = 0;
          
          for (const coord of ring) {
            if (Array.isArray(coord) && coord.length >= 2) {
              sumLng += coord[0];
              sumLat += coord[1];
              count++;
            }
          }
          
          if (count > 0) {
            return { lng: sumLng / count, lat: sumLat / count };
          }
        }
      }
      
      // Handle MultiPolygon
      if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
        const firstPolygon = geometry.coordinates[0];
        if (Array.isArray(firstPolygon) && firstPolygon.length > 0) {
          const ring = firstPolygon[0];
          if (Array.isArray(ring) && ring.length > 0) {
            let sumLng = 0;
            let sumLat = 0;
            let count = 0;
            
            for (const coord of ring) {
              if (Array.isArray(coord) && coord.length >= 2) {
                sumLng += coord[0];
                sumLat += coord[1];
                count++;
              }
            }
            
            if (count > 0) {
              return { lng: sumLng / count, lat: sumLat / count };
            }
          }
        }
      }
    } catch (error) {
      console.error('Error calculating center from geometry:', error, geometry);
    }
    
    return null;
  };

  // Search for cities and towns
  const searchCities = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults({ cities: [] });
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=20`);
      
      if (!response.ok) {
        setSearchResults({ cities: [] });
        return;
      }
      
      const data: SearchResults = await response.json();
      setSearchResults(data || { cities: [] });
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ cities: [] });
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Sync input ref with searchQuery state
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== searchQuery) {
      inputRef.current.value = searchQuery;
    }
  }, [searchQuery]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = searchQuery.trim();
    
    if (trimmedQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchCities(searchQuery);
      }, 300);
    } else {
      setSearchResults({ cities: [] });
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchCities]);

  // Trigger boundary selection using existing system (instead of custom rendering)
  const selectCityBoundary = useCallback((city: CityResult) => {
    // Dispatch event to trigger boundary selection in the live map
    // This will integrate with the existing CTU boundary layer system
    window.dispatchEvent(
      new CustomEvent('city-boundary-select', {
        detail: {
          layer: 'ctu',
          id: city.id,
          name: `${city.feature_name}, ${city.county_name}`,
          city: city,
        },
      })
    );
  }, []);

  // Handle city selection
  const handleCitySelect = useCallback((city: CityResult) => {
    const center = getCenterFromGeometry(city.geometry);
    if (!center) {
      info('Error', 'Could not calculate city center');
      return;
    }

    // Show toast notification
    success('City selected', `${city.feature_name}, ${city.county_name}`);

    // Clear search results
    setSearchResults({ cities: [] });
    
    // Update query to show city name
    const cityName = `${city.feature_name}, ${city.county_name}`;
    updateQuery(cityName);

    // Fly to city location on map
    const mapboxMap = map as any;
    if (mapboxMap && typeof mapboxMap.flyTo === 'function') {
      mapboxMap.flyTo({
        center: [center.lng, center.lat],
        zoom: 11,
        duration: 1500,
      });

      // Wait for map to finish flying before selecting boundary
      mapboxMap.once('moveend', () => {
        selectCityBoundary(city);
      });
    } else {
      // If map is already loaded, select boundary immediately
      if (mapboxMap) {
        selectCityBoundary(city);
      }
    }

    // Trigger location select
    if (onLocationSelect) {
      onLocationSelect({ lat: center.lat, lng: center.lng }, cityName);
    }

    // Dispatch event for SearchContent to handle
    window.dispatchEvent(
      new CustomEvent('city-selected', {
        detail: {
          city,
          center,
        },
      })
    );
  }, [map, onLocationSelect, updateQuery, selectCityBoundary, success, info]);

  // Get all results as a flat array for keyboard navigation
  const allResults = searchResults.cities.map(c => ({ type: 'city' as const, data: c }));

  // Handle keyboard navigation
  useEffect(() => {
    if (allResults.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < allResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < allResults.length) {
        e.preventDefault();
        const result = allResults[selectedIndex];
        if (result.type === 'city') {
          handleCitySelect(result.data as CityResult);
        }
      } else if (e.key === 'Escape') {
        setSearchResults({ cities: [] });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allResults, selectedIndex, handleCitySelect]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Don't close on outside click - let SearchContent handle display
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen for city-selected events (from SearchContent) to select boundary
  useEffect(() => {
    const handleCitySelected = (event: Event) => {
      const customEvent = event as CustomEvent<{
        city: CityResult;
        center: { lat: number; lng: number };
      }>;
      const city = customEvent.detail.city;
      
      if (city) {
        // Select boundary using existing system
        selectCityBoundary(city);
      }
    };

    window.addEventListener('city-selected', handleCitySelected);
    return () => {
      window.removeEventListener('city-selected', handleCitySelected);
    };
  }, [selectCityBoundary]);

  // Dispatch search results to main content area
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('search-results-updated', {
        detail: {
          cities: searchResults.cities,
          isSearching,
          query: searchQuery,
        },
      })
    );
  }, [searchResults, isSearching, searchQuery]);

  const inputTextClass = 'text-[#3C3C43] placeholder:text-[#3C3C43]/60 caret-[#3C3C43]';

  // Handle click on search bar container - disabled
  const handleSearchBarClick = useCallback((e: React.MouseEvent) => {
    // Disabled - do nothing, but stop propagation to prevent drag on click
    e.stopPropagation();
  }, []);

  // Allow drag events to bubble up to parent draggable container
  // Don't prevent default or stop propagation for drag events
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Allow event to bubble up to parent draggable container
    // Only prevent if it's a quick click (not a drag)
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Allow event to bubble up to parent draggable container
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Bar */}
      <div 
        className="rounded-xl px-2 py-1 flex items-center gap-1.5 relative bg-gray-100 h-8 cursor-grab active:cursor-grabbing"
        onClick={handleSearchBarClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value=""
          readOnly
          disabled
          onChange={() => {
            // Disabled - do nothing
          }}
          onFocus={() => {
            // Disabled - do nothing
          }}
          onKeyDown={() => {
            // Disabled - do nothing
          }}
          onMouseDown={(e) => {
            // Allow drag events to bubble up to parent draggable container
            // Don't stop propagation - let parent handle drag
          }}
          onTouchStart={(e) => {
            // Allow drag events to bubble up to parent draggable container
            // Don't stop propagation - let parent handle drag
          }}
          placeholder="Improved search coming soon"
          className={`w-full bg-transparent border-0 outline-none text-sm py-0.5 ${inputTextClass} cursor-grab active:cursor-grabbing pointer-events-auto`}
        />
      </div>
    </div>
  );
}
