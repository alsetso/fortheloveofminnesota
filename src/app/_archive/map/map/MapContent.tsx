'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SimplePageLayout from '@/components/SimplePageLayout';
import MapToolbar from '@/components/_archive/map/MapToolbar';
import PinsLayer from '@/components/_archive/map/PinsLayer';
import CreatePinModal from '@/components/_archive/map/CreatePinModal';
import CreateMapModal from '@/components/_archive/map/CreateMapModal';
import UserPinsList from '@/components/_archive/map/UserPinsList';
import { useAuth } from '@/features/auth';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import type { MapboxMapInstance, MapboxMouseEvent } from '@/types/mapbox-events';

export default function MapContent() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentMapStyle, setCurrentMapStyle] = useState('streets');
  const [is3DMode, setIs3DMode] = useState(false);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const clickZoomLevelRef = useRef<number | null>(null);
  const lastClickLocationRef = useRef<{ lng: number; lat: number } | null>(null);
  const isProgrammaticZoomRef = useRef<boolean>(false);
  const temporaryMarkerRef = useRef<any>(null); // Mapbox Marker instance
  const { user } = useAuth();
  const [createPinCoordinates, setCreatePinCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isCreatePinModalOpen, setIsCreatePinModalOpen] = useState(false);
  const [pinsRefreshKey, setPinsRefreshKey] = useState(0);
  
  // Handle create-new-map query parameter
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isCreateMapModalOpen, setIsCreateMapModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainer.current) return;

    let mounted = true;

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      setMapError('missing-token');
      return;
    }

    const initMap = async () => {
      if (!mounted || !mapContainer.current) return;

      try {
        // Import CSS first
        await import('mapbox-gl/dist/mapbox-gl.css');
        
        // Load Mapbox GL from npm package
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current || !mounted) return;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
          }
        });

        mapInstance.on('error', (e: unknown) => {
          // Extract meaningful error information
          const errorMessage = e instanceof Error 
            ? e.message 
            : typeof e === 'object' && e !== null && 'error' in e
            ? String((e as any).error)
            : typeof e === 'string'
            ? e
            : 'Unknown map error';
          
          // Suppress expected errors during style transitions
          // These occur when layers are temporarily removed during style changes
          const isLayerQueryError = errorMessage.includes("does not exist in the map's style and cannot be queried");
          const isStyleTransitionError = errorMessage.includes("does not exist in the map's style");
          
          if (isLayerQueryError || isStyleTransitionError) {
            // This is expected during style transitions - PinsLayer will re-add layers
            if (process.env.NODE_ENV === 'development') {
              console.debug('[MapContent] Suppressed expected layer query error during style transition');
            }
            return; // Don't treat this as a fatal error
          }
          
          // Log other errors
          console.error('[MapContent] Map error:', errorMessage, e);
          if (mounted) {
            setMapError('load-error');
          }
        });

        // Reset incremental zoom when user manually zooms or pans
        mapInstance.on('zoomend', () => {
          if (!mounted) return;
          if (!isProgrammaticZoomRef.current) {
            // User manually zoomed - reset click zoom sequence
            clickZoomLevelRef.current = null;
            lastClickLocationRef.current = null;
          }
          isProgrammaticZoomRef.current = false;
        });

        mapInstance.on('moveend', () => {
          if (!mounted) return;
          if (!isProgrammaticZoomRef.current) {
            // User manually panned - reset click zoom sequence
            clickZoomLevelRef.current = null;
            lastClickLocationRef.current = null;
          }
          isProgrammaticZoomRef.current = false;
        });

        // Add click handler to fly to location and optionally create pin
        mapInstance.on('click', (e: MapboxMouseEvent) => {
          if (!mounted) return;
          
          const { lng, lat } = e.lngLat;
          
          // Check if click is within Minnesota bounds
          const isInMinnesota = 
            lat >= 43.5 && lat <= 49.5 &&
            lng >= -97.5 && lng <= -89.5;
          
          if (!isInMinnesota) return;

          // Check if click hit an existing pin - if so, don't create new pin
          // The pin click handler in PinsLayer will handle showing the popup
          // This check must happen before any pin creation logic
          // Only check if layers exist to avoid errors
          try {
            const mapboxMap = mapInstance as any;
            const layersToCheck = [
              'map-pins-unclustered-point',
              'map-pins-unclustered-point-label',
              'map-pins-clusters',
              'map-pins-cluster-count',
            ];
            
            // Check if any of the layers exist before querying
            const existingLayers = layersToCheck.filter(layerId => {
              try {
                return mapboxMap.getLayer(layerId) !== undefined;
              } catch {
                return false;
              }
            });
            
            // Only query if layers exist
            if (existingLayers.length > 0) {
              const features = mapboxMap.queryRenderedFeatures(e.point, {
                layers: existingLayers,
              });

              // If a pin or cluster was clicked, don't create a new pin
              // Layer-specific handlers in PinsLayer will handle showing popups
              if (features.length > 0) {
                return;
              }
            }
          } catch (queryError) {
            // If query fails (e.g., layers not ready), continue with pin creation
            // This is safe - worst case user creates a pin when they clicked on one
            if (process.env.NODE_ENV === 'development') {
              console.warn('[MapContent] Error querying pin layers:', queryError);
            }
          }
          
          const currentZoom = mapInstance.getZoom();
          const maxZoom = 22;
          const minZoomForClick = 12;
          const zoomIncrement = 1.5;
          const distanceThreshold = 0.01; // ~1km in degrees
          
          // Calculate distance from last click location
          let isNearLastClick = false;
          if (lastClickLocationRef.current) {
            const distance = Math.sqrt(
              Math.pow(lng - lastClickLocationRef.current.lng, 2) +
              Math.pow(lat - lastClickLocationRef.current.lat, 2)
            );
            isNearLastClick = distance < distanceThreshold;
          }
          
          // Determine target zoom level
          let targetZoom: number;
          
          if (clickZoomLevelRef.current === null) {
            // First click in sequence - start zoom sequence
            targetZoom = Math.max(currentZoom + 1, minZoomForClick);
          } else if (isNearLastClick) {
            // Clicking near same location - continue zooming in
            targetZoom = Math.min(clickZoomLevelRef.current + zoomIncrement, maxZoom);
          } else {
            // Clicked far from last location - start new zoom sequence
            targetZoom = Math.max(currentZoom + 1, minZoomForClick);
          }
          
          // If already at max zoom and clicking same area, don't zoom further
          if (clickZoomLevelRef.current !== null && 
              clickZoomLevelRef.current >= maxZoom && 
              isNearLastClick) {
            // Already at max zoom on this location - just center without zooming
            mapInstance.flyTo({
              center: [lng, lat],
              zoom: maxZoom,
              duration: 800,
            });
            
            // Still open pin modal for authenticated users
            if (user) {
              setCreatePinCoordinates({ lat, lng });
              setIsCreatePinModalOpen(true);
            }
            return;
          }
          
          // Update tracking refs
          clickZoomLevelRef.current = targetZoom;
          lastClickLocationRef.current = { lng, lat };
          isProgrammaticZoomRef.current = true;
          
          // Fly to clicked location with incremental zoom
          mapInstance.flyTo({
            center: [lng, lat],
            zoom: targetZoom,
            duration: 1000,
          });
          
          // For authenticated users, also open create pin modal
          if (user) {
            setCreatePinCoordinates({ lat, lng });
            setIsCreatePinModalOpen(true);
          }
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize map';
        console.error('Failed to initialize map:', errorMessage, err);
        if (mounted) {
          setMapError('init-error');
        }
      }
    };

    // Initialize map using npm package
    initMap();

    return () => {
      mounted = false;
      // Cleanup map instance
      if (mapInstanceRef.current) {
        try {
          // Check if map is already removed to avoid errors
          if (!mapInstanceRef.current.removed) {
            mapInstanceRef.current.remove();
          }
        } catch (err) {
          // Map may already be removed or in invalid state
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MapContent] Error removing map instance:', err);
          }
        }
        mapInstanceRef.current = null;
      }
    };
  }, [user]);

  const handleStyleChange = useCallback((style: string) => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    const styleUrl = MAP_CONFIG.STRATEGIC_STYLES[style as keyof typeof MAP_CONFIG.STRATEGIC_STYLES];
    if (!styleUrl) return;
    
    const currentCenter = mapInstanceRef.current.getCenter();
    const currentZoom = mapInstanceRef.current.getZoom();
    
    mapInstanceRef.current.setStyle(styleUrl);
    mapInstanceRef.current.once('styledata', () => {
      if (mapInstanceRef.current && !mapInstanceRef.current.removed) {
        mapInstanceRef.current.setCenter(currentCenter);
        mapInstanceRef.current.setZoom(currentZoom);
      }
    });
    
    setCurrentMapStyle(style);
  }, [mapLoaded]);

  const handle3DToggle = useCallback((enabled: boolean) => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    setIs3DMode(enabled);
    
    mapInstanceRef.current.easeTo({
      pitch: enabled ? 60 : 0,
      duration: 800,
    });
  }, [mapLoaded]);

  const handleFindMe = useCallback(() => {
    if (!mapInstanceRef.current || !mapLoaded || !navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const isInMinnesota = 
          latitude >= 43.5 && latitude <= 49.5 &&
          longitude >= -97.5 && longitude <= -89.5;

        if (!isInMinnesota) {
          alert('Your location is outside Minnesota. The map is limited to Minnesota state boundaries.');
          return;
        }

        if (mapInstanceRef.current && !mapInstanceRef.current.removed) {
          // Reset click zoom sequence when using find me
          clickZoomLevelRef.current = null;
          lastClickLocationRef.current = null;
          
          mapInstanceRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1500,
          });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Unable to get your location. Please enable location access in your browser settings.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [mapLoaded]);

  const handleLocationSelect = useCallback((coordinates: { lat: number; lng: number }, placeName: string) => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    
    // Reset click zoom sequence when using location search
    clickZoomLevelRef.current = null;
    lastClickLocationRef.current = null;
    
    mapInstanceRef.current.flyTo({
      center: [coordinates.lng, coordinates.lat],
      zoom: 15,
      duration: 1500,
    });
  }, [mapLoaded]);

  const handlePinCreated = useCallback(() => {
    // Trigger refresh of pins layer
    setPinsRefreshKey((prev) => prev + 1);
    // UserPinsList will auto-refresh via subscription
  }, []);

  // Add/remove temporary marker when modal opens/closes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const addTemporaryMarker = async () => {
      if (!createPinCoordinates || !mapInstanceRef.current) return;

      try {
        const mapbox = await loadMapboxGL();
        
        // Remove existing temporary marker if any
        if (temporaryMarkerRef.current) {
          temporaryMarkerRef.current.remove();
          temporaryMarkerRef.current = null;
        }

        // Create temporary marker element - white dot with black center
        const el = document.createElement('div');
        el.className = 'temporary-pin-marker';
        el.style.cssText = `
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        `;

        // Create black center dot
        const centerDot = document.createElement('div');
        centerDot.style.cssText = `
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #000000;
        `;
        el.appendChild(centerDot);

        // Create marker
        const marker = new mapbox.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat([createPinCoordinates.lng, createPinCoordinates.lat])
          .addTo(mapInstanceRef.current);

        temporaryMarkerRef.current = marker;
      } catch (err) {
        console.error('Error creating temporary marker:', err);
      }
    };

    const removeTemporaryMarker = () => {
      if (temporaryMarkerRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }
    };

    if (isCreatePinModalOpen && createPinCoordinates) {
      addTemporaryMarker();
    } else {
      removeTemporaryMarker();
    }

    return () => {
      removeTemporaryMarker();
    };
  }, [isCreatePinModalOpen, createPinCoordinates, mapLoaded]);

  // Handle create-new-map query parameter
  useEffect(() => {
    const createNewMap = searchParams.get('create-new-map');
    if (createNewMap === 'true') {
      setIsCreateMapModalOpen(true);
    }
  }, [searchParams]);

  // Handle closing create map modal and removing query param
  const handleCloseCreateMapModal = useCallback(() => {
    setIsCreateMapModalOpen(false);
    // Remove query parameter from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete('create-new-map');
    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/map${newUrl}`);
  }, [searchParams, router]);

  // Handle map created - navigate to the new map
  const handleMapCreated = useCallback((mapId: string) => {
    router.push(`/map/${mapId}`);
  }, [router]);

  return (
    <SimplePageLayout 
      backgroundColor="bg-black" 
      contentPadding="px-0 py-0" 
      containerMaxWidth="full" 
      hideFooter={true}
      toolbar={
        <MapToolbar 
          mapStyle={currentMapStyle}
          onStyleChange={handleStyleChange}
          onLocationSelect={handleLocationSelect}
          is3DMode={is3DMode}
          on3DToggle={handle3DToggle}
          onFindMe={handleFindMe}
        />
      }
    >
      <div className="w-full relative" style={{ margin: 0, padding: 0, position: 'relative', width: '100%', height: 'calc(100vh - 104px)', minHeight: 'calc(100vh - 104px)', overflow: 'hidden' }}>
        <div 
          ref={mapContainer} 
          className="absolute inset-0 w-full h-full"
          style={{ width: '100%', height: '100%', margin: 0, padding: 0, overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Pins Layer */}
        {mapLoaded && mapInstanceRef.current && (
          <PinsLayer key={pinsRefreshKey} map={mapInstanceRef.current} mapLoaded={mapLoaded} />
        )}

        {/* User's Pins List */}
        {mapLoaded && mapInstanceRef.current && (
          <UserPinsList 
            map={mapInstanceRef.current} 
            mapLoaded={mapLoaded} 
          />
        )}

        {/* Create Pin Modal */}
        <CreatePinModal
          isOpen={isCreatePinModalOpen}
          onClose={() => {
            setIsCreatePinModalOpen(false);
            setCreatePinCoordinates(null);
          }}
          coordinates={createPinCoordinates}
          onPinCreated={handlePinCreated}
        />

        {/* Create Map Modal */}
        <CreateMapModal
          isOpen={isCreateMapModalOpen}
          onClose={handleCloseCreateMapModal}
          onMapCreated={handleMapCreated}
        />

        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
            <div className="text-center">
              {mapError === 'missing-token' ? (
                <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                  <div className="text-red-600 font-bold text-lg mb-2">⚠️ Mapbox Token Missing</div>
                  <div className="text-gray-700 text-sm mb-4">
                    Please set <code className="bg-gray-100 px-2 py-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in your <code className="bg-gray-100 px-2 py-1 rounded text-xs">.env.local</code> file.
                  </div>
                  <div className="text-xs text-gray-500">
                    Get your token from: <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Mapbox Account</a>
                  </div>
                </div>
              ) : mapError === 'script-error' ? (
                <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                  <div className="text-red-600 font-bold text-lg mb-2">⚠️ Mapbox Script Failed to Load</div>
                  <div className="text-gray-700 text-sm mb-4">
                    The Mapbox JavaScript library failed to load. Check your network connection and try refreshing the page.
                  </div>
                  <div className="text-xs text-gray-500">
                    If the problem persists, check browser console for details.
                  </div>
                </div>
              ) : mapError === 'script-timeout' ? (
                <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                  <div className="text-red-600 font-bold text-lg mb-2">⚠️ Mapbox Script Loading Timeout</div>
                  <div className="text-gray-700 text-sm mb-4">
                    The Mapbox JavaScript library is taking too long to load. This may be a network issue.
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Reload Page
                  </button>
                </div>
              ) : mapError === 'load-error' || mapError === 'init-error' ? (
                <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                  <div className="text-red-600 font-bold text-lg mb-2">⚠️ Map Initialization Error</div>
                  <div className="text-gray-700 text-sm mb-4">
                    Failed to initialize the map. Check browser console for details.
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Reload Page
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-white font-medium">Loading map...</div>
                  <div className="text-white text-xs mt-2">This may take a few seconds</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </SimplePageLayout>
  );
}
