import { useEffect, useRef, useState } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';

interface UseMapboxMapOptions {
  mapStyle: 'street' | 'satellite' | 'light' | 'dark';
  containerRef: React.RefObject<HTMLDivElement>;
  meta?: {
    buildingsEnabled?: boolean;
    pitch?: number;
    terrainEnabled?: boolean;
    center?: [number, number];
    zoom?: number;
  } | null;
  onMapLoad?: (map: MapboxMapInstance) => void;
}

export function useMapboxMap({ mapStyle, containerRef, meta, onMapLoad }: UseMapboxMapOptions) {
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const hasInitializedRef = useRef(false);
  const mapLoadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || hasInitializedRef.current) return;

    let mounted = true;
    let initTimeoutId: NodeJS.Timeout | null = null;
    let loadTimeoutId: NodeJS.Timeout | null = null;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      console.error('Mapbox token missing');
      return;
    }

    const initMap = async () => {
      if (!mounted || !containerRef.current || mapInstanceRef.current) return;

      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!containerRef.current || !mounted || mapInstanceRef.current) return;

        // Wait for container to have proper dimensions
        const container = containerRef.current;
        const waitForContainer = (): Promise<void> => {
          return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // ~5 seconds
            
            const checkDimensions = () => {
              if (!mounted || !container) {
                resolve();
                return;
              }
              
              if (container.offsetWidth > 0 && container.offsetHeight > 0) {
                resolve();
              } else if (attempts < maxAttempts) {
                attempts++;
                requestAnimationFrame(checkDimensions);
              } else {
                // Timeout - proceed anyway
                resolve();
              }
            };
            requestAnimationFrame(checkDimensions);
          });
        };

        await waitForContainer();

        if (!containerRef.current || !mounted || mapInstanceRef.current) return;

        // Determine map style
        const getStyleUrl = () => {
          switch (mapStyle) {
            case 'satellite':
              return MAP_CONFIG.STRATEGIC_STYLES.satellite;
            case 'light':
              return MAP_CONFIG.STRATEGIC_STYLES.light;
            case 'dark':
              return MAP_CONFIG.STRATEGIC_STYLES.dark;
            default:
              return MAP_CONFIG.STRATEGIC_STYLES.streets;
          }
        };
        const style = getStyleUrl();

        const mapInstance = new mapbox.Map({
          container: containerRef.current,
          style,
          center: meta?.center || MAP_CONFIG.DEFAULT_CENTER,
          zoom: meta?.zoom ?? MAP_CONFIG.DEFAULT_ZOOM,
          pitch: meta?.pitch ?? 0,
          bearing: 0,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;
        hasInitializedRef.current = true;

        mapInstance.on('load', () => {
          if (mounted) {
            if (loadTimeoutId) {
              clearTimeout(loadTimeoutId);
            }
            setTimeout(() => {
              if (mapInstance && !(mapInstance as MapboxMapInstance)._removed) {
                mapInstance.resize();
              }
            }, 100);
            mapLoadedRef.current = true;
            setMapLoaded(true);
            if (onMapLoad) {
              onMapLoad(mapInstance as MapboxMapInstance);
            }
          }
        });

        mapInstance.on('error', (e) => {
          console.error('Mapbox error:', e);
          if (mounted) {
            mapLoadedRef.current = true;
            setMapLoaded(true); // Hide loading overlay even on error
          }
        });

        // Fallback: hide loading after 5 seconds max
        loadTimeoutId = setTimeout(() => {
          if (mounted && !mapLoadedRef.current) {
            console.warn('Map load timeout, hiding loading overlay');
            mapLoadedRef.current = true;
            setMapLoaded(true);
          }
        }, 5000);
      } catch (err) {
        console.error('Failed to initialize map:', err);
        if (mounted) {
          setMapLoaded(true); // Hide loading overlay on error
        }
      }
    };

    // Small delay to ensure DOM is ready
    initTimeoutId = setTimeout(() => {
      initMap();
    }, 50);

    return () => {
      mounted = false;
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
      }
      if (loadTimeoutId) {
        clearTimeout(loadTimeoutId);
      }
      if (mapInstanceRef.current) {
        const mapboxMap = mapInstanceRef.current as any;
        try {
          if (!mapInstanceRef.current.removed) {
            mapInstanceRef.current.remove();
          }
        } catch {
          // Ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
      hasInitializedRef.current = false;
      mapLoadedRef.current = false;
      setMapLoaded(false);
    };
  }, [mapStyle, containerRef, meta, onMapLoad]);

  return {
    mapInstance: mapInstanceRef.current,
    mapLoaded,
  };
}

