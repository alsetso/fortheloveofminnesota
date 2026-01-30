'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/outline';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMetadata } from '@/types/mapbox';
import ProfilePhoto from '../shared/ProfilePhoto';
import { Account } from '@/features/auth';

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

interface PeopleSuggestion {
  id: string;
  name: string;
  type: 'people';
}

interface AccountSuggestion {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  plan: string | null;
  type: 'account';
}

type SearchSuggestion = MapboxFeature | PeopleSuggestion | AccountSuggestion;

interface MapSearchInputProps {
  map?: any;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: MapboxMetadata) => void;
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
}

export default function MapSearchInput({ map, onLocationSelect, modalState }: MapSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();
  const { openAccount, openWelcome } = useAppModalContextSafe();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [placeholderText, setPlaceholderText] = useState<string>('Enter address');
  const [isAccountSearch, setIsAccountSearch] = useState(false);
  const [showNoAccountResults, setShowNoAccountResults] = useState(false);
  const [currentUserSearchVisibility, setCurrentUserSearchVisibility] = useState<boolean | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placeholderIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticUpdateRef = useRef(false);

  // Check if we're in search mode
  useEffect(() => {
    const checkHash = () => {
      setIsSearchMode(window.location.hash === '#search');
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // Update placeholder based on content_type filter
  useEffect(() => {
    const contentType = searchParams.get('content_type');
    
    // Clear rotating placeholder interval when content_type is set
    if (placeholderIntervalRef.current) {
      clearInterval(placeholderIntervalRef.current);
      placeholderIntervalRef.current = null;
    }

    if (contentType === 'posts') {
      setPlaceholderText('Search..');
    } else if (contentType === 'mentions') {
      setPlaceholderText('Search..');
    } else if (contentType === 'groups') {
      setPlaceholderText('Search..');
    } else if (contentType === 'users') {
      setPlaceholderText('Search..');
    } else if (contentType === 'news') {
      setPlaceholderText('Search..');
    } else {
      // Default placeholder
      setPlaceholderText('Search..');
    }

    return () => {
      if (placeholderIntervalRef.current) {
        clearInterval(placeholderIntervalRef.current);
      }
    };
  }, [searchParams]);

  // Combined search: Mapbox geocoding + Accounts (when @ is present)
  const searchLocations = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    const hasAtSymbol = trimmedQuery.startsWith('@');
    
    if (hasAtSymbol) {
      setIsAccountSearch(true);
      
      if (!account) {
        setSuggestions([]);
        setShowSuggestions(false);
        setShowNoAccountResults(false);
        setIsSearching(false);
        openWelcome();
        return;
      }
      
      const usernameQuery = trimmedQuery.slice(1).trim().toLowerCase();
      
      setIsSearching(true);
      try {
        const { supabase } = await import('@/lib/supabase');
        
        if (account.id) {
          const { data: currentUserData } = await supabase
            .from('accounts')
            .select('search_visibility')
            .eq('id', account.id)
            .single();
          
          if (currentUserData) {
            setCurrentUserSearchVisibility(currentUserData.search_visibility || false);
          }
        }
        
        let accountsQuery = supabase
          .from('accounts')
          .select('id, username, first_name, last_name, image_url, plan')
          .eq('search_visibility', true)
          .not('username', 'is', null);
        
        if (usernameQuery.length > 0) {
          accountsQuery = accountsQuery.ilike('username', `${usernameQuery}%`);
        } else {
          accountsQuery = accountsQuery.order('view_count', { ascending: false, nullsFirst: false });
        }
        
        const { data, error } = await accountsQuery.limit(5);
        
        if (error) {
          console.error('Account search error:', error);
          setSuggestions([]);
          setShowSuggestions(false);
          setShowNoAccountResults(false);
          return;
        }
        
        if (!data || data.length === 0) {
          setSuggestions([]);
          setShowSuggestions(true);
          setShowNoAccountResults(true);
          setSelectedIndex(-1);
          return;
        }
        
        const accounts = data.map((account: any): AccountSuggestion => ({
          id: account.id,
          username: account.username,
          first_name: account.first_name,
          last_name: account.last_name,
          image_url: account.image_url,
          plan: account.plan,
          type: 'account',
        }));
        
        setSuggestions(accounts);
        setShowSuggestions(accounts.length > 0);
        setShowNoAccountResults(false);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Account search error:', error);
        setSuggestions([]);
        setShowSuggestions(false);
        setShowNoAccountResults(false);
      } finally {
        setIsSearching(false);
      }
      return;
    }
    
    setIsAccountSearch(false);
    setShowNoAccountResults(false);

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const searchTerm = trimmedQuery.toLowerCase();
      
      const [mapboxResults, peopleResults] = await Promise.allSettled([
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
        (async () => {
          try {
            const { supabase } = await import('@/lib/supabase');
            const { data, error } = await (supabase as any)
              .schema('civic')
              .from('people')
              .select('id, name')
              .ilike('name', `%${searchTerm}%`)
              .limit(5);
            
            if (error || !data) return [];
            
            return data.map((person: any): PeopleSuggestion => ({
              id: person.id,
              name: person.name,
              type: 'people',
            }));
          } catch (error) {
            console.error('People search error:', error);
            return [];
          }
        })(),
      ]);

      const mapboxFeatures = mapboxResults.status === 'fulfilled' ? mapboxResults.value : [];
      const people = peopleResults.status === 'fulfilled' ? peopleResults.value : [];
      
      const combined = [...mapboxFeatures, ...people];
      
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
  }, [account, openWelcome]);

  // Debounced search
  useEffect(() => {
    if (isProgrammaticUpdateRef.current) {
      isProgrammaticUpdateRef.current = false;
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = searchQuery.trim();
    const hasAtSymbol = trimmedQuery.startsWith('@');
    
    if (hasAtSymbol) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchLocations(searchQuery);
    } else if (trimmedQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchLocations(searchQuery);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsAccountSearch(false);
      setShowNoAccountResults(false);
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
    
    if ('type' in suggestion && suggestion.type === 'account') {
      const account = suggestion as AccountSuggestion;
      setSearchQuery(`@${account.username}`);
      if (account.username) {
        window.location.href = `/${account.username}`;
      }
      return;
    }
    
    if ('type' in suggestion && suggestion.type === 'people') {
      const person = suggestion as PeopleSuggestion;
      setSearchQuery(person.name);
      if (modalState) {
        modalState.openDynamicSearch(person, 'people');
      }
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
      onLocationSelect({ lat, lng }, feature.place_name, feature as unknown as MapboxMetadata);
    }
  }, [map, onLocationSelect, modalState]);

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

  // Listen for address updates from map clicks
  useEffect(() => {
    const handleUpdateSearchAddress = (event: Event) => {
      const customEvent = event as CustomEvent<{ address: string; coordinates?: { lat: number; lng: number } }>;
      const address = customEvent.detail?.address;
      const coordinates = customEvent.detail?.coordinates;
      
      if (address) {
        isProgrammaticUpdateRef.current = true;
        
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
        
        setSuggestions([]);
        setShowSuggestions(false);
        setSearchQuery(address);
        
        if (coordinates && map && map.flyTo) {
          map.flyTo({
            center: [coordinates.lng, coordinates.lat],
            zoom: 15,
            duration: 1500,
          });
          
          if (onLocationSelect) {
            onLocationSelect(coordinates, address);
          }
        }
      }
    };

    const handleMentionCreated = () => {
      setSearchQuery('');
    };

    const handleMentionFormClosed = () => {
      setSearchQuery('');
    };

    window.addEventListener('update-search-address', handleUpdateSearchAddress);
    window.addEventListener('mention-created', handleMentionCreated);
    window.addEventListener('mention-form-closed', handleMentionFormClosed);

    return () => {
      window.removeEventListener('update-search-address', handleUpdateSearchAddress);
      window.removeEventListener('mention-created', handleMentionCreated);
      window.removeEventListener('mention-form-closed', handleMentionFormClosed);
    };
  }, [map, onLocationSelect]);

  const inputTextClass = 'text-[#3C3C43] placeholder:text-[#3C3C43]/60 caret-[#3C3C43]';
  const prefixClass = 'text-[#3C3C43]';
  const caretColor = '#3C3C43';

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Bar */}
      <div className="rounded-xl shadow-lg px-2 py-1 flex items-center gap-1.5 relative bg-white h-8">
        {/* Search Input */}
        <div className="flex-1 min-w-0 relative flex items-center gap-1.5 h-full">
          <div className="flex-1 relative">
            {searchQuery && searchQuery.startsWith('@') && (
              <div 
                className="absolute inset-0 pointer-events-none flex items-center"
                style={{ 
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  lineHeight: '1.25rem',
                  paddingLeft: '0',
                  paddingRight: '0',
                  paddingTop: '0.125rem',
                  paddingBottom: '0.125rem',
                }}
              >
                <span className={prefixClass}>@</span>
                <span className={prefixClass}>
                  {searchQuery.slice(1)}
                </span>
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={searchQuery || ''}
              onChange={(e) => {
                const newValue = e.target.value;
                setSearchQuery(newValue);
                if (newValue.trim().startsWith('@')) {
                  setShowSuggestions(true);
                }
              }}
              onFocus={() => {
                // Activate search mode when input is focused
                if (window.location.hash !== '#search') {
                  // Use window.history for immediate hash update without page refresh
                  const newUrl = `${pathname}${window.location.search}#search`;
                  window.history.pushState({}, '', newUrl);
                  // Manually trigger hashchange event for immediate update
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }
                
                if (suggestions.length > 0 || searchQuery.trim().startsWith('@')) {
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
                } else if (e.key === 'Escape') {
                  // Exit search mode on Escape if input is empty
                  if (!searchQuery.trim() && window.location.hash === '#search') {
                    e.preventDefault();
                    // Use window.history for immediate hash removal without page refresh
                    const newUrl = pathname + window.location.search;
                    window.history.pushState({}, '', newUrl);
                    // Manually trigger hashchange event for immediate update
                    window.dispatchEvent(new HashChangeEvent('hashchange'));
                    setShowSuggestions(false);
                    inputRef.current?.blur();
                  }
                }
              }}
              placeholder={placeholderText}
              className={`w-full bg-transparent border-0 outline-none text-sm py-0.5 ${inputTextClass} ${
                searchQuery && searchQuery.startsWith('@') ? 'text-transparent' : ''
              }`}
              style={searchQuery && searchQuery.startsWith('@') ? { 
                color: 'transparent',
                caretColor
              } : undefined}
            />
          </div>
          
          {/* Suggestions Dropdown */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => {
                  const isAccount = 'type' in suggestion && suggestion.type === 'account';
                  const isPeople = 'type' in suggestion && suggestion.type === 'people';
                  const account = isAccount ? (suggestion as AccountSuggestion) : null;
                  const person = isPeople ? (suggestion as PeopleSuggestion) : null;
                  const feature = !isAccount && !isPeople ? (suggestion as MapboxFeature) : null;
                  
                  const uniqueKey = `${suggestion.id || 'unknown'}-${index}-${isAccount ? 'account' : isPeople ? 'people' : 'mapbox'}`;
                  
                  return (
                    <button
                      key={uniqueKey}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                        index === selectedIndex ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isAccount ? (
                          <>
                            <ProfilePhoto 
                              account={account! as unknown as Account} 
                              size="xs" 
                              editable={false} 
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-900 truncate">
                                  @{account!.username}
                                </span>
                                {(account!.plan === 'contributor' || account!.plan === 'plus') && (
                                  <span className="text-[10px] font-semibold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200 flex-shrink-0">
                                    Contributor
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {account!.first_name || account!.last_name 
                                  ? `${account!.first_name || ''} ${account!.last_name || ''}`.trim()
                                  : 'Account'}
                              </div>
                            </div>
                          </>
                        ) : isPeople ? (
                          <>
                            <UserIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {person!.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                Person
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
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
                })
              ) : showNoAccountResults && isAccountSearch ? (
                <div className="px-3 py-3">
                  <p className="text-xs text-gray-600">
                    Can't find user with that username.
                  </p>
                </div>
              ) : isAccountSearch && isSearching ? (
                <div className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin" />
                    <p className="text-xs text-gray-600">Searching...</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
