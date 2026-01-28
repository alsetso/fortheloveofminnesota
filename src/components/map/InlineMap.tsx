'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { MagnifyingGlassIcon, XMarkIcon, MapPinIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';

interface InlineMapProps {
  lat?: string;
  lng?: string;
  onLocationSelect: (lat: number, lng: number) => void;
  onOpenFullscreen?: () => void;
  fullscreen?: boolean;
  initialZoom?: number;
  hideMarker?: boolean;
  onZoomChange?: (zoom: number) => void;
}

export default function InlineMap({ 
  lat, 
  lng, 
  onLocationSelect,
  onOpenFullscreen,
  fullscreen = false,
  initialZoom,
  hideMarker = false,
  onZoomChange
}: InlineMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapboxMapInstance | null>(null);
  const markerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  
  // Address search state
  const [addressSearch, setAddressSearch] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Update marker position
  const updateMarker = useCallback(async (lng: number, lat: number) => {
    if (!mapInstance.current || !mapLoaded) return;

    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) return;

    // Remove existing marker
    if (markerRef.current) {
      try {
        markerRef.current.remove();
      } catch (err) {
        // Ignore
      }
      markerRef.current = null;
    }

    // Only create marker if not hidden
    if (!hideMarker) {
      // Create marker
      const el = document.createElement('div');
      el.style.cssText = 'width: 32px; height: 32px; cursor: pointer; pointer-events: none;';
      el.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EF4444"/>
          <circle cx="12" cy="9" r="3" fill="white"/>
        </svg>
      `;

      try {
        markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .addTo(mapInstance.current);
      } catch (err) {
        console.error('[InlineMap] Error creating marker:', err);
      }
    }

    // Always zoom to location
    const zoomLevel = initialZoom !== undefined ? initialZoom : MAP_CONFIG.ADDRESS_ZOOM;
    mapInstance.current.flyTo({
      center: [lng, lat],
      zoom: zoomLevel,
      duration: 500,
    });
    
    // Update zoom state
    setCurrentZoom(zoomLevel);
    if (onZoomChange) {
      onZoomChange(zoomLevel);
    }
  }, [mapLoaded, hideMarker, initialZoom, onZoomChange]);

  // Search addresses
  const searchAddresses = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const token = MAP_CONFIG.MAPBOX_TOKEN;
      if (!token) return;

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
      if (!response.ok) return;

      const data = await response.json();
      const filteredFeatures = (data.features || []).filter((feature: any) => {
        const context = feature.context || [];
        const stateContext = context.find((c: any) => c.id && c.id.startsWith('region.'));
        return stateContext && (
          stateContext.short_code === 'US-MN' ||
          stateContext.text === 'Minnesota'
        );
      });

      setAddressSuggestions(filteredFeatures);
      setShowSuggestions(filteredFeatures.length > 0);
    } catch (error) {
      console.error('[InlineMap] Address search error:', error);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced address search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (addressSearch) {
        searchAddresses(addressSearch);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [addressSearch, searchAddresses]);

  // Handle address selection
  const handleAddressSelect = useCallback((feature: any) => {
    const [lng, lat] = feature.center;
    setAddressSearch(feature.place_name);
    setShowSuggestions(false);
    onLocationSelect(lat, lng);
    updateMarker(lng, lat);
  }, [onLocationSelect, updateMarker]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapLoaded || mapInstance.current) return;

    let mounted = true;

    const initMap = async () => {
      if (!mounted || !mapContainer.current || mapInstance.current) return;

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapboxgl = await loadMapboxGL();
        
        if (!MAP_CONFIG.MAPBOX_TOKEN) {
          console.error('[InlineMap] Mapbox token not configured');
          return;
        }

        mapboxgl.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        // Wait for container dimensions - especially important for fullscreen
        const container = mapContainer.current;
        const waitForDimensions = (): Promise<void> => {
          return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 100; // More attempts for fullscreen
            
            const checkDimensions = () => {
              if (!mounted || !container) {
                resolve();
                return;
              }
              
              // For fullscreen, check viewport dimensions
              const width = fullscreen 
                ? window.innerWidth 
                : (container.offsetWidth || container.clientWidth || 0);
              const height = fullscreen 
                ? window.innerHeight 
                : (container.offsetHeight || container.clientHeight || 0);
              
              if (width > 0 && height > 0) {
                resolve();
              } else if (attempts < maxAttempts) {
                attempts++;
                requestAnimationFrame(checkDimensions);
              } else {
                resolve();
              }
            };
            requestAnimationFrame(checkDimensions);
          });
        };

        await waitForDimensions();
        // Additional delay for fullscreen to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, fullscreen ? 200 : 100));

        if (!mounted || !mapContainer.current) return;

        const zoomLevel = lat && lng 
          ? (initialZoom !== undefined ? initialZoom : MAP_CONFIG.ADDRESS_ZOOM)
          : MAP_CONFIG.DEFAULT_ZOOM;
        
        const map = new mapboxgl.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: lat && lng ? [parseFloat(lng), parseFloat(lat)] : MAP_CONFIG.DEFAULT_CENTER,
          zoom: zoomLevel,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        }) as MapboxMapInstance;

        if (!mounted) {
          map.remove();
          return;
        }

        mapInstance.current = map;
        (window as any).mapboxgl = mapboxgl;

        // Immediate resize
        setTimeout(() => {
          if (map && !(map as any)._removed) {
            try {
              map.resize();
            } catch (err) {
              // Ignore
            }
          }
        }, 50);

        map.on('load', () => {
          if (mounted) {
            setTimeout(() => {
              if (map && !(map as any)._removed) {
                try {
                  map.resize();
                } catch (err) {
                  // Ignore
                }
              }
            }, 100);
            
            setMapLoaded(true);
            
            // Get initial zoom
            const initialZoomLevel = typeof map.getZoom === 'function' ? map.getZoom() : null;
            if (initialZoomLevel !== null) {
              setCurrentZoom(initialZoomLevel);
              if (onZoomChange) {
                onZoomChange(initialZoomLevel);
              }
            }
            
            if (lat && lng) {
              const latNum = parseFloat(lat);
              const lngNum = parseFloat(lng);
              if (!isNaN(latNum) && !isNaN(lngNum)) {
                updateMarker(lngNum, latNum);
              }
            }
          }
        });
        
        // Track zoom changes
        map.on('zoom', () => {
          if (mounted && map && !(map as any)._removed) {
            try {
              const zoom = typeof map.getZoom === 'function' ? map.getZoom() : null;
              if (zoom !== null) {
                setCurrentZoom(zoom);
                if (onZoomChange) {
                  onZoomChange(zoom);
                }
              }
            } catch (err) {
              // Ignore
            }
          }
        });
        
        map.on('zoomend', () => {
          if (mounted && map && !(map as any)._removed) {
            try {
              const zoom = typeof map.getZoom === 'function' ? map.getZoom() : null;
              if (zoom !== null) {
                setCurrentZoom(zoom);
                if (onZoomChange) {
                  onZoomChange(zoom);
                }
              }
            } catch (err) {
              // Ignore
            }
          }
        });

        map.on('style.load', () => {
          if (mounted) {
            setTimeout(() => {
              if (map && !(map as any)._removed) {
                try {
                  map.resize();
                } catch (err) {
                  // Ignore
                }
              }
            }, 100);
          }
        });

        map.on('error', (e: unknown) => {
          console.error('[InlineMap] Map error:', e);
        });

        map.on('click', (e: any) => {
          if (!mounted) return;
          try {
            const { lng: clickedLng, lat: clickedLat } = e.lngLat;
            onLocationSelect(clickedLat, clickedLng);
            updateMarker(clickedLng, clickedLat);
          } catch (err) {
            console.error('[InlineMap] Error handling map click:', err);
          }
        });
      } catch (err) {
        console.error('[InlineMap] Failed to initialize map:', err);
      }
    };

    initMap();

    return () => {
      mounted = false;
      if (markerRef.current) {
        try {
          markerRef.current.remove();
        } catch (err) {
          // Ignore
        }
        markerRef.current = null;
      }
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
        } catch (err) {
          // Ignore
        }
        mapInstance.current = null;
        setMapLoaded(false);
      }
    };
  }, [fullscreen, initialZoom]);

  // Update marker when coordinates change externally
  useEffect(() => {
    if (mapLoaded && lat && lng && mapInstance.current) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        updateMarker(lngNum, latNum);
      }
    }
  }, [lat, lng, mapLoaded, updateMarker]);

  // Handle map resize
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current || !mapContainer.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstance.current && !(mapInstance.current as any)._removed) {
        setTimeout(() => {
          if (mapInstance.current && !(mapInstance.current as any)._removed) {
            try {
              mapInstance.current.resize();
            } catch (err) {
              // Ignore
            }
          }
        }, 100);
      }
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapLoaded]);


  return (
    <div 
      className="relative w-full h-full rounded-md border border-gray-200 overflow-hidden"
      style={fullscreen ? { width: '100vw', height: '100vh' } : undefined}
    >
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      {/* Floating Address Search - Top Left */}
      <div className="absolute top-2 left-2 z-20 max-w-[200px]">
        <div className="relative address-search-container">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
            onFocus={() => setShowSuggestions(addressSuggestions.length > 0)}
            placeholder="Search address"
            className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
          />
          {addressSearch && (
            <button
              type="button"
              onClick={() => {
                setAddressSearch('');
                setShowSuggestions(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          
          {/* Suggestions Dropdown */}
          {showSuggestions && addressSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-30">
              {addressSuggestions.map((feature, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAddressSelect(feature)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{feature.place_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Open Map Button */}
      {onOpenFullscreen && (
        <button
          type="button"
          onClick={onOpenFullscreen}
          className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ArrowsPointingOutIcon className="w-4 h-4 text-gray-600" />
          <span className="text-gray-900">Open Map</span>
        </button>
      )}
    </div>
  );
}
