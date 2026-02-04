'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { MapPinIcon, MagnifyingGlassIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { useSearchState } from '@/contexts/SearchStateContext';
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

interface SearchContentProps {
  /** Callback when a city is clicked */
  onCityClick?: (city: { lat: number; lng: number }) => void;
  /** Callback when a pin is clicked (for backward compatibility) */
  onPinClick?: (pin: { lat: number; lng: number }) => void;
}

/**
 * Search content component - displays city search results inline in main content area
 */
export default function SearchContent({ onCityClick, onPinClick }: SearchContentProps) {
  const { searchQuery } = useSearchState();
  const [cities, setCities] = useState<CityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
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

  // Listen for search results updates from MapSearchInput
  useEffect(() => {
    const handleResultsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        cities: CityResult[];
        isSearching: boolean;
        query: string;
      }>;
      setCities(customEvent.detail.cities || []);
      setIsSearching(customEvent.detail.isSearching || false);
      setCurrentQuery(customEvent.detail.query || '');
      setSelectedIndex(-1);
    };

    window.addEventListener('search-results-updated', handleResultsUpdated);
    return () => {
      window.removeEventListener('search-results-updated', handleResultsUpdated);
    };
  }, []);

  const handleCityClick = (city: CityResult) => {
    const center = getCenterFromGeometry(city.geometry);
    if (!center) {
      info('Error', 'Could not calculate city center');
      return;
    }

    // Show toast notification
    success('City selected', `${city.feature_name}, ${city.county_name}`);

    // Trigger city click callback (for map interaction)
    if (onCityClick) {
      onCityClick({ lat: center.lat, lng: center.lng });
    }
    
    // Also support onPinClick for backward compatibility
    if (onPinClick) {
      onPinClick({ lat: center.lat, lng: center.lng });
    }
    
    // Dispatch city selected event (for MapSearchInput to handle boundary rendering)
    window.dispatchEvent(
      new CustomEvent('city-selected', {
        detail: { city, center },
      })
    );
  };

  // Get all results as a flat array for keyboard navigation
  const allResults = cities.map(c => ({ type: 'city' as const, data: c }));

  // Handle keyboard navigation for results
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
          handleCityClick(result.data as CityResult);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allResults, selectedIndex, handleCityClick]);

  const getCityDisplayName = (city: CityResult): string => {
    return `${city.feature_name}, ${city.county_name}`;
  };

  const getCityTypeLabel = (ctuClass: string): string => {
    switch (ctuClass) {
      case 'CITY':
        return 'City';
      case 'TOWNSHIP':
        return 'Township';
      case 'UNORGANIZED TERRITORY':
        return 'Unorganized Territory';
      default:
        return ctuClass;
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return <>{text}</>;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return <>{text}</>;
    
    const parts: (string | ReactElement)[] = [];
    let lastIndex = 0;
    let searchIndex = lowerText.indexOf(lowerQuery, lastIndex);
    
    while (searchIndex !== -1) {
      // Add text before match
      if (searchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, searchIndex));
      }
      // Add highlighted match
      parts.push(
        <span key={searchIndex} className="bg-gray-200">
          {text.substring(searchIndex, searchIndex + lowerQuery.length)}
        </span>
      );
      lastIndex = searchIndex + lowerQuery.length;
      searchIndex = lowerText.indexOf(lowerQuery, lastIndex);
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return <>{parts}</>;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search results */}
      <div className="flex-1 min-h-0 overflow-y-auto p-[10px] space-y-3">
        {isSearching && cities.length === 0 && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-3 h-3 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
            <p className="text-xs text-gray-600">Searching...</p>
          </div>
        )}

        {!isSearching && cities.length === 0 && currentQuery.length >= 2 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <MagnifyingGlassIcon className="w-5 h-5 mb-2" />
            <p className="text-xs text-center">No cities found</p>
          </div>
        )}

        {!isSearching && cities.length === 0 && currentQuery.length < 2 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <MagnifyingGlassIcon className="w-5 h-5 mb-2" />
            <p className="text-xs text-center">Start typing to search cities</p>
          </div>
        )}

        {/* Cities section */}
        {cities.length > 0 && (
          <div className="space-y-1">
            {cities.map((city, index) => {
              const isSelected = selectedIndex === index;
              const displayName = getCityDisplayName(city);
              return (
                <button
                  key={`city-${city.id}`}
                  type="button"
                  onClick={() => handleCityClick(city)}
                  className={`w-full flex items-start gap-2 p-[10px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 transition-colors text-left ${
                    isSelected ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
                    <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">
                      {highlightText(displayName, currentQuery)}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {getCityTypeLabel(city.ctu_class)}
                      {city.population ? ` · ${city.population.toLocaleString()} people` : ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
