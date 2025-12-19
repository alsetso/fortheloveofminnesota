import { useRef, useState, useCallback, useEffect } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxFeature, MapboxSuggestion } from '@/types/mapbox-events';

export interface UsePostMapBaseReturn {
  mapContainer: React.RefObject<HTMLDivElement | null>;
  map: React.MutableRefObject<import('mapbox-gl').Map | null>;
  mapLoaded: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  suggestions: MapboxFeature[];
  showSuggestions: boolean;
  setShowSuggestions: (show: boolean) => void;
  isSearching: boolean;
  searchLocations: (query: string) => Promise<void>;
  handleSuggestionSelect: (suggestion: MapboxSuggestion) => void;
}

export function usePostMapBase(isOpen: boolean): UsePostMapBaseReturn {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import('mapbox-gl').Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Search for locations
  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
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

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&country=us&bbox=${MAP_CONFIG.MINNESOTA_BOUNDS.west},${MAP_CONFIG.MINNESOTA_BOUNDS.south},${MAP_CONFIG.MINNESOTA_BOUNDS.east},${MAP_CONFIG.MINNESOTA_BOUNDS.north}&limit=5`
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching locations:', error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle suggestion select
  const handleSuggestionSelect = useCallback((suggestion: MapboxSuggestion) => {
    const [lng, lat] = suggestion.center;
    setSearchQuery(suggestion.place_name);
    setShowSuggestions(false);
    setSuggestions([]);

    if (!map.current) return;

    // Fly to location
    map.current.flyTo({
      center: [lng, lat],
      zoom: 15,
      duration: 1000,
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainer.current || map.current) return;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    const initMap = async () => {
      try {
        // @ts-ignore - CSS import
      await import('mapbox-gl/dist/mapbox-gl.css');

        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current) return;

        const container = mapContainer.current;
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          console.warn('Map container has no dimensions, waiting...');
          setTimeout(() => {
            if (container && !map.current) {
              initMap();
            }
          }, 100);
          return;
        }

        const mapInstance = new mapbox.Map({
          container: container,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstance.on('load', () => {
          setTimeout(() => {
            if (mapInstance && !(mapInstance as any)._removed) {
              mapInstance.resize();
            }
          }, 100);
          setMapLoaded(true);
        });

        map.current = mapInstance;
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setMapLoaded(false);
    };
  }, [isOpen]);

  return {
    mapContainer,
    map,
    mapLoaded,
    searchQuery,
    setSearchQuery,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    isSearching,
    searchLocations,
    handleSuggestionSelect,
  };
}


