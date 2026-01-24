'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, MapPinIcon, UserIcon, ChevronDownIcon, ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon, XCircleIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToast } from '@/features/ui/hooks/useToast';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMetadata } from '@/types/mapbox';
import MapStylesPopup from './MapStylesPopup';
import DynamicSearchModal from './DynamicSearchModal';
import DailyWelcomeModal from './DailyWelcomeModal';
import { useLocation } from '@/features/map/hooks/useLocation';
import { useIOSStandalone } from '@/hooks/useIOSStandalone';
import { supabase } from '@/lib/supabase';
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

interface MapTopContainerProps {
  map?: any;
  onLocationSelect?: (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: MapboxMetadata) => void;
  isLoadingMentions?: boolean;
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
  districtsState?: {
    showDistricts: boolean;
    setShowDistricts: (show: boolean) => void;
  };
  ctuState?: {
    showCTU: boolean;
    setShowCTU: (show: boolean) => void;
  };
  stateBoundaryState?: {
    showStateBoundary: boolean;
    setShowStateBoundary: (show: boolean) => void;
  };
  countyBoundariesState?: {
    showCountyBoundaries: boolean;
    setShowCountyBoundaries: (show: boolean) => void;
  };
  hideMicrophone?: boolean;
  showWelcomeText?: boolean;
  showDailyWelcome?: boolean;
  onCloseDailyWelcome?: () => void;
  useBlurStyle?: boolean;
}

// Map meta layer definitions
// Note: Mapbox layers can be identified by layer.id OR layer['source-layer']
// Some layers use source-layer for the data type (e.g., 'landuse', 'building')
// Based on Mapbox Streets v8 layer structure and maki icon categories
const MAP_META_LAYERS = [
  // Core infrastructure
  { id: 'buildings', name: 'Buildings', icon: '🏢', layerPatterns: ['building'], sourceLayerPatterns: ['building'] },
  { id: 'roads', name: 'Roads', icon: '🛣️', layerPatterns: ['road', 'highway', 'bridge', 'tunnel'], sourceLayerPatterns: ['road', 'highway'] },
  { id: 'water', name: 'Water', icon: '💧', layerPatterns: ['water', 'waterway'], sourceLayerPatterns: ['water', 'waterway'] },
  { id: 'landuse', name: 'Land Use', icon: '🌳', layerPatterns: ['landuse', 'landcover'], sourceLayerPatterns: ['landuse', 'landcover'] },
  { id: 'places', name: 'Places', icon: '🏙️', layerPatterns: ['place', 'settlement'], sourceLayerPatterns: ['place'] },
  
  // POI categories (based on maki.md)
  { id: 'pois', name: 'POIs', icon: '📍', layerPatterns: ['poi'], sourceLayerPatterns: ['poi'] },
  { id: 'airports', name: 'Airports', icon: '✈️', layerPatterns: ['airport'], sourceLayerPatterns: ['airport'] },
  { id: 'natural', name: 'Natural', icon: '⛰️', layerPatterns: ['natural'], sourceLayerPatterns: ['natural'] },
  { id: 'transit', name: 'Transit', icon: '🚌', layerPatterns: ['transit'], sourceLayerPatterns: ['transit'] },
  
  // Specific POI subcategories (for more granular control)
  { id: 'restaurants', name: 'Restaurants', icon: '🍽️', layerPatterns: ['poi'], sourceLayerPatterns: ['poi'], makiPatterns: ['restaurant', 'cafe', 'bar', 'fast-food', 'restaurant-noodle', 'restaurant-pizza', 'restaurant-seafood', 'restaurant-bbq', 'bakery', 'ice-cream', 'confectionery'] },
  { id: 'shops', name: 'Shops', icon: '🛍️', layerPatterns: ['poi'], sourceLayerPatterns: ['poi'], makiPatterns: ['shop', 'grocery', 'supermarket', 'clothing-store', 'convenience', 'hardware', 'furniture', 'jewelry-store', 'shoe', 'watch', 'alcohol-shop'] },
  { id: 'entertainment', name: 'Entertainment', icon: '🎭', layerPatterns: ['poi'], sourceLayerPatterns: ['poi'], makiPatterns: ['cinema', 'theatre', 'museum', 'stadium', 'amusement-park', 'aquarium', 'zoo', 'casino', 'music', 'art-gallery', 'attraction'] },
  { id: 'sports', name: 'Sports', icon: '⚽', layerPatterns: ['poi'], sourceLayerPatterns: ['poi'], makiPatterns: ['pitch', 'swimming', 'tennis', 'basketball', 'american-football', 'volleyball', 'table-tennis', 'skateboard', 'horse-riding', 'golf', 'bowling-alley', 'fitness-centre'] },
  { id: 'services', name: 'Services', icon: '🔧', layerPatterns: ['poi'], sourceLayerPatterns: ['poi'], makiPatterns: ['bank', 'car', 'car-rental', 'car-repair', 'fuel', 'charging-station', 'laundry', 'pharmacy', 'dentist', 'doctor', 'veterinary', 'optician', 'mobile-phone', 'post', 'toilet', 'information'] },
];

export default function MapTopContainer({ map, onLocationSelect, isLoadingMentions = false, modalState, districtsState, ctuState, stateBoundaryState, countyBoundariesState, hideMicrophone = false, showWelcomeText = false, showDailyWelcome = false, onCloseDailyWelcome, useBlurStyle: propUseBlurStyle }: MapTopContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { account } = useAuthStateSafe();
  const { openAccount, openWelcome } = useAppModalContextSafe();
  const { info, pro: proToast } = useToast();
  const isIOSStandalone = useIOSStandalone();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | 'all'>('7d');
  // Initialize with consistent defaults to avoid hydration mismatch
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    // Use prop if provided (server/client consistent)
    if (propUseBlurStyle !== undefined) return propUseBlurStyle;
    // Always return false on server, will be updated in useEffect
    return false;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>('streets');
  
  // Update from window state after mount to avoid hydration mismatch
  useEffect(() => {
    if (propUseBlurStyle === undefined && typeof window !== 'undefined') {
      setUseBlurStyle((window as any).__useBlurStyle === true);
    }
    if (typeof window !== 'undefined') {
      const mapStyle = (window as any).__currentMapStyle || 'streets';
      setCurrentMapStyle(mapStyle);
    }
  }, [propUseBlurStyle]);
  
  // Use white text when transparent blur + satellite map
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  const [mentionsLayerHidden, setMentionsLayerHidden] = useState(false);
  const [selectedMentionTypes, setSelectedMentionTypes] = useState<Array<{ id: string; name: string; emoji: string; slug: string }>>([]);

  // Fetch selected mention types from URL parameters
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const typesParam = searchParams.get('types');
    
    const fetchSelectedTypes = async () => {
      if (typesParam) {
        // Multiple types - comma-separated slugs
        const slugs = typesParam.split(',').map(s => s.trim());
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const selected = slugs
            .map(slug => {
              const matchingType = allTypes.find(type => {
                const typeSlug = mentionTypeNameToSlug(type.name);
                return typeSlug === slug;
              });
              return matchingType ? { ...matchingType, slug } : null;
            })
            .filter(Boolean) as Array<{ id: string; name: string; emoji: string; slug: string }>;
          
          setSelectedMentionTypes(selected);
        } else {
          setSelectedMentionTypes([]);
        }
      } else if (typeParam) {
        // Single type
        const { data: allTypes } = await supabase
          .from('mention_types')
          .select('id, name, emoji')
          .eq('is_active', true);
        
        if (allTypes) {
          const matchingType = allTypes.find(type => {
            const typeSlug = mentionTypeNameToSlug(type.name);
            return typeSlug === typeParam;
          });
          
          if (matchingType) {
            setSelectedMentionTypes([{ ...matchingType, slug: typeParam }]);
          } else {
            setSelectedMentionTypes([]);
          }
        } else {
          setSelectedMentionTypes([]);
        }
      } else {
        setSelectedMentionTypes([]);
      }
    };

    fetchSelectedTypes();
  }, [searchParams, supabase]);

  // Remove a mention type filter
  const handleRemoveType = (slugToRemove: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const typeParam = params.get('type');
    const typesParam = params.get('types');
    
    if (typesParam) {
      // Remove from multiple types
      const slugs = typesParam.split(',').map(s => s.trim()).filter(s => s !== slugToRemove);
      if (slugs.length === 0) {
        params.delete('types');
      } else if (slugs.length === 1) {
        // Convert to single type parameter
        params.delete('types');
        params.set('type', slugs[0]);
      } else {
        params.set('types', slugs.join(','));
      }
    } else if (typeParam && typeParam === slugToRemove) {
      // Remove single type
      params.delete('type');
    }
    
    router.push(`/map/live?${params.toString()}`);
  };
  const [placeholderText, setPlaceholderText] = useState<'Enter address' | 'Enter "@" for username'>('Enter address');
  const [dynamicSearchData, setDynamicSearchData] = useState<any>(null);
  const [dynamicSearchType, setDynamicSearchType] = useState<'people'>('people');
  const [isAccountSearch, setIsAccountSearch] = useState(false);
  const [showNoAccountResults, setShowNoAccountResults] = useState(false);
  const [currentUserSearchVisibility, setCurrentUserSearchVisibility] = useState<boolean | null>(null);
  
  // User location dropdown state
  const { location, error, errorMessage, isLoading: isLocationLoading, isSupported: isLocationSupported, requestLocation, clearLocation, setManualLocation } = useLocation();
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Use modal state from parent if provided
  const isAccountModalOpen = modalState?.isAccountModalOpen ?? false;
  const showMapStylesPopup = modalState ? false : false; // Will be checked via modalState.isModalOpen('mapStyles')
  const showDynamicSearchModal = modalState ? false : false; // Will be checked via modalState.isModalOpen('dynamicSearch')
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const placeholderIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticUpdateRef = useRef(false);

  // Initialize time filter to 7d on mount
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mention-time-filter-change', {
      detail: { timeFilter: '7d' }
    }));
  }, []);

  // Listen for blur style, map style, and news visibility changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      const newValue = e.detail.useBlurStyle;
      setUseBlurStyle(newValue);
      // Store in window for session persistence
      if (typeof window !== 'undefined') {
        (window as any).__useBlurStyle = newValue;
      }
    };
    
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };

    const handleUpdateSearchInput = (e: CustomEvent) => {
      const query = e.detail?.query;
      if (query) {
        isProgrammaticUpdateRef.current = true;
        setSearchQuery(query);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    window.addEventListener('update-search-input', handleUpdateSearchInput as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
      window.removeEventListener('update-search-input', handleUpdateSearchInput as EventListener);
    };
  }, []);

  // Listen for address updates from map clicks
  useEffect(() => {
    const handleUpdateSearchAddress = (event: Event) => {
      const customEvent = event as CustomEvent<{ address: string; coordinates?: { lat: number; lng: number } }>;
      const address = customEvent.detail?.address;
      const coordinates = customEvent.detail?.coordinates;
      
      if (address) {
        // Mark as programmatic update to prevent search from running
        isProgrammaticUpdateRef.current = true;
        
        // Clear any pending search
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
          searchTimeoutRef.current = null;
        }
        
        // Clear suggestions and close dropdown
        setSuggestions([]);
        setShowSuggestions(false);
        setSearchQuery(address);
        
        // If coordinates are provided, treat it like a search selection - fly to location
        if (coordinates && map && map.flyTo) {
          map.flyTo({
            center: [coordinates.lng, coordinates.lat],
            zoom: 15,
            duration: 1500,
          });
          
          // Call onLocationSelect callback if provided
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

  // Listen for mentions layer hidden event
  useEffect(() => {
    const handleMentionsHidden = () => {
      setMentionsLayerHidden(true);
    };

    const handleMentionsReloaded = () => {
      setMentionsLayerHidden(false);
    };

    window.addEventListener('mentions-layer-hidden', handleMentionsHidden);
    window.addEventListener('mentions-reloaded', handleMentionsReloaded);

    return () => {
      window.removeEventListener('mentions-layer-hidden', handleMentionsHidden);
      window.removeEventListener('mentions-reloaded', handleMentionsReloaded);
    };
  }, []);

  // Listen for map click events to set manual location
  // Only update if dropdown is open and manual input is shown
  useEffect(() => {
    const handleMapLocationClick = (event: Event) => {
      const customEvent = event as CustomEvent<{
        lat: number;
        lng: number;
      }>;
      const { lat, lng } = customEvent.detail || {};
      if (lat && lng && showLocationDropdown && showManualInput) {
        // Set manual location when user clicks on map (if dropdown is open and manual input is shown)
        setManualLocation(lat, lng, 0);
        setShowManualInput(false);
        setShowLocationDropdown(false);
      }
    };

    window.addEventListener('map-location-click', handleMapLocationClick);
    return () => {
      window.removeEventListener('map-location-click', handleMapLocationClick);
    };
  }, [showLocationDropdown, showManualInput, setManualLocation]);

  // Reverse geocode location to address when location is set
  useEffect(() => {
    if (location && !isLocationLoading) {
      const reverseGeocode = async () => {
        try {
          const token = MAP_CONFIG.MAPBOX_TOKEN;
          if (token) {
            const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${location.longitude},${location.latitude}.json`;
            const params = new URLSearchParams({
              access_token: token,
              types: 'address',
              limit: '1',
            });
            
            const response = await fetch(`${url}?${params}`);
            if (response.ok) {
              const data = await response.json();
              if (data.features && data.features.length > 0) {
                const address = data.features[0].place_name || null;
                if (address) {
                  setSearchQuery(address);
                }
              }
            }
          }
        } catch (err) {
          console.debug('[MapTopContainer] Error reverse geocoding:', err);
        }
      };
      
      reverseGeocode();
    }
  }, [location, isLocationLoading]);

  // Handle reload mentions button click
  const handleReloadMentions = () => {
    window.dispatchEvent(new CustomEvent('reload-mentions'));
  };

  // Ensure all map meta layers are visible by default (no toggling)
  useEffect(() => {
    if (!map) return;
    
    const mapboxMap = map as any;
    const ensureLayersVisible = () => {
      try {
        const style = mapboxMap.getStyle();
        if (!style || !style.layers) return;
        
        // Make all map meta layers visible
        MAP_META_LAYERS.forEach(layerConfig => {
          const matchingLayers = style.layers.filter((layer: any) => {
            const layerIdLower = layer.id?.toLowerCase() || '';
            const sourceLayer = layer['source-layer']?.toLowerCase() || '';
            
            const matchesLayerId = layerConfig.layerPatterns.some(pattern => 
              layerIdLower.includes(pattern.toLowerCase())
            );
            const matchesSourceLayer = layerConfig.sourceLayerPatterns?.some(pattern =>
              sourceLayer.includes(pattern.toLowerCase())
            );
            
            let matchesMaki = false;
            if (layerConfig.makiPatterns && layerConfig.makiPatterns.length > 0) {
              matchesMaki = layerIdLower.includes('poi') || sourceLayer === 'poi';
            }
            
            return matchesLayerId || matchesSourceLayer || matchesMaki;
          });
          
          // Ensure all matching layers are visible
          matchingLayers.forEach((layer: any) => {
            try {
              mapboxMap.setLayoutProperty(layer.id, 'visibility', 'visible');
            } catch (e) {
              // Some layers might not have visibility property, try opacity
              try {
                const currentOpacity = mapboxMap.getPaintProperty(layer.id, layer.type === 'fill' ? 'fill-opacity' : 'fill-extrusion-opacity') || 1;
                if (currentOpacity === 0) {
                  mapboxMap.setPaintProperty(
                    layer.id, 
                    layer.type === 'fill' ? 'fill-opacity' : 'fill-extrusion-opacity',
                    1
                  );
                }
              } catch (e2) {
                // Ignore if we can't set it
              }
            }
          });
        });
      } catch (e) {
        console.debug('[MapTopContainer] Error ensuring layers visible:', e);
      }
    };
    
    if (mapboxMap.isStyleLoaded && mapboxMap.isStyleLoaded()) {
      ensureLayersVisible();
    } else {
      mapboxMap.once('style.load', ensureLayersVisible);
      mapboxMap.once('load', ensureLayersVisible);
    }
  }, [map]);


  // Combined search: Mapbox geocoding + Accounts (when @ is present)
  const searchLocations = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    const hasAtSymbol = trimmedQuery.startsWith('@');
    
    // If @ is present, only search accounts (even if just "@")
    if (hasAtSymbol) {
      setIsAccountSearch(true);
      
      // Check if user is authenticated - require login to search accounts
      if (!account) {
        setSuggestions([]);
        setShowSuggestions(false);
        setShowNoAccountResults(false);
        setIsSearching(false);
        // Open login modal
        openWelcome();
        return;
      }
      
      const usernameQuery = trimmedQuery.slice(1).trim().toLowerCase();
      
      setIsSearching(true);
      try {
        const { supabase } = await import('@/lib/supabase');
        
        // Check current user's search_visibility
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
        
        // Build query - only show accounts with search_visibility = true
        let accountsQuery = supabase
          .from('accounts')
          .select('id, username, first_name, last_name, image_url, plan')
          .eq('search_visibility', true)
          .not('username', 'is', null);
        
        if (usernameQuery.length > 0) {
          // Username must start with the query (case-insensitive)
          accountsQuery = accountsQuery.ilike('username', `${usernameQuery}%`);
        } else {
          // If just "@", show some accounts (ordered by view_count or created_at)
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
          // Always show dropdown with message when searching (even with just @)
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
    
    // Reset account search state for normal searches
    setIsAccountSearch(false);
    setShowNoAccountResults(false);

    // Normal search requires at least 2 characters
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {

      // Normal search: Mapbox geocoding and People
      const searchTerm = trimmedQuery.toLowerCase();
      
      const [mapboxResults, peopleResults] = await Promise.allSettled([
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
        // People search
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
      
      // Combine results: addresses first, then people
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
  }, []);

  // Rotating placeholder
  useEffect(() => {
    placeholderIntervalRef.current = setInterval(() => {
      setPlaceholderText((prev) => {
        if (prev === 'Enter address') return 'Enter "@" for username';
        return 'Enter address';
      });
    }, 3000);

    return () => {
      if (placeholderIntervalRef.current) {
        clearInterval(placeholderIntervalRef.current);
      }
    };
  }, []);

  // Debounced search
  useEffect(() => {
    // Skip search if this is a programmatic update (from map click)
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
      // For @ searches, search immediately with no delay (seamless typing)
      // Search starts with 1 letter after @
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchLocations(searchQuery);
    } else if (trimmedQuery.length >= 2) {
      // Normal search requires at least 2 characters with delay
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
    
    // Handle account - navigate to profile
    if ('type' in suggestion && suggestion.type === 'account') {
      const account = suggestion as AccountSuggestion;
      setSearchQuery(`@${account.username}`);
      // Navigate to profile
      if (account.username) {
        window.location.href = `/profile/${account.username}`;
      }
      return;
    }
    
    // Handle people - show modal with raw data
    if ('type' in suggestion && suggestion.type === 'people') {
      const person = suggestion as PeopleSuggestion;
      setSearchQuery(person.name);
      setDynamicSearchData(person);
      setDynamicSearchType('people');
      if (modalState) {
        modalState.openDynamicSearch(person, 'people');
      }
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

  // Close suggestions and location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setShowLocationDropdown(false);
        setShowManualInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleLogoClick = useCallback(() => {
    // Route-aware navigation:
    // - On /profile/* pages: go to /map/live
    // - On /live or /map/live page: go to / (homepage)
    if (pathname?.startsWith('/profile/')) {
      router.push('/map/live');
    } else if (pathname === '/live' || pathname === '/map/live') {
      router.push('/');
    } else {
      // Fallback: go to homepage
      router.push('/');
    }
  }, [router, pathname]);

  return (
    <div 
      className="fixed left-1/2 -translate-x-1/2 z-[45] pointer-events-none" 
      style={{ 
        maxWidth: '600px', 
        width: 'calc(100% - 2rem)',
        top: isIOSStandalone ? '23px' : '12px' // 3px (top-3) + 20px padding = 23px
      }}
    >
      <div ref={containerRef} className="pointer-events-auto space-y-1.5 relative">
        {/* Search Bar */}
        <div 
          data-search-container
          className={`rounded-xl shadow-lg px-2.5 py-2 flex items-center gap-1.5 relative transition-all ${
            useBlurStyle 
              ? 'bg-transparent backdrop-blur-md border-2 border-transparent' 
              : 'bg-white border border-gray-200'
          }`}
        >
          {/* Logo - Back Button */}
          <button
            onClick={handleLogoClick}
            className="flex-shrink-0 cursor-pointer p-1.5 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-center"
            aria-label="Go back"
            type="button"
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={20}
              height={20}
              className="w-6 h-6"
              unoptimized
            />
          </button>

          {/* Search Input */}
          <div className="flex-1 min-w-0 relative flex items-center gap-1.5">
            <div className="flex-1 relative">
              {/* Highlight overlay for @ mentions */}
              {searchQuery && searchQuery.startsWith('@') && (
                <div 
                  className="absolute inset-0 pointer-events-none flex items-center"
                  style={{ 
                    fontFamily: 'inherit',
                    fontSize: '0.875rem', // text-sm = 14px
                    lineHeight: '1.25rem', // text-sm line-height
                    paddingLeft: '0',
                    paddingRight: '0',
                    paddingTop: '0.125rem', // py-0.5 = 2px
                    paddingBottom: '0.125rem',
                  }}
                >
                  <span className={useWhiteText ? 'text-blue-300' : 'text-blue-600'}>@</span>
                  <span className={useWhiteText ? 'text-blue-300' : 'text-blue-600'}>
                    {searchQuery.slice(1)}
                  </span>
                </div>
              )}
              <input
                ref={inputRef}
                data-search-input
                type="text"
                value={searchQuery || ''}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setSearchQuery(newValue);
                  // Show suggestions immediately when @ is typed
                  if (newValue.trim().startsWith('@')) {
                    setShowSuggestions(true);
                  }
                }}
                onFocus={() => {
                  if (suggestions.length > 0 || searchQuery.trim().startsWith('@')) {
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
                placeholder={placeholderText}
                className={`w-full bg-transparent border-0 outline-none text-sm py-0.5 caret-gray-900 ${
                  useWhiteText 
                    ? 'text-white placeholder:text-white/50 caret-white' 
                    : 'text-gray-900 placeholder:text-gray-500'
                } ${searchQuery && searchQuery.startsWith('@') ? 'text-transparent caret-gray-900' : ''}`}
                style={searchQuery && searchQuery.startsWith('@') ? { 
                  color: 'transparent',
                  caretColor: useWhiteText ? 'white' : '#111827'
                } : undefined}
              />
            </div>
            {useBlurStyle && (
              <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 ${useWhiteText ? 'text-white/70' : 'text-gray-400'}`} />
            )}
            
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
                  
                  // Create unique key combining type, id, and index to prevent duplicates
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
                    {currentUserSearchVisibility === false && (
                      <button
                        onClick={() => {
                          if (modalState) {
                            modalState.openMapStyles();
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 underline mt-1 block"
                      >
                        Turn on search visibility in map settings
                      </button>
                    )}
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


          {/* User Location Icon */}
          <div className="relative flex-shrink-0">
            <button
              data-user-location-button
              onClick={() => {
                if (!showLocationDropdown) {
                  setShowLocationDropdown(true);
                  if (!location && !error) {
                    requestLocation();
                  }
                } else {
                  setShowLocationDropdown(false);
                }
              }}
              disabled={!isLocationSupported || isLocationLoading}
              className={`w-8 h-8 rounded-full transition-colors flex items-center justify-center ${
                useBlurStyle
                  ? 'bg-white/20 hover:bg-white/30 text-white/70 hover:text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label="Location"
            >
              <MapPinIcon className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showLocationDropdown && (
              <div className={`absolute top-full right-0 mt-1 rounded-md shadow-lg border z-50 min-w-[240px] ${
                useBlurStyle
                  ? 'bg-transparent backdrop-blur-md border-2 border-transparent'
                  : 'bg-white border-gray-200'
              }`}>
                <div className="p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <MapPinIcon className={`w-4 h-4 ${useWhiteText ? 'text-white' : 'text-gray-600'}`} />
                      <h3 className={`text-xs font-semibold ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>Location</h3>
                    </div>
                    <button
                      onClick={() => {
                        setShowLocationDropdown(false);
                        setShowManualInput(false);
                      }}
                      className={`w-5 h-5 flex items-center justify-center transition-colors rounded-md ${
                        useWhiteText
                          ? 'text-white/70 hover:text-white hover:bg-white/20'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                      aria-label="Close"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    {/* Loading state */}
                    {isLocationLoading && (
                      <div className="flex items-center gap-2 py-1">
                        <div className={`w-3 h-3 border-2 rounded-full animate-spin ${
                          useWhiteText ? 'border-white/30 border-t-white' : 'border-gray-300 border-t-gray-600'
                        }`} />
                        <p className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>Getting location...</p>
                      </div>
                    )}

                    {/* Success state */}
                    {location && !isLocationLoading && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-medium ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>
                              {location.source === 'gps' ? 'GPS Location' : 'Manual Location'}
                            </span>
                          </div>
                          <div className={`flex items-center gap-2 text-xs font-mono ${
                            useWhiteText ? 'text-white/80' : 'text-gray-600'
                          }`}>
                            <span>{location.latitude.toFixed(6)}</span>
                            <span className={useWhiteText ? 'text-white/50' : 'text-gray-400'}>,</span>
                            <span>{location.longitude.toFixed(6)}</span>
                          </div>
                          {location.accuracy > 0 && (
                            <p className={`text-xs ${useWhiteText ? 'text-white/60' : 'text-gray-500'}`}>
                              Accuracy: {Math.round(location.accuracy)}m
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (location && map && map.flyTo) {
                              const mapboxMap = map as any;
                              mapboxMap.flyTo({
                                center: [location.longitude, location.latitude],
                                zoom: Math.max(mapboxMap.getZoom(), 15),
                                duration: 1000,
                              });
                              if (onLocationSelect) {
                                onLocationSelect({ lat: location.latitude, lng: location.longitude }, 'Current Location');
                              }
                            }
                            setShowLocationDropdown(false);
                          }}
                          className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                            useBlurStyle
                              ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                              : 'bg-gray-900 hover:bg-gray-800 text-white'
                          }`}
                        >
                          Center Map
                        </button>
                      </div>
                    )}

                    {/* Error state */}
                    {error && !isLocationLoading && (
                      <div className="space-y-2">
                        <div className="flex items-start gap-1.5">
                          <ExclamationTriangleIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                            useWhiteText ? 'text-white/70' : 'text-gray-500'
                          }`} />
                          <div className="flex-1 space-y-1">
                            <p className={`text-xs font-medium ${useWhiteText ? 'text-white' : 'text-gray-900'}`}>{errorMessage}</p>
                            {error.type === 'permission_denied' && (
                              <p className={`text-xs ${useWhiteText ? 'text-white/70' : 'text-gray-500'}`}>
                                You can set location manually by clicking on the map.
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {error.type === 'permission_denied' && (
                          <button
                            onClick={() => setShowManualInput(true)}
                            className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                              useBlurStyle
                                ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                            }`}
                          >
                            Use Map Click
                          </button>
                        )}
                        
                        {error.type !== 'permission_denied' && (
                          <button
                            onClick={() => requestLocation()}
                            className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                              useBlurStyle
                                ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                                : 'bg-gray-900 hover:bg-gray-800 text-white'
                            }`}
                          >
                            Try Again
                          </button>
                        )}
                      </div>
                    )}

                    {/* Manual input instructions */}
                    {showManualInput && (
                      <div className="space-y-2">
                        <p className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>
                          Click anywhere on the map to set your location manually.
                        </p>
                        <button
                          onClick={() => {
                            setShowManualInput(false);
                            setShowLocationDropdown(false);
                          }}
                          className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors ${
                            useBlurStyle
                              ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30'
                              : 'bg-gray-900 hover:bg-gray-800 text-white'
                          }`}
                        >
                          Got It
                        </button>
                      </div>
                    )}

                    {/* Initial state (no location, no error, not loading) */}
                    {!location && !error && !isLocationLoading && (
                      <div className="space-y-2">
                        <p className={`text-xs ${useWhiteText ? 'text-white/80' : 'text-gray-600'}`}>
                          Get your current location or click on the map to set it manually.
                        </p>
                        <button
                          onClick={() => requestLocation()}
                          disabled={!isLocationSupported}
                          className={`w-full text-xs font-medium py-2 px-3 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            useBlurStyle
                              ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30 disabled:bg-white/10 disabled:hover:bg-white/10'
                              : 'bg-gray-900 hover:bg-gray-800 text-white disabled:bg-gray-300 disabled:hover:bg-gray-300'
                          }`}
                        >
                          Get My Location
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mentions Loading Toast - Below search container */}
        {isLoadingMentions && (
          <div className={`rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 transition-all h-5 ${
            useBlurStyle 
              ? 'bg-white/90 backdrop-blur-md border border-white/50' 
              : 'bg-white border border-gray-200'
          }`}>
            <div className="w-4 h-4 border-2 border-gray-400 border-t-gray-900 rounded-full animate-spin flex-shrink-0" />
            <span className="text-xs font-medium text-gray-900">Loading mentions...</span>
          </div>
        )}

        {/* Selected Mention Type Filters - Wrapped card labels */}
        {!isLoadingMentions && selectedMentionTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            {selectedMentionTypes.map((type) => (
              <div
                key={type.id}
                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-md text-xs border whitespace-nowrap ${
                  useWhiteText
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <span className="text-base flex-shrink-0">{type.emoji}</span>
                <span className="font-medium leading-none">{type.name}</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveType(type.slug);
                  }}
                  className={`hover:opacity-70 transition-opacity flex items-center justify-center flex-shrink-0 leading-none ml-0.5 ${
                    useWhiteText ? 'text-white' : 'text-gray-500'
                  }`}
                  aria-label={`Remove ${type.name} filter`}
                >
                  <XCircleIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Row: Reload Mentions or Map Settings on left */}
        <div className="flex items-start justify-between gap-1.5">
        {/* Reload Mentions or Map Settings Container */}
        <div className="flex items-center gap-1.5">
          {/* Reload Mentions Button */}
          {mentionsLayerHidden && currentMapStyle !== 'satellite' && (
            <button
              onClick={handleReloadMentions}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 border-2 border-red-500 ${
                useBlurStyle 
                  ? 'bg-transparent backdrop-blur-md hover:backdrop-blur-lg text-white hover:bg-red-500/20' 
                  : 'bg-white hover:bg-red-50 text-gray-900'
              }`}
            >
              <ArrowPathIcon className="w-4 h-4" />
              Reload mentions
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Daily Welcome Modal - positioned below search input, across from map settings */}
      {showDailyWelcome && onCloseDailyWelcome && (
        <DailyWelcomeModal
          isOpen={showDailyWelcome}
          onClose={onCloseDailyWelcome}
          useBlurStyle={useBlurStyle}
          showTextOnly={true}
        />
      )}

      {/* Map Styles Popup */}
      {modalState && (
        <MapStylesPopup
          isOpen={modalState.isModalOpen('mapStyles')}
          onClose={() => modalState.closeMapStyles()}
          map={map}
          timeFilter={timeFilter}
          onTimeFilterChange={(filter) => {
            setTimeFilter(filter);
          }}
          account={account}
          onUpgrade={() => router.push('/billing')}
          onProToast={(feature?: string) => proToast(feature || '')}
          districtsState={districtsState}
          ctuState={ctuState}
          stateBoundaryState={stateBoundaryState}
          countyBoundariesState={countyBoundariesState}
        />
      )}

      {/* Dynamic Search Modal */}
      {modalState && (
        <DynamicSearchModal
          isOpen={modalState.isModalOpen('dynamicSearch')}
          onClose={() => modalState.closeDynamicSearch()}
          data={dynamicSearchData}
          type={dynamicSearchType}
        />
      )}
    </div>
  );
}

