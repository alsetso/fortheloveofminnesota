'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MicrophoneIcon, MagnifyingGlassIcon, MapPinIcon, NewspaperIcon, Squares2X2Icon, UserIcon, ChevronDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToast } from '@/features/ui/hooks/useToast';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMetadata } from '@/types/mapbox';
import LiveAccountModal from './LiveAccountModal';
import MapStylesPopup from './MapStylesPopup';
import DynamicSearchModal from './DynamicSearchModal';
import NewsStream from './NewsStream';
import { PWAStatusIcon } from '@/components/pwa/PWAStatusIcon';

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

interface PeopleSuggestion {
  id: string;
  name: string;
  type: 'people';
}

type SearchSuggestion = MapboxFeature | NewsArticleSuggestion | PeopleSuggestion;

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
  buildingsState?: {
    showBuildings: boolean;
    setShowBuildings: (show: boolean) => void;
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

export default function MapTopContainer({ map, onLocationSelect, modalState, districtsState, buildingsState, ctuState, stateBoundaryState, countyBoundariesState, hideMicrophone = false, showWelcomeText = false }: MapTopContainerProps) {
  const router = useRouter();
  const { account } = useAuthStateSafe();
  const { openAccount, openUpgrade, openWelcome } = useAppModalContextSafe();
  const { info, pro: proToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | 'all'>('7d');
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    // Initialize from window state if available
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  
  // Use white text when transparent blur + satellite map
  const useWhiteText = useBlurStyle && currentMapStyle === 'satellite';
  const [mentionsLayerHidden, setMentionsLayerHidden] = useState(false);
  const [placeholderWord, setPlaceholderWord] = useState<'News' | 'Addresses' | 'People'>('News');
  const [dynamicSearchData, setDynamicSearchData] = useState<any>(null);
  const [dynamicSearchType, setDynamicSearchType] = useState<'news' | 'people'>('news');
  
  // Use modal state from parent if provided
  const isAccountModalOpen = modalState?.isAccountModalOpen ?? false;
  const showMapStylesPopup = modalState ? false : false; // Will be checked via modalState.isModalOpen('mapStyles')
  const showDynamicSearchModal = modalState ? false : false; // Will be checked via modalState.isModalOpen('dynamicSearch')
  const recognitionRef = useRef<SpeechRecognition | null>(null);
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

  // Listen for blur style and map style changes
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

    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
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
      
      // Search in parallel: Mapbox geocoding, News articles, and People
      const [mapboxResults, newsResults, peopleResults] = await Promise.allSettled([
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
      const newsArticles = newsResults.status === 'fulfilled' ? newsResults.value : [];
      const people = peopleResults.status === 'fulfilled' ? peopleResults.value : [];
      
      // Combine results: addresses first, then news articles, then people
      const combined = [...mapboxFeatures, ...newsArticles, ...people];
      
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
      setPlaceholderWord(prev => {
        if (prev === 'News') return 'Addresses';
        if (prev === 'Addresses') return 'People';
        return 'News';
      });
    }, 3000); // Rotate every 3 seconds

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
    
    // Handle news article - show modal with raw data
    if ('type' in suggestion && suggestion.type === 'news') {
      const article = suggestion as NewsArticleSuggestion;
      setSearchQuery(article.title);
      setDynamicSearchData(article);
      setDynamicSearchType('news');
      if (modalState) {
        modalState.openDynamicSearch(article, 'news');
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

  // Close suggestions and time dropdown when clicking outside
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

  const handleLogoClick = useCallback(() => {
    if (typeof window !== 'undefined') {
      const referrer = document.referrer;
      // Check if referrer exists and is from the same origin
      if (referrer && referrer.startsWith(window.location.origin)) {
        // Extract the path from the referrer URL
        const referrerPath = new URL(referrer).pathname;
        // Only navigate back if it's not the same page
        if (referrerPath !== window.location.pathname) {
          router.push(referrerPath);
          return;
        }
      }
      // Fallback: use browser back or go to home
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    }
  }, [router]);

  return (
    <div className="fixed top-3 left-3 right-3 z-[45] pointer-events-none">
      <div ref={containerRef} className="pointer-events-auto space-y-1.5 relative">
        {/* News Stream - Positioned in upper right below search input */}
        <NewsStream useBlurStyle={useBlurStyle} maxItems={5} />
        {/* Search Bar */}
        <div 
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
              placeholder={`Search ${placeholderWord}`}
              className={`flex-1 bg-transparent border-0 outline-none text-sm py-0.5 ${
                useWhiteText 
                  ? 'text-white placeholder:text-white/50' 
                  : 'text-gray-900 placeholder:text-gray-500'
              }`}
            />
            {useBlurStyle && (
              <ChevronDownIcon className={`w-5 h-5 flex-shrink-0 ${useWhiteText ? 'text-white/70' : 'text-gray-400'}`} />
            )}
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-50">
                {suggestions.map((suggestion, index) => {
                  const isNews = 'type' in suggestion && suggestion.type === 'news';
                  const isPeople = 'type' in suggestion && suggestion.type === 'people';
                  const article = isNews ? (suggestion as NewsArticleSuggestion) : null;
                  const person = isPeople ? (suggestion as PeopleSuggestion) : null;
                  const feature = !isNews && !isPeople ? (suggestion as MapboxFeature) : null;
                  
                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                        index === selectedIndex ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isNews ? (
                          <>
                            <NewspaperIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {article!.title}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {article!.source_name || 'News Article'}
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
                })}
              </div>
            )}
          </div>

          {/* Microphone Icon */}
          {!hideMicrophone && (
          <button
            onClick={handleVoiceSearch}
            disabled={!isSupported}
            className={`flex-shrink-0 p-1.5 transition-colors flex items-center justify-center ${
              isRecording
                ? 'text-red-500 animate-pulse'
                : isSupported
                ? useWhiteText ? 'text-white/70 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                : useWhiteText ? 'text-white/30 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start voice search'}
            title={isSupported ? (isRecording ? 'Stop recording' : 'Start voice search') : 'Voice search not supported'}
          >
            <MicrophoneIcon className="w-5 h-5" />
          </button>
          )}

          {/* PWA Status Icon */}
          <div className="flex items-center justify-center">
            <PWAStatusIcon 
              variant={useWhiteText ? 'dark' : 'light'} 
              size="sm"
              showLabel={false}
            />
          </div>

          {/* Profile Icon */}
          {account ? (
            <button
              onClick={() => {
                // Use global modal context to open LiveAccountModal
                openAccount('settings');
                // Also use local modalState if available (for live page)
                if (modalState) {
                  modalState.openAccount();
                }
                  // Dispatch event to hide mobile nav
                  window.dispatchEvent(new CustomEvent('live-account-modal-change', {
                    detail: { isOpen: true }
                  }));
              }}
              className={`flex-shrink-0 w-11 h-11 rounded-full overflow-hidden transition-colors flex items-center justify-center ${
                (account.plan === 'pro' || account.plan === 'plus')
                  ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
                  : 'border border-gray-200 hover:border-gray-300'
              }`}
              aria-label="Account"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center">
                {account.image_url ? (
                  <Image
                    src={account.image_url}
                    alt={account.username || 'Account'}
                    width={40}
                    height={40}
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
              </div>
            </button>
          ) : (
            <button
              onClick={() => {
                openWelcome();
                  // Dispatch event to hide mobile nav
                  window.dispatchEvent(new CustomEvent('live-account-modal-change', {
                    detail: { isOpen: true }
                  }));
              }}
              className={`flex-shrink-0 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap flex items-center justify-center ${
                useBlurStyle
                  ? 'bg-white/90 backdrop-blur-sm border border-gray-300 text-gray-900 hover:bg-white'
                  : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
              }`}
              aria-label="Sign In"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Bottom Row: Reload Mentions or Map Settings on left */}
        <div className="flex items-start justify-between gap-1.5">
        {/* Reload Mentions or Map Settings Container */}
        <div className="flex items-center gap-1.5">
          {/* Reload Mentions Button or Map Settings Button */}
          {mentionsLayerHidden ? (
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
          ) : (
            <button
              onClick={() => {
                if (modalState) {
                  modalState.openMapStyles();
                }
              }}
              className={`rounded-md px-2 py-1.5 transition-colors flex items-center justify-center shadow-lg bg-white hover:bg-gray-50 border border-gray-200`}
              aria-label="Map Layers"
            >
              <Squares2X2Icon className="w-5 h-5 text-gray-600" />
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Live Account Modal */}
      {modalState && (
        <LiveAccountModal
          isOpen={isAccountModalOpen}
          onClose={() => {
            modalState.closeAccount();
            // Dispatch event to show mobile nav
            window.dispatchEvent(new CustomEvent('live-account-modal-change', {
              detail: { isOpen: false }
            }));
          }}
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
          onUpgrade={(feature?: string) => openUpgrade(feature)}
          onProToast={(feature?: string) => proToast(feature || '')}
          districtsState={districtsState}
          buildingsState={buildingsState}
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

