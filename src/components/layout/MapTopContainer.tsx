'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MicrophoneIcon, MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMetadata } from '@/types/mapbox';

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

interface AtlasEntitySuggestion {
  id: string;
  name: string;
  table_name: string;
  lat: number;
  lng: number;
  type: 'atlas';
}

type SearchSuggestion = MapboxFeature | AtlasEntitySuggestion;

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface MapTopContainerProps {
  map?: any;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: MapboxMetadata) => void;
}

interface AtlasType {
  id: string;
  slug: string;
  name: string;
  icon_path?: string | null;
  emoji?: string | null;
  status: 'active' | 'coming_soon' | 'hidden';
}

export default function MapTopContainer({ map, onLocationSelect }: MapTopContainerProps) {
  const { account } = useAuthStateSafe();
  const { openAccount } = useAppModalContextSafe();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [atlasTypes, setAtlasTypes] = useState<AtlasType[]>([]);
  const [visibleAtlasTypes, setVisibleAtlasTypes] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch visible atlas types
  useEffect(() => {
    const fetchAtlasTypes = async () => {
      try {
        const response = await fetch('/api/atlas/types');
        if (response.ok) {
          const data = await response.json();
          // API returns { types: [...] }
          const types = data.types || [];
          setAtlasTypes(types);
          
          // Initialize all active types as visible by default
          const activeSlugs = types
            .filter((type: AtlasType) => type.status === 'active')
            .map((type: AtlasType) => type.slug);
          setVisibleAtlasTypes(new Set(activeSlugs));
          
          // Dispatch initial visibility event
          window.dispatchEvent(new CustomEvent('atlas-visibility-change', {
            detail: { visibleTables: activeSlugs }
          }));
        }
      } catch (error) {
        console.error('Failed to fetch atlas types:', error);
      }
    };
    fetchAtlasTypes();
  }, []);

  // Check for browser support and initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition() as SpeechRecognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setIsRecording(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        
        // Handle common errors
        if (event.error === 'no-speech') {
          // User didn't speak, silently stop
        } else if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access to use voice search.');
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Combined search: Mapbox geocoding + Atlas entities
  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const searchTerm = query.trim().toLowerCase();
      
      // Search both in parallel
      const [mapboxResults, atlasResults] = await Promise.allSettled([
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
        // Atlas entities search
        (async () => {
          try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await supabase
              .from('atlas_entities')
              .select('id, name, table_name, lat, lng')
              .ilike('name', `%${searchTerm}%`)
              .not('lat', 'is', null)
              .not('lng', 'is', null)
              .limit(5);
            
            if (error || !data) return [];
            
            return data.map((entity): AtlasEntitySuggestion => ({
              id: entity.id,
              name: entity.name,
              table_name: entity.table_name,
              lat: entity.lat,
              lng: entity.lng,
              type: 'atlas',
            }));
          } catch (error) {
            console.error('Atlas search error:', error);
            return [];
          }
        })(),
      ]);

      const mapboxFeatures = mapboxResults.status === 'fulfilled' ? mapboxResults.value : [];
      const atlasEntities = atlasResults.status === 'fulfilled' ? atlasResults.value : [];
      
      // Combine results: addresses first, then atlas entities
      const combined = [...mapboxFeatures, ...atlasEntities];
      
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
    
    // Handle atlas entity
    if ('type' in suggestion && suggestion.type === 'atlas') {
      const entity = suggestion as AtlasEntitySuggestion;
      setSearchQuery(entity.name);
      
      // Fly to location
      if (map && map.flyTo) {
        map.flyTo({
          center: [entity.lng, entity.lat],
          zoom: 15,
          duration: 1500,
        });
      }
      
      // Dispatch event to show atlas entity popup
      window.dispatchEvent(new CustomEvent('atlas-entity-click', {
        detail: {
          id: entity.id,
          name: entity.name,
          table_name: entity.table_name,
          lat: entity.lat,
          lng: entity.lng,
        }
      }));
      return;
    }
    
    // Handle Mapbox feature (address)
    const feature = suggestion as MapboxFeature;
    const [lng, lat] = feature.center;
    setSearchQuery(feature.place_name);
    
    // Fly to location
    if (map && map.flyTo) {
      map.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1500,
      });
    }

    // Call onLocationSelect callback if provided
    if (onLocationSelect) {
      onLocationSelect({ lat, lng }, feature.place_name, feature as unknown as MapboxMetadata);
    }
  }, [map, onLocationSelect]);

  // Handle keyboard navigation
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
        handleSuggestionSelect(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, suggestions, selectedIndex, handleSuggestionSelect]);

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

  const handleVoiceSearch = () => {
    if (!isSupported) {
      alert('Voice search is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setIsRecording(false);
      }
    }
  };

  const handleAtlasTypeClick = (atlasType: AtlasType) => {
    // Only allow toggling active types
    if (atlasType.status !== 'active') {
      return;
    }

    const newVisible = new Set(visibleAtlasTypes);
    if (newVisible.has(atlasType.slug)) {
      newVisible.delete(atlasType.slug);
    } else {
      newVisible.add(atlasType.slug);
    }
    
    setVisibleAtlasTypes(newVisible);
    
    // Dispatch visibility change event for AtlasLayer
    const visibleTables = Array.from(newVisible);
    window.dispatchEvent(new CustomEvent('atlas-visibility-change', {
      detail: { visibleTables }
    }));

    // Also update map filters directly if map is available
    if (map) {
      const mapboxMap = map as any;
      const pointLayerId = 'atlas-layer-point';
      const labelLayerId = 'atlas-layer-label';

      try {
        const pointLayer = mapboxMap.getLayer(pointLayerId);
        const labelLayer = mapboxMap.getLayer(labelLayerId);
        
        if (pointLayer && labelLayer) {
          // Build filter: show all visible entities
          const newFilter = visibleTables.length > 0
            ? ['any', ...visibleTables.map(name => ['==', ['get', 'table_name'], name])]
            : ['literal', false]; // Hide all if none visible

          mapboxMap.setFilter(pointLayerId, newFilter);
          mapboxMap.setFilter(labelLayerId, newFilter);
        }
      } catch (e) {
        console.warn('[MapTopContainer] Error updating map filters:', e);
      }
    }
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-[45] pointer-events-none">
      <div ref={containerRef} className="pointer-events-auto space-y-2 relative">
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2 flex items-center gap-2 relative">
          {/* Pin Icon */}
          <div className="flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 0C6.13 0 3 3.13 3 7C3 12.25 10 20 10 20C10 20 17 12.25 17 7C17 3.13 13.87 0 10 0Z" fill="#EA4335"/>
              <path d="M10 9.5C11.38 9.5 12.5 8.38 12.5 7C12.5 5.62 11.38 4.5 10 4.5C8.62 4.5 7.5 5.62 7.5 7C7.5 8.38 8.62 9.5 10 9.5Z" fill="white"/>
            </svg>
          </div>

          {/* Search Input */}
          <div className="flex-1 min-w-0 relative">
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
                  // If Enter pressed with suggestions but none selected, select first
                  e.preventDefault();
                  handleSuggestionSelect(suggestions[0]);
                }
              }}
              placeholder="Search here"
              className="w-full bg-transparent border-0 outline-none text-gray-900 placeholder:text-gray-500 text-sm"
            />
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50">
                {suggestions.map((suggestion, index) => {
                  const isAtlas = 'type' in suggestion && suggestion.type === 'atlas';
                  const entity = isAtlas ? (suggestion as AtlasEntitySuggestion) : null;
                  const feature = !isAtlas ? (suggestion as MapboxFeature) : null;
                  
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                        index === selectedIndex ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isAtlas ? (
                          <>
                            <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {entity!.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate capitalize">
                                {entity!.table_name.replace('_', ' ')}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {feature!.text}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {feature!.place_name}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Microphone Icon */}
          <button
            onClick={handleVoiceSearch}
            disabled={!isSupported}
            className={`flex-shrink-0 p-1.5 transition-colors ${
              isRecording
                ? 'text-red-500 animate-pulse'
                : isSupported
                ? 'text-gray-500 hover:text-gray-700'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start voice search'}
            title={isSupported ? (isRecording ? 'Stop recording' : 'Start voice search') : 'Voice search not supported'}
          >
            <MicrophoneIcon className="w-4 h-4" />
          </button>

          {/* Profile Icon */}
          {account ? (
            <button
              onClick={() => openAccount('settings')}
              className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 hover:border-gray-300 transition-colors"
              aria-label="Account"
            >
              {account.image_url ? (
                <Image
                  src={account.image_url}
                  alt={account.username || 'Account'}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized={account.image_url.startsWith('data:') || account.image_url.includes('supabase.co')}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'A'}
                  </span>
                </div>
              )}
            </button>
          ) : (
            <button
              onClick={() => openAccount('settings')}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-center"
              aria-label="Sign In"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="6" r="3" stroke="#6B7280" strokeWidth="1.5" fill="none"/>
                <path d="M3 14C3 11.24 5.24 9 8 9C10.76 9 13 11.24 13 14" stroke="#6B7280" strokeWidth="1.5" fill="none"/>
              </svg>
            </button>
          )}
        </div>

        {/* Atlas Type Buttons */}
        {atlasTypes.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {atlasTypes.map((atlasType) => {
              const isActive = visibleAtlasTypes.has(atlasType.slug);
              const isToggleable = atlasType.status === 'active';
              
              return (
                <button
                  key={atlasType.id}
                  onClick={() => handleAtlasTypeClick(atlasType)}
                  disabled={!isToggleable}
                  className={`flex-shrink-0 rounded-md border px-2 py-1 flex items-center gap-1 transition-colors whitespace-nowrap relative ${
                    isToggleable
                      ? 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {atlasType.icon_path ? (
                    <Image
                      src={atlasType.icon_path}
                      alt={atlasType.name}
                      width={14}
                      height={14}
                      className={`w-3.5 h-3.5 object-contain ${isActive && isToggleable ? 'opacity-100' : 'opacity-60'}`}
                      unoptimized
                    />
                  ) : atlasType.emoji ? (
                    <span className="text-sm">{atlasType.emoji}</span>
                  ) : null}
                  <span className={`text-xs font-medium whitespace-nowrap ${
                    isToggleable
                      ? 'text-gray-700'
                      : 'text-gray-400'
                  }`}>
                    {atlasType.name}
                  </span>
                  {isActive && isToggleable && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

