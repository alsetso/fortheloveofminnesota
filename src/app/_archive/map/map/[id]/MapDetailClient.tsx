'use client';

import { createContext, useContext, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import MapToolbar from '@/components/_archive/map/MapToolbar';
import { useAuth } from '@/features/auth';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import { UserPointService } from '@/features/user-maps/services';
import { UserMapService } from '@/features/user-maps/services';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import type { Account } from '@/features/auth';
import type { UserMap, UserPoint } from '@/features/user-maps/types';

interface MapHandlers {
  mapStyle: string;
  onStyleChange: (style: string) => void;
  onLocationSelect: (coordinates: { lat: number; lng: number }, placeName: string) => void;
  is3DMode: boolean;
  on3DToggle: (enabled: boolean) => void;
  onFindMe: () => void;
}

const MapHandlersContext = createContext<MapHandlers | null>(null);

export function useMapHandlers() {
  const context = useContext(MapHandlersContext);
  if (!context) {
    throw new Error('useMapHandlers must be used within MapDetailClient');
  }
  return context;
}

export default function MapDetailClient({ mapId, initialMap, account, children }: MapDetailClientProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [currentMapStyle, setCurrentMapStyle] = useState('streets');
  const [is3DMode, setIs3DMode] = useState(false);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [map, setMap] = useState<UserMap>(initialMap);
  const [points, setPoints] = useState<UserPoint[]>([]);
  const [pointsRefreshKey, setPointsRefreshKey] = useState(0);
  const [toolbarContainer, setToolbarContainer] = useState<HTMLElement | null>(null);
  const { user } = useAuth();

  // Find toolbar container in DOM (rendered by SimplePageLayout)
  useEffect(() => {
    // Find the toolbar slot by ID
    const findToolbarContainer = () => {
      return document.getElementById('map-detail-toolbar-slot');
    };

    // Try to find it immediately
    const container = findToolbarContainer();
    if (container) {
      setToolbarContainer(container);
    } else {
      // If not found, try again after a short delay
      const timeout = setTimeout(() => {
        const found = findToolbarContainer();
        if (found) setToolbarContainer(found);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, []);

  // Load points for this map
  useEffect(() => {
    const loadPoints = async () => {
      try {
        const pointsData = await UserPointService.getPointsByMapId(mapId);
        setPoints(pointsData);
      } catch (err) {
        console.error('[MapDetailClient] Error loading points:', err);
        // Don't set points on error, keep existing state
      }
    };

    if (mapId) {
      loadPoints();
    }
  }, [mapId, pointsRefreshKey]);

  // Initialize map
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
        await import('mapbox-gl/dist/mapbox-gl.css');
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
        }) as any;

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
          }
        });

        mapInstance.on('error', (e: unknown) => {
          const errorMessage = e instanceof Error 
            ? e.message 
            : typeof e === 'object' && e !== null && 'error' in e
            ? String((e as any).error)
            : typeof e === 'string'
            ? e
            : 'Unknown map error';
          
          const isLayerQueryError = errorMessage.includes("does not exist in the map's style and cannot be queried");
          const isStyleTransitionError = errorMessage.includes("does not exist in the map's style");
          
          if (isLayerQueryError || isStyleTransitionError) {
            if (process.env.NODE_ENV === 'development') {
              console.debug('[MapDetailClient] Suppressed expected layer query error during style transition');
            }
            return;
          }
          
          console.error('[MapDetailClient] Map error:', errorMessage);
          if (mounted) {
            setMapError('load-error');
          }
        });

        // Handle map clicks to add points (if user has edit access)
        mapInstance.on('click', async (e: any) => {
          const features = mapInstance.queryRenderedFeatures(e.point, {
            layers: ['map-points-layer'],
          });
          
          if (features && features.length > 0) {
            return;
          }

          if (!user || !account) return;
          
          // Check if user has edit access using service
          const canEdit = await UserMapService.canEditMap(mapId);
          if (!canEdit) return;

          const { lng, lat } = e.lngLat;
          
          try {
            await UserPointService.createPoint({
              map_id: mapId,
              lat,
              lng,
            });

            // Refresh points
            setPointsRefreshKey((prev) => prev + 1);
          } catch (err) {
            console.error('[MapDetailClient] Error creating point:', err);
            // Error is already logged by service
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

    initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        try {
          if (!mapInstanceRef.current.removed) {
            mapInstanceRef.current.remove();
          }
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MapDetailClient] Error removing map instance:', err);
          }
        }
        mapInstanceRef.current = null;
      }
    };
  }, [user, account, mapId, map.account_id]);

  // Render points on map
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const mapInstance = mapInstanceRef.current as any;
    const sourceId = 'map-points-source';
    const layerId = 'map-points-layer';

    try {
      if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
      if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
    } catch (e) {
      // Layers might not exist
    }

    if (points.length === 0) return;

    const geoJSON = {
      type: 'FeatureCollection' as const,
      features: points.map(point => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [point.lng, point.lat],
        },
        properties: {
          id: point.id,
          label: point.label,
          description: point.description,
        },
      })),
    };

    mapInstance.addSource(sourceId, {
      type: 'geojson',
      data: geoJSON,
    });

    mapInstance.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': '#3b82f6',
        'circle-radius': 8,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

    const pointClickHandler = (e: any) => {
      if (e.originalEvent) {
        e.originalEvent.stopPropagation();
      }
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const pointId = feature.properties?.id;
      if (pointId) {
        console.log('Point clicked:', pointId);
      }
    };

    mapInstance.on('click', layerId, pointClickHandler);
    mapInstance.on('mouseenter', layerId, () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });
    mapInstance.on('mouseleave', layerId, () => {
      mapInstance.getCanvas().style.cursor = '';
    });

    return () => {
      try {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.off('click', layerId, pointClickHandler);
          mapInstance.off('mouseenter', layerId);
          mapInstance.off('mouseleave', layerId);
        }
      } catch (e) {
        // Ignore
      }
    };
  }, [mapLoaded, points]);

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
    
    mapInstanceRef.current.flyTo({
      center: [coordinates.lng, coordinates.lat],
      zoom: 15,
      duration: 1500,
    });
  }, [mapLoaded]);

  // Check if user has edit access
  const [hasEditAccess, setHasEditAccess] = useState(false);

  useEffect(() => {
    const checkEditAccess = async () => {
      if (!account) {
        setHasEditAccess(false);
        return;
      }

      try {
        const canEdit = await UserMapService.canEditMap(mapId);
        setHasEditAccess(canEdit);
      } catch (err) {
        console.error('[MapDetailClient] Error checking edit access:', err);
        setHasEditAccess(false);
      }
    };

    checkEditAccess();
  }, [account, mapId]);

  const handlers: MapHandlers = {
    mapStyle: currentMapStyle,
    onStyleChange: handleStyleChange,
    onLocationSelect: handleLocationSelect,
    is3DMode,
    on3DToggle: handle3DToggle,
    onFindMe: handleFindMe,
  };

  return (
    <MapHandlersContext.Provider value={handlers}>
      {/* Portal toolbar to the correct DOM location if container found */}
      {toolbarContainer && typeof window !== 'undefined' && createPortal(
        <MapToolbar 
          mapStyle={handlers.mapStyle}
          onStyleChange={handlers.onStyleChange}
          onLocationSelect={handlers.onLocationSelect}
          is3DMode={handlers.is3DMode}
          on3DToggle={handlers.on3DToggle}
          onFindMe={handlers.onFindMe}
        />,
        toolbarContainer
      )}
      {children}
      {/* Map Title Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold text-white">{map.title}</h1>
              {map.description && (
                <p className="text-xs text-gray-400 mt-0.5">{map.description}</p>
              )}
            </div>
            {hasEditAccess && (
              <div className="text-xs text-gray-400">
                Click on the map to add points
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="w-full relative" style={{ margin: 0, padding: 0, position: 'relative', width: '100%', height: 'calc(100vh - 104px)', minHeight: 'calc(100vh - 104px)', overflow: 'hidden' }}>
        <div 
          ref={mapContainer} 
          className="absolute inset-0 w-full h-full"
          style={{ width: '100%', height: '100%', margin: 0, padding: 0, overflow: 'hidden', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-white font-medium">Loading map...</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </MapHandlersContext.Provider>
  );
}
