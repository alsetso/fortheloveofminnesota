'use client';

import { useState, useEffect, useRef } from 'react';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import SimpleNav from '@/components/SimpleNav';
import LocationSidebar from './LocationSidebar';
import PinsLayer from '@/components/_archive/map/PinsLayer';
import HomepageStatsHandle from './HomepageStatsHandle';
import { useAuthStateSafe } from '@/features/auth';
import { usePageView } from '@/hooks/usePageView';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAtlasLayers, AtlasLayersRenderer } from '@/components/atlas';
import { useUrlMapState } from './hooks/useUrlMapState';

interface FeedMapClientProps {
  cities: Array<{
    id: string;
    name: string;
    slug: string;
    population: string;
    county: string;
  }>;
  counties: Array<{
    id: string;
    name: string;
    slug: string;
    population: string;
    area: string;
  }>;
}

export default function FeedMapClient({ cities, counties }: FeedMapClientProps) {
  // Track page view
  usePageView();
  
  // Map state
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [pinsRefreshKey, setPinsRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const initializedRef = useRef(false);
  
  // Atlas layers
  const { layers, toggleLayer, setLayerCount } = useAtlasLayers();
  
  // Modal controls (modals rendered globally, but we need access to open functions)
  const { isModalOpen, openWelcome } = useAppModalContextSafe();
  
  // URL-based map state (deep linking for shareable URLs)
  const { 
    updateUrlForLocation, 
    updateUrlForPin,
    getShareableUrl,
    getShareablePinUrl,
  } = useUrlMapState({
    map: mapInstanceRef.current,
    mapLoaded,
    onOpenSidebar: () => setIsSidebarOpen(true),
  });
  
  // Auth state from unified context - use isLoading to ensure auth is initialized
  const {
    user,
    isLoading: authLoading,
  } = useAuthStateSafe();

  // Refs to access current auth state in map event callbacks
  // These refs ensure we always have the latest auth state without re-rendering
  const userRef = useRef(user);
  const authLoadingRef = useRef(authLoading);
  const openWelcomeRef = useRef(openWelcome);
  
  useEffect(() => {
    userRef.current = user;
    authLoadingRef.current = authLoading;
    openWelcomeRef.current = openWelcome;
  }, [user, authLoading, openWelcome]);

  // Initialize component (one-time setup)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
  }, []);

  // Listen for pin-created event from inline form to refresh pins layer
  useEffect(() => {
    const handlePinCreatedEvent = () => {
      setPinsRefreshKey(prev => prev + 1);
    };

    window.addEventListener('pin-created', handlePinCreatedEvent);
    return () => {
      window.removeEventListener('pin-created', handlePinCreatedEvent);
    };
  }, []);

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
        // @ts-ignore - CSS import
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapbox = await loadMapboxGL();
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

        if (!mapContainer.current || !mounted) return;

        const mapInstance = new mapbox.Map({
          container: mapContainer.current,
          style: MAP_CONFIG.MAPBOX_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          pitch: 60, // Start in 3D mode
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
          }
        });

        // Handle double-click to select location and expand inline pin form
        mapInstance.on('dblclick', (e: any) => {
          if (!mounted) return;
          
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          // Dispatch event to show location in sidebar and expand pin form
          // Location details can be shown without authentication - auth check happens when creating pin
          window.dispatchEvent(new CustomEvent('show-location-for-pin', {
            detail: { lat, lng }
          }));
        });

        mapInstance.on('error', (e: unknown) => {
          const errorMessage = e instanceof Error 
            ? e.message 
            : typeof e === 'object' && e !== null && 'error' in e
            ? String((e as any).error)
            : typeof e === 'string'
            ? e
            : 'Unknown map error';
          
          console.error('[FeedMap] Map error:', errorMessage);
          if (mounted) {
            setMapError('load-error');
          }
        });
      } catch (err) {
        console.error('Failed to initialize map:', err);
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
        } catch {
          // Ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleLocationSelect = (coordinates: { lat: number; lng: number }) => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    
    mapInstanceRef.current.flyTo({
      center: [coordinates.lng, coordinates.lat],
      zoom: 15,
      duration: 1500,
    });
    
    // Update URL for shareable deep links
    updateUrlForLocation(coordinates.lat, coordinates.lng, 15);
  };

  const NAV_HEIGHT = '3.5rem';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <SimpleNav />

      <div 
        className="relative flex-1 w-full overflow-hidden"
        style={{ height: `calc(100vh - ${NAV_HEIGHT})` }}
      >
        {/* Mapbox Container */}
        <div 
          ref={mapContainer} 
          className="absolute inset-0 w-full h-full"
          style={{ margin: 0, padding: 0, overflow: 'hidden', zIndex: 1 }}
        />

        {/* Pins Layer */}
        {mapLoaded && mapInstanceRef.current && (
          <PinsLayer key={pinsRefreshKey} map={mapInstanceRef.current} mapLoaded={mapLoaded} />
        )}

        {/* Atlas Layers */}
        {mapLoaded && mapInstanceRef.current && (
          <AtlasLayersRenderer
            map={mapInstanceRef.current}
            mapLoaded={mapLoaded}
            layers={layers}
            onLayerCountUpdate={setLayerCount}
            onToggleLayer={toggleLayer}
          />
        )}

        {/* Left Sidebar */}
        <LocationSidebar
          map={mapInstanceRef.current}
          mapLoaded={mapLoaded}
          isOpen={isSidebarOpen && !isModalOpen}
          onLocationSelect={handleLocationSelect}
          layers={layers}
          onToggleLayer={toggleLayer}
        />

        {/* Homepage Stats Handle */}
        <HomepageStatsHandle />

        {/* Loading/Error Overlay */}
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
              ) : mapError ? (
                <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                  <div className="text-red-600 font-bold text-lg mb-2">⚠️ Map Error</div>
                  <div className="text-gray-700 text-sm mb-4">
                    Failed to initialize the map. Check browser console for details.
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <div className="text-white font-medium">Loading map...</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals handled globally via AppModalContext/GlobalModals */}
    </div>
  );
}
