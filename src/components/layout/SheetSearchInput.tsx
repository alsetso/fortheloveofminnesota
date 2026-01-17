'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, MapPinIcon, NewspaperIcon } from '@heroicons/react/24/outline';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';

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

interface NewsArticleSuggestion {
  id: string;
  article_id: string;
  title: string;
  snippet?: string | null;
  source_name?: string | null;
  published_at: string;
  type: 'news';
}

type SearchSuggestion = MapboxFeature | NewsArticleSuggestion;

interface SheetSearchInputProps {
  map?: MapboxMapInstance | null;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string) => void;
}

export default function SheetSearchInput({ map, onLocationSelect }: SheetSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });

  // Listen for blur style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    };
  }, []);


  // Combined search: Mapbox geocoding + News articles
  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const searchTerm = query.trim().toLowerCase();
      
      const [mapboxResults, newsResults] = await Promise.allSettled([
        // Mapbox geocoding
        (async () => {
          const token = MAP_CONFIG.MAPBOX_TOKEN;
          if (!token) return [];
          
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
          const params = new URLSearchParams({
            access_token: token,
            country: 'us',
            bbox: `${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}`,
            types: 'address,poi,place',
            limit: '5',
            autocomplete: 'true',
            proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
          });

          const response = await fetch(`${url}?${params}`);
          if (!response.ok) return [];
          
          const data = await response.json();
          return (data.features || []).filter((feature: MapboxFeature) => {
            const context = feature.context || [];
            const stateContext = context.find((c) => c.id && c.id.startsWith('region.'));
            return stateContext && (
              stateContext.short_code === 'US-MN' ||
              stateContext.text === 'Minnesota'
            );
          });
        })(),
        // News articles search
        (async () => {
          try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await (supabase as any)
              .schema('news')
              .from('generated')
              .select('article_id, title, snippet, source_name, published_at')
              .or(`title.ilike.%${searchTerm}%,snippet.ilike.%${searchTerm}%`)
              .order('published_at', { ascending: false })
              .limit(5);
            
            if (error || !data) return [];
            
            return data.map((article: any): NewsArticleSuggestion => ({
              id: article.article_id,
              article_id: article.article_id,
              title: article.title,
              snippet: article.snippet,
              source_name: article.source_name,
              published_at: article.published_at,
              type: 'news',
            }));
          } catch (error) {
            console.error('News search error:', error);
            return [];
          }
        })(),
      ]);

      const mapboxFeatures = mapboxResults.status === 'fulfilled' ? mapboxResults.value : [];
      const newsArticles = newsResults.status === 'fulfilled' ? newsResults.value : [];
      
      // Combine results: addresses first, then news articles
      const combined = [...mapboxFeatures, ...newsArticles];
      
      setSuggestions(combined);
      setShowSuggestions(combined.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
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

    if (searchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchLocations(searchQuery);
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
  }, [searchQuery, searchLocations]);

  // Handle suggestion select
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Handle news article
    if ('type' in suggestion && suggestion.type === 'news') {
      const article = suggestion as NewsArticleSuggestion;
      setSearchQuery(article.title);
      
      // Navigate to news article page
      window.location.href = `/news/${article.article_id}`;
      return;
    }
    
    const feature = suggestion as MapboxFeature;
    const [lng, lat] = feature.center;
    setSearchQuery(feature.place_name);
    
    if (map && map.flyTo) {
      map.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1500,
      });
    }
    
    if (onLocationSelect) {
      onLocationSelect({ lat, lng }, feature.place_name);
    }
  }, [map, onLocationSelect]);


  return (
    <div className="relative">
      <div className={`rounded-lg px-3 py-2 flex items-center gap-2 ${
        useBlurStyle ? 'bg-white/10' : 'bg-gray-100'
      }`}>
        <MagnifyingGlassIcon className={`w-4 h-4 flex-shrink-0 ${
          useBlurStyle ? 'text-white/80' : 'text-gray-500'
        }`} />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery || ''}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchQuery.trim() && suggestions.length > 0 && selectedIndex >= 0) {
              e.preventDefault();
              handleSuggestionSelect(suggestions[selectedIndex]);
            } else if (e.key === 'Enter' && searchQuery.trim() && suggestions.length > 0) {
              e.preventDefault();
              handleSuggestionSelect(suggestions[0]);
            }
          }}
          placeholder="Search here"
          className={`flex-1 bg-transparent border-0 outline-none text-sm ${
            useBlurStyle 
              ? 'text-white placeholder:text-white/60' 
              : 'text-gray-900 placeholder:text-gray-500'
          }`}
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg border max-h-64 overflow-y-auto z-50 ${
          useBlurStyle
            ? 'bg-white/90 backdrop-blur-md border-white/20'
            : 'bg-white border-gray-200'
        }`}>
          {suggestions.map((suggestion, index) => {
            const isNews = 'type' in suggestion && suggestion.type === 'news';
            const article = isNews ? (suggestion as NewsArticleSuggestion) : null;
            const feature = !isNews ? (suggestion as MapboxFeature) : null;
            
            return (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionSelect(suggestion)}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  index === selectedIndex 
                    ? useBlurStyle ? 'bg-white/20' : 'bg-gray-50'
                    : useBlurStyle ? 'hover:bg-white/10' : 'hover:bg-gray-50'
                }`}
              >
                {isNews ? (
                  <div className="flex items-start gap-2">
                    <NewspaperIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      useBlurStyle ? 'text-white/60' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium truncate ${
                        useBlurStyle ? 'text-white' : 'text-gray-900'
                      }`}>
                        {article!.title}
                      </div>
                      <div className={`text-[10px] truncate ${
                        useBlurStyle ? 'text-white/60' : 'text-gray-500'
                      }`}>
                        {article!.source_name || 'News Article'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <MapPinIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      useBlurStyle ? 'text-white/60' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium truncate ${
                        useBlurStyle ? 'text-white' : 'text-gray-900'
                      }`}>
                        {feature!.text}
                      </div>
                      <div className={`text-[10px] truncate ${
                        useBlurStyle ? 'text-white/60' : 'text-gray-500'
                      }`}>
                        {feature!.place_name}
                      </div>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

