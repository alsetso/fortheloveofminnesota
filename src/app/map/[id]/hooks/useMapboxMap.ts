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
  /** Called when GeolocateControl is added to the map */
  onGeolocateControlReady?: (control: any) => void;
  /** When false, omit maxBounds and allow minZoom 0 (e.g. /maps). Default true. */
  restrictToMinnesota?: boolean;
}

export function useMapboxMap({ mapStyle, containerRef, meta, onMapLoad, onGeolocateControlReady, restrictToMinnesota = true }: UseMapboxMapOptions) {
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

        const center = meta?.center || MAP_CONFIG.DEFAULT_CENTER;
        const zoom = meta?.zoom ?? (restrictToMinnesota ? MAP_CONFIG.DEFAULT_ZOOM : 7);
        const pitch = restrictToMinnesota ? (meta?.pitch ?? 60) : (meta?.pitch ?? 0);

        // Always constrain to Minnesota region; tight bounds for restricted, padded for unrestricted
        const bounds = restrictToMinnesota
          ? MAP_CONFIG.MINNESOTA_BOUNDS
          : MAP_CONFIG.MINNESOTA_VIEWPORT_BOUNDS;

        const mapInstance = new mapbox.Map({
          container: containerRef.current,
          style,
          center,
          zoom,
          pitch,
          bearing: 0,
          minZoom: MAP_CONFIG.MIN_ZOOM_MN,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;
        hasInitializedRef.current = true;

        mapInstance.on('load', () => {
          if (mounted) {
            if (loadTimeoutId) {
              clearTimeout(loadTimeoutId);
            }
            
            // Add default Mapbox controls (NavigationControl and GeolocateControl)
            // Add navigation controls (zoom, compass)
            const navControl = new mapbox.NavigationControl({
              showCompass: true,
              showZoom: true,
              visualizePitch: true,
            });
            mapInstance.addControl(navControl, 'top-right');

            // Add geolocate control
            const geolocateControl = new mapbox.GeolocateControl({
              positionOptions: {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 1000,
              },
              trackUserLocation: true,
              showUserHeading: true,
              showAccuracyCircle: true,
              fitBoundsOptions: { maxZoom: 15 },
            });
            mapInstance.addControl(geolocateControl, 'top-right');
            
            // Notify parent that geolocate control is ready
            if (onGeolocateControlReady) {
              onGeolocateControlReady(geolocateControl);
            }
            
            // Use double rAF so resize runs after layout; then mark loaded (faster than fixed 100ms)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (mounted && mapInstance && !(mapInstance as MapboxMapInstance)._removed) {
                  mapInstance.resize();
                }
                if (mounted) {
                  mapLoadedRef.current = true;
                  setMapLoaded(true);
                  if (onMapLoad) {
                    onMapLoad(mapInstance as MapboxMapInstance);
                  }
                }
              });
            });
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
  }, [mapStyle, containerRef, meta, onMapLoad, onGeolocateControlReady, restrictToMinnesota]);

  return {
    mapInstance: mapInstanceRef.current,
    mapLoaded,
  };
}

