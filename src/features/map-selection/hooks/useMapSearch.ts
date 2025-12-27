'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Coordinates } from '../types';

/**
 * Mapbox Geocoding Feature
 */
export interface MapboxSearchFeature {
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

export interface UseMapSearchOptions {
  /** Mapbox access token */
  accessToken: string;
  /** Bounding box to restrict results [west, south, east, north] */
  bounds?: [number, number, number, number];
  /** Country code to restrict results (e.g., 'us') */
  country?: string;
  /** Proximity coordinates for biasing results */
  proximity?: Coordinates;
  /** Debounce delay in ms */
  debounceMs?: number;
  /** Minimum query length to trigger search */
  minQueryLength?: number;
}

export interface UseMapSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  suggestions: MapboxSearchFeature[];
  isSearching: boolean;
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  clearSearch: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

const DEFAULT_OPTIONS: Partial<UseMapSearchOptions> = {
  debounceMs: 300,
  minQueryLength: 2,
  country: 'us',
};

/**
 * Extracted map search logic with Mapbox Geocoding API
 * 
 * Features:
 * - Debounced search
 * - Minnesota bounds filtering
 * - Keyboard navigation (up/down/enter/escape)
 * - Loading states
 */
export function useMapSearch(
  options: UseMapSearchOptions,
  onSelect?: (feature: MapboxSearchFeature) => void
): UseMapSearchReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [query, setQueryInternal] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxSearchFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Search function
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < (opts.minQueryLength || 2)) {
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
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json`;
      const params = new URLSearchParams({
        access_token: opts.accessToken,
        types: 'address,poi,place',
        limit: '8',
      });

      if (opts.country) {
        params.set('country', opts.country);
      }

      if (opts.bounds) {
        params.set('bbox', opts.bounds.join(','));
      }

      if (opts.proximity) {
        params.set('proximity', `${opts.proximity.lng},${opts.proximity.lat}`);
      }

      const response = await fetch(`${url}?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      // Filter to Minnesota only if bounds are for MN
      const filteredFeatures = (data.features || []).filter((feature: MapboxSearchFeature) => {
        const context = feature.context || [];
        const stateContext = context.find((c) => c.id?.startsWith('region.'));
        return stateContext && (
          stateContext.short_code === 'US-MN' ||
          stateContext.text === 'Minnesota'
        );
      });

      setSuggestions(filteredFeatures);
      setShowSuggestions(filteredFeatures.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      console.error('Search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, [opts.accessToken, opts.bounds, opts.country, opts.proximity, opts.minQueryLength]);

  // Debounced query setter
  const setQuery = useCallback((newQuery: string) => {
    setQueryInternal(newQuery);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(newQuery);
    }, opts.debounceMs);
  }, [searchLocations, opts.debounceMs]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQueryInternal('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const selected = suggestions[selectedIndex];
          setQueryInternal(selected.place_name);
          setShowSuggestions(false);
          setSelectedIndex(-1);
          onSelect?.(selected);
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, onSelect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isSearching,
    showSuggestions,
    setShowSuggestions,
    selectedIndex,
    setSelectedIndex,
    clearSearch,
    handleKeyDown,
  };
}





