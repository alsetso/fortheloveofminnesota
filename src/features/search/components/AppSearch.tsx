'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { MagnifyingGlassIcon, ClockIcon, XMarkIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { saveLocationSearch } from '@/features/location-searches/services/locationSearchService';
import type { MapPin } from '@/types/map-pin';
import type { MapboxMetadata } from '@/types/mapbox';

// Search type definitions - extensible for future search types
type SearchType = 'locations' | 'pins' | 'areas' | 'general';
type SearchTab = 'address' | 'pins';

interface SearchTypeConfig {
  id: SearchType;
  label: string;
  color: string;
  bgColor: string;
  enabled: boolean;
}

interface LocationSuggestion {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{ id: string; text: string }>;
}

interface AppSearchProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: MapboxMetadata) => void;
}

export default function AppSearch({ 
  placeholder = 'Search',
  onSearch,
  onLocationSelect,
}: AppSearchProps) {
  const pathname = usePathname();
  const isMapPage = pathname === '/maps' || pathname?.startsWith('/map/');
  
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('address');
  const [activeSearchTypes, setActiveSearchTypes] = useState<SearchType[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [pinSuggestions, setPinSuggestions] = useState<MapPin[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tagsContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [tagContainerWidth, setTagContainerWidth] = useState(0);

  // Search type configurations - extensible architecture
  const searchTypeConfigs: Record<SearchType, SearchTypeConfig> = {
    locations: {
      id: 'locations',
      label: 'Locations',
      color: 'text-gold-600',
      bgColor: 'bg-gold-100',
      enabled: isMapPage,
    },
    pins: {
      id: 'pins',
      label: 'Pins',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      enabled: true,
    },
    areas: {
      id: 'areas',
      label: 'Areas',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      enabled: true,
    },
    general: {
      id: 'general',
      label: 'General',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      enabled: true,
    },
  };

  // Auto-add Locations tag when on map page and input is focused
  useEffect(() => {
    if (isMapPage && isOpen && !activeSearchTypes.includes('locations')) {
      setActiveSearchTypes(['locations']);
    }
  }, [isMapPage, isOpen, activeSearchTypes]);

  // Update active search types based on active tab
  useEffect(() => {
    if (activeTab === 'address') {
      if (isMapPage) {
        setActiveSearchTypes(['locations']);
      } else {
        setActiveSearchTypes([]);
      }
    } else if (activeTab === 'pins') {
      setActiveSearchTypes(['pins']);
    }
  }, [activeTab, isMapPage]);

  // Measure tag container width for proper input padding
  useEffect(() => {
    if (tagsContainerRef.current && activeSearchTypes.length > 0) {
      const width = tagsContainerRef.current.offsetWidth;
      setTagContainerWidth(width);
    } else {
      setTagContainerWidth(0);
    }
  }, [activeSearchTypes]);

  // Mapbox geocoding search for locations
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (!token) {
        console.warn('No Mapbox token available for location search');
        setLocationSuggestions([]);
        return;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json`;
      const params = new URLSearchParams({
        access_token: token,
        country: 'US',
        types: 'address,poi,place',
        limit: '8',
        bbox: '-97.5,43.5,-89.5,49.5', // Minnesota bounds
        proximity: '-94.6859,46.7296', // Center of Minnesota
      });

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) throw new Error('Location search failed');

      const data = await response.json();
      setLocationSuggestions(data.features || []);
    } catch (error) {
      console.error('Location search error:', error);
      setLocationSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Search pins by description
  const searchPins = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setPinSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(`/api/map-pins/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Pin search failed');

      const data = await response.json();
      setPinSuggestions(data.pins || []);
    } catch (error) {
      console.error('Pin search error:', error);
      setPinSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (activeTab === 'address' && activeSearchTypes.includes('locations') && query.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchLocations(query);
      }, 300);
    } else if (activeTab === 'pins' && query.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchPins(query);
      }, 300);
    } else {
      setLocationSuggestions([]);
      setPinSuggestions([]);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, activeTab, activeSearchTypes, searchLocations, searchPins]);

  // Handle keyboard navigation
  useEffect(() => {
    const suggestions = activeTab === 'address' ? locationSuggestions : pinSuggestions;
    if (!isOpen || suggestions.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        if (activeTab === 'address') {
          const suggestion = locationSuggestions[selectedSuggestionIndex];
          handleLocationSelect(suggestion);
        } else {
          const pin = pinSuggestions[selectedSuggestionIndex];
          handlePinSelect(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, locationSuggestions, pinSuggestions, selectedSuggestionIndex]);

  const handleLocationSelect = async (suggestion: LocationSuggestion) => {
    const [lng, lat] = suggestion.center;
    setQuery(suggestion.place_name);
    setIsOpen(false);
    setLocationSuggestions([]);
    setSelectedSuggestionIndex(-1);
    
    // Save location search (background, non-blocking) - only on map or my-homes page with locations tag
    if (isMapPage && activeSearchTypes.includes('locations')) {
      saveLocationSearch({
        place_name: suggestion.place_name,
        coordinates: { lat, lng },
        mapbox_data: suggestion,
        search_query: query,
        page_source: isMapPage ? 'map' : 'my-homes',
      });
    }
    
    if (onLocationSelect) {
      onLocationSelect({ lat, lng }, suggestion.place_name, suggestion as unknown as MapboxMetadata);
    }
  };

  const handlePinSelect = (pin: MapPin) => {
    setQuery(pin.description || '');
    setIsOpen(false);
    setPinSuggestions([]);
    setSelectedSuggestionIndex(-1);
    
    // Fly to pin location on map
    if (onLocationSelect) {
      onLocationSelect({ lat: pin.lat, lng: pin.lng }, pin.description || 'Pin', undefined);
    }
  };

  const removeSearchType = (type: SearchType) => {
    setActiveSearchTypes(prev => prev.filter(t => t !== type));
    if (type === 'locations') {
      setLocationSuggestions([]);
      setQuery('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (selectedSuggestionIndex >= 0) {
      if (activeTab === 'address' && locationSuggestions.length > 0) {
        handleLocationSelect(locationSuggestions[selectedSuggestionIndex]);
      } else if (activeTab === 'pins' && pinSuggestions.length > 0) {
        handlePinSelect(pinSuggestions[selectedSuggestionIndex]);
      }
    } else {
      onSearch?.(query);
      setIsOpen(false);
    }
  };

  const handleInputClick = () => {
    setIsFullScreen(true);
    // Only open if user has typed something
    if (query.length > 0) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsFullScreen(true);
    // Only open if user has typed something
    if (query.length > 0) {
      setIsOpen(true);
    }
  };

  const handleCloseFullScreen = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsFullScreen(false);
      setIsOpen(false);
      inputRef.current?.blur();
    }, 300); // Match animation duration
  };

  // Trigger slide-in animation when full screen opens
  useEffect(() => {
    if (isFullScreen) {
      // Small delay to ensure DOM is ready, then trigger animation
      const timer = setTimeout(() => {
        setIsAnimating(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isFullScreen]);

  // Close full screen on ESC key
  useEffect(() => {
    if (!isFullScreen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseFullScreen();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullScreen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Mock recent searches - only show when not searching locations
  const recentSearches = activeSearchTypes.length === 0 || !activeSearchTypes.includes('locations') ? [
    { id: 1, query: 'Pins downtown', type: 'Pins' },
    { id: 2, query: 'Homes in Minneapolis', type: 'Homes' },
    { id: 3, query: 'Areas near lake', type: 'Areas' },
  ] : [];

  return (
    <>
      {/* Full Screen Overlay */}
      {isFullScreen && (
        <div
          className={`fixed inset-0 bg-white z-[9999] transition-transform duration-300 ease-out ${
            isAnimating ? 'translate-y-0' : '-translate-y-full'
          }`}
          style={{ top: 0 }}
        >
          <div className="h-full flex flex-col">
            {/* Header with close button */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
              <form onSubmit={handleSubmit} className="flex-1 max-w-2xl mx-auto">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
                    <MagnifyingGlassIcon className="w-5 h-5 text-gray-500" />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      const newQuery = e.target.value;
                      setQuery(newQuery);
                      setSelectedSuggestionIndex(-1);
                      // Open dropdown when user starts typing
                      if (newQuery.length > 0) {
                        setIsOpen(true);
                      } else {
                        setIsOpen(false);
                      }
                    }}
                    placeholder={placeholder}
                    className="w-full py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-500 bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                    autoFocus
                  />
                </div>
              </form>
              <button
                type="button"
                onClick={handleCloseFullScreen}
                className="ml-3 p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Search Results Container */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-3">
                {isOpen && (
                  <div className="space-y-3">
                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-gray-200 pb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('address');
                          setSelectedSuggestionIndex(-1);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          activeTab === 'address'
                            ? 'text-gray-900 border-b-2 border-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Address
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('pins');
                          setSelectedSuggestionIndex(-1);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          activeTab === 'pins'
                            ? 'text-gray-900 border-b-2 border-gray-900'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Pins
                      </button>
                    </div>

                    {/* Address Suggestions */}
                    {activeTab === 'address' && isMapPage && activeSearchTypes.includes('locations') && (
                      <div>
                        {isLoadingSuggestions ? (
                          <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>
                        ) : locationSuggestions.length > 0 ? (
                          <div className="space-y-0.5">
                            {locationSuggestions.map((suggestion, index) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => {
                                  handleLocationSelect(suggestion);
                                  handleCloseFullScreen();
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded transition-all duration-150 ${
                                  index === selectedSuggestionIndex
                                    ? 'bg-gray-100 text-gray-900 border border-gray-300'
                                    : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                                }`}
                              >
                                <div className="font-medium truncate">{suggestion.place_name}</div>
                                {suggestion.context && suggestion.context.length > 0 && (
                                  <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                    {suggestion.context
                                      .filter(ctx => ctx.id.startsWith('place') || ctx.id.startsWith('region'))
                                      .map(ctx => ctx.text)
                                      .join(', ')}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : query.length >= 2 && !isLoadingSuggestions ? (
                          <div className="px-3 py-2 text-xs text-gray-500">No locations found</div>
                        ) : null}
                      </div>
                    )}

                    {/* Pin Suggestions */}
                    {activeTab === 'pins' && (
                      <div>
                        {isLoadingSuggestions ? (
                          <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>
                        ) : pinSuggestions.length > 0 ? (
                          <div className="space-y-0.5">
                            {pinSuggestions.map((pin, index) => (
                              <button
                                key={pin.id}
                                type="button"
                                onClick={() => {
                                  handlePinSelect(pin);
                                  handleCloseFullScreen();
                                }}
                                className={`w-full text-left px-3 py-2 text-xs rounded transition-all duration-150 ${
                                  index === selectedSuggestionIndex
                                    ? 'bg-gray-100 text-gray-900 border border-gray-300'
                                    : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{pin.description || 'Untitled Pin'}</div>
                                    {pin.account?.username && (
                                      <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                        by {pin.account.username}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : query.length >= 2 && !isLoadingSuggestions ? (
                          <div className="px-3 py-2 text-xs text-gray-500">No pins found</div>
                        ) : null}
                      </div>
                    )}

                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <p className="text-xs font-medium text-gray-600">Recent searches</p>
                          <button
                            type="button"
                            onClick={() => {
                              // Clear recent searches logic here
                            }}
                            className="text-xs text-gray-600 hover:text-gray-700"
                          >
                            Clear history
                          </button>
                        </div>
                        <div className="space-y-1">
                          {recentSearches.map((search) => (
                            <button
                              key={search.id}
                              type="button"
                              onClick={() => {
                                setQuery(search.query);
                                setIsOpen(false);
                                inputRef.current?.focus();
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                            >
                              <ClockIcon className="w-4 h-4 text-gray-500" />
                              <span className="flex-1 text-left">{search.query}</span>
                              <span className="text-xs text-gray-500">{search.type}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Original Search Input (shown when not full screen) */}
      <form onSubmit={handleSubmit} className="w-full flex justify-center">
        <div ref={containerRef} className="relative" style={{ maxWidth: '600px', width: '100%' }}>
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
            <MagnifyingGlassIcon className="w-5 h-5 text-white/70" />
          </div>
          
          {/* Search Type Tags - UI removed, logic preserved */}
          
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              const newQuery = e.target.value;
              setQuery(newQuery);
              setSelectedSuggestionIndex(-1);
              // Open dropdown when user starts typing
              if (newQuery.length > 0) {
                setIsOpen(true);
              } else {
                setIsOpen(false);
              }
            }}
            onClick={handleInputClick}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="
              w-full py-2 relative z-10
              bg-transparent rounded-lg
              text-sm text-white/90 placeholder-white/60
              focus:outline-none focus:ring-2 focus:ring-gold-500/50
              transition-all
            "
            style={{
              borderWidth: '2px',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              paddingLeft: '2.5rem',
            }}
          />

        {/* Search Overlay - Only show when not in full screen mode */}
        {isOpen && !isFullScreen && (
          <>
            {/* Backdrop overlay for mobile */}
            <div
              className="fixed inset-0 bg-black/20 z-[110] md:hidden"
              onClick={() => setIsOpen(false)}
            />
            <div 
              className="absolute top-full left-0 right-0 bg-white rounded-lg shadow-xl border border-gray-200 z-[110] overflow-hidden"
              style={{
                marginTop: '10px',
                width: 'calc(100% + 20px)',
                left: '-10px',
                right: '-10px',
              }}
            >
              <div className="p-2.5 max-h-[60vh] overflow-y-auto">
              {/* Tabs */}
              <div className="flex gap-1 mb-3 border-b border-gray-200 sticky top-0 bg-white pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('address');
                    setSelectedSuggestionIndex(-1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === 'address'
                      ? 'text-gray-900 border-b-2 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Address
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pins');
                    setSelectedSuggestionIndex(-1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === 'pins'
                      ? 'text-gray-900 border-b-2 border-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pins
                </button>
              </div>

              {/* Address Suggestions */}
              {activeTab === 'address' && isMapPage && activeSearchTypes.includes('locations') && (
                <div className="mb-2">
                  {isLoadingSuggestions ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>
                  ) : locationSuggestions.length > 0 ? (
                    <div className="space-y-0.5">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => handleLocationSelect(suggestion)}
                          className={`w-full text-left px-3 py-2 text-xs rounded transition-all duration-150 ${
                            index === selectedSuggestionIndex
                              ? 'bg-gold-100 text-gold-700 border border-gold-300'
                              : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="font-medium truncate">{suggestion.place_name}</div>
                          {suggestion.context && suggestion.context.length > 0 && (
                            <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                              {suggestion.context
                                .filter(ctx => ctx.id.startsWith('place') || ctx.id.startsWith('region'))
                                .map(ctx => ctx.text)
                                .join(', ')}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : query.length >= 2 && !isLoadingSuggestions ? (
                    <div className="px-3 py-2 text-xs text-gray-500">No locations found</div>
                  ) : null}
                </div>
              )}

              {/* Pin Suggestions */}
              {activeTab === 'pins' && (
                <div className="mb-2">
                  {isLoadingSuggestions ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Searching...</div>
                  ) : pinSuggestions.length > 0 ? (
                    <div className="space-y-0.5">
                      {pinSuggestions.map((pin, index) => (
                        <button
                          key={pin.id}
                          type="button"
                          onClick={() => handlePinSelect(pin)}
                          className={`w-full text-left px-3 py-2 text-xs rounded transition-all duration-150 ${
                            index === selectedSuggestionIndex
                              ? 'bg-gold-100 text-gold-700 border border-gold-300'
                              : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <MapPinIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{pin.description || 'Untitled Pin'}</div>
                              {pin.account?.username && (
                                <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                  by {pin.account.username}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : query.length >= 2 && !isLoadingSuggestions ? (
                    <div className="px-3 py-2 text-xs text-gray-500">No pins found</div>
                  ) : null}
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-xs font-medium text-gray-600">Recent searches</p>
                    <button
                      type="button"
                      onClick={() => {
                        // Clear recent searches logic here
                      }}
                      className="text-xs text-gold-600 hover:text-gold-700"
                    >
                      Clear history
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search) => (
                      <button
                        key={search.id}
                        type="button"
                        onClick={() => {
                          setQuery(search.query);
                          setIsOpen(false);
                          inputRef.current?.focus();
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors"
                      >
                        <ClockIcon className="w-4 h-4 text-gray-500" />
                        <span className="flex-1 text-left">{search.query}</span>
                        <span className="text-xs text-gray-500">{search.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </>
        )}
      </div>
    </form>
    </>
  );
}

