'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxFeature } from '@/types/mapbox';

interface MapboxSearchFeature extends MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
  relevance: number;
  place_type: string[];
  context?: Array<{
    id: string;
    short_code?: string;
    text: string;
  }>;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxSearchFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Enhanced Mapbox geocoding search
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    
    try {
      const token = MAP_CONFIG.MAPBOX_TOKEN;
      if (!token) {
        console.error('Mapbox token not configured');
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const trimmedQuery = searchQuery.trim();
      
      // For longer queries (likely complete addresses), disable autocomplete for more precise results
      const useAutocomplete = trimmedQuery.length < 20;
      
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmedQuery)}.json`;
      const params = new URLSearchParams({
        access_token: token,
        country: 'us',
        bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
        types: 'address,poi,place',
        limit: '15',
        proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
        language: 'en',
      });

      // Only add autocomplete for shorter queries
      if (useAutocomplete) {
        params.set('autocomplete', 'true');
      }

      const response = await fetch(`${url}?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Location search failed');
      }

      const data = await response.json();
      
      // More flexible filtering - check multiple ways to identify Minnesota results
      const filteredFeatures = (data.features || [])
        .filter((feature: MapboxSearchFeature) => {
          // Check if place_name contains Minnesota
          const placeName = (feature.place_name || '').toLowerCase();
          if (placeName.includes('minnesota') || placeName.includes('mn')) {
            return true;
          }

          // Check context for state
          const context = feature.context || [];
          const stateContext = context.find((c) => c.id?.startsWith('region.'));
          if (stateContext) {
            if (stateContext.short_code === 'US-MN' || stateContext.text === 'Minnesota') {
              return true;
            }
          }

          // Check if coordinates are within Minnesota bounds
          const [lng, lat] = feature.center || [];
          if (lng && lat) {
            const withinBounds = 
              lng >= MAP_CONFIG.MINNESOTA_BOUNDS.west &&
              lng <= MAP_CONFIG.MINNESOTA_BOUNDS.east &&
              lat >= MAP_CONFIG.MINNESOTA_BOUNDS.south &&
              lat <= MAP_CONFIG.MINNESOTA_BOUNDS.north;
            if (withinBounds) {
              return true;
            }
          }

          return false;
        })
        .sort((a: MapboxSearchFeature, b: MapboxSearchFeature) => {
          // Sort by relevance first
          const relevanceDiff = (b.relevance || 0) - (a.relevance || 0);
          if (Math.abs(relevanceDiff) > 0.1) {
            return relevanceDiff;
          }
          // Then prefer addresses over POIs
          const aIsAddress = (a.place_type || []).includes('address');
          const bIsAddress = (b.place_type || []).includes('address');
          if (aIsAddress && !bIsAddress) return -1;
          if (!aIsAddress && bIsAddress) return 1;
          return 0;
        })
        .slice(0, 10); // Limit to top 10

      setSuggestions(filteredFeatures);
      setShowSuggestions(filteredFeatures.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      console.error('Location search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchLocations(query);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, searchLocations]);

  // Keyboard navigation
  useEffect(() => {
    if (!showSuggestions || suggestions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleLocationSelect(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, suggestions, selectedIndex]);

  const handleLocationSelect = useCallback((feature: MapboxSearchFeature) => {
    const [lng, lat] = feature.center;
    setQuery(feature.place_name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Navigate to map with location
    router.push(`/map?lat=${lat}&lng=${lng}&zoom=16`);
  }, [router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showSuggestions]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getPlaceTypeLabel = (placeType: string[]): string => {
    if (placeType.includes('poi')) return 'Place';
    if (placeType.includes('address')) return 'Address';
    if (placeType.includes('place')) return 'Location';
    return 'Location';
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-[10px] py-3">
      <div className="w-full max-w-2xl space-y-3">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt="For the Love of Minnesota"
            width={200}
            height={200}
            className="w-auto h-auto max-w-[200px]"
            priority
            unoptimized
          />
        </div>

        {/* Search Input */}
        <div ref={containerRef} className="relative">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-500" />
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const newQuery = e.target.value;
                setQuery(newQuery);
                setSelectedIndex(-1);
                if (newQuery.length > 0) {
                  setShowSuggestions(true);
                } else {
                  setShowSuggestions(false);
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              placeholder="Search addresses and places in Minnesota..."
              className="w-full py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
            />

            {isSearching && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[60vh] overflow-y-auto">
              <div className="p-2 space-y-0.5">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => handleLocationSelect(suggestion)}
                    className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                      index === selectedIndex
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MapPinIcon className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{suggestion.place_name}</div>
                        {suggestion.context && suggestion.context.length > 0 && (
                          <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                            {suggestion.context
                              .filter(ctx => ctx.id?.startsWith('place.') || ctx.id?.startsWith('region.') || ctx.id?.startsWith('postcode.'))
                              .map(ctx => ctx.text)
                              .join(', ')}
                          </div>
                        )}
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {getPlaceTypeLabel(suggestion.place_type || [])}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSuggestions && query.length >= 2 && !isSearching && suggestions.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-50">
              <div className="p-3 text-xs text-gray-500 text-center">
                No locations found
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

