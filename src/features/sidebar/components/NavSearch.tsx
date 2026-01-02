'use client';

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface MapboxFeature {
  id: string;
  type: string;
  place_type: string[];
  relevance: number;
  properties: {
    accuracy?: string;
    [key: string]: unknown;
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

interface NavSearchProps {
  map?: MapboxMapInstance | null;
}

export default function NavSearch({ map }: NavSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search locations using Mapbox Geocoding API
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
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

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json`;
      const params = new URLSearchParams({
        access_token: token,
        country: 'us',
        bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
        types: 'address',
        limit: '8',
        autocomplete: 'true',
        proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        throw new Error('Location search failed');
      }

      const data = await response.json();
      const filteredFeatures = (data.features || []).filter((feature: MapboxFeature) => {
        const context = feature.context || [];
        const stateContext = context.find((c) => c.id && c.id.startsWith('region.'));
        return stateContext && (
          stateContext.short_code === 'US-MN' ||
          stateContext.text === 'Minnesota'
        );
      });

      setSuggestions(filteredFeatures);
      setShowSuggestions(filteredFeatures.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Location search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  }, [searchLocations]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelect(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  }, [showSuggestions, suggestions, selectedIndex]);

  // Handle selection
  const handleSelect = useCallback((feature: MapboxFeature) => {
    setQuery(feature.place_name);
    setShowSuggestions(false);
    inputRef.current?.blur();

    // Fly to location on map if available
    if (map && feature.center) {
      const [lng, lat] = feature.center;
      map.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1000,
      });
    }
  }, [map]);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-2 sm:mx-4">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search addresses..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 focus:bg-white"
        />
        {isSearching && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[200] max-h-64 overflow-y-auto">
          {suggestions.map((feature, index) => {
            const relevancePercent = Math.round((feature.relevance || 0) * 100);
            return (
              <button
                key={feature.id}
                onClick={() => handleSelect(feature)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                  index === selectedIndex ? 'bg-gray-50' : ''
                } ${index !== suggestions.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="text-gray-900 truncate flex-1 mr-2">{feature.place_name}</span>
                <span className="text-gray-500 flex-shrink-0">{relevancePercent}%</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

