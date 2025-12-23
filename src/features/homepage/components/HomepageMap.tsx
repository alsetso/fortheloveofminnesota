'use client';

import { useState, useEffect, useRef } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { addBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import FloatingMapContainer from './FloatingMapContainer';
import MentionsLayer from '@/features/map/components/MentionsLayer';
import HomepageStatsHandle from './HomepageStatsHandle';
import { useAuthStateSafe, AccountService, Account } from '@/features/auth';
import { useActiveAccount } from '@/features/account/contexts/ActiveAccountContext';
import { usePageView } from '@/hooks/usePageView';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useUrlMapState } from '../hooks/useUrlMapState';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/features/sidebar/components/Sidebar';
import AccountDropdown from '@/features/auth/components/AccountDropdown';
import POIsLayer from '@/features/map/components/POIsLayer';
import DraftPOIsLayer from '@/features/map/components/DraftPOIsLayer';

interface HomepageMapProps {
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

export default function HomepageMap({ cities, counties }: HomepageMapProps) {
  // Track page view
  usePageView();
  
  // Map state
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [mentionsRefreshKey, setMentionsRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const initializedRef = useRef(false);
  const hoveredMentionIdRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const isHoveringMentionRef = useRef(false);
  
  // POI layer visibility state
  const [isPOILayerVisible, setIsPOILayerVisible] = useState(false);
  
  // Modal controls (modals rendered globally, but we need access to open functions)
  const { isModalOpen, openWelcome, openAccount, openUpgrade } = useAppModalContextSafe();
  
  // URL-based state (only year filter)
  useUrlMapState();
  
  // Auth state from unified context - use isLoading to ensure auth is initialized
  const {
    user,
    isLoading: authLoading,
  } = useAuthStateSafe();

  // Use active account from context
  const { activeAccount: account } = useActiveAccount();

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

  // Listen for mention-created event from inline form to refresh mentions layer
  useEffect(() => {
    const handleMentionCreatedEvent = () => {
      setMentionsRefreshKey(prev => prev + 1);
    };

    window.addEventListener('mention-created', handleMentionCreatedEvent);
    return () => {
      window.removeEventListener('mention-created', handleMentionCreatedEvent);
    };
  }, []);

  // Watch for mention URL parameter and select mention
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return undefined;

    const mentionId = searchParams.get('mention');
    
    if (mentionId) {
      // Small delay to ensure MentionsLayer is ready
      const timeoutId = setTimeout(() => {
        // Dispatch event to select mention by ID
        window.dispatchEvent(new CustomEvent('select-mention-by-id', {
          detail: { mentionId }
        }));
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
    
    return undefined;
  }, [mapLoaded, searchParams]);

  // Listen for mention hover events to prevent mention creation
  useEffect(() => {
    const handleMentionHoverStart = (event: Event) => {
      const customEvent = event as CustomEvent<{ mentionId: string; mention: any }>;
      const { mentionId } = customEvent.detail || {};
      if (mentionId) {
        isHoveringMentionRef.current = true;
        hoveredMentionIdRef.current = mentionId;
        // Dispatch event with mention ID for cursor tracker
        window.dispatchEvent(new CustomEvent('mention-hover-update', {
          detail: { mentionId, mention: customEvent.detail?.mention }
        }));
      }
    };

    const handleMentionHoverEnd = () => {
      isHoveringMentionRef.current = false;
      hoveredMentionIdRef.current = null;
      // Dispatch event to clear mention from cursor tracker
      window.dispatchEvent(new CustomEvent('mention-hover-update', {
        detail: { mentionId: null, mention: null }
      }));
    };

    window.addEventListener('mention-hover-start', handleMentionHoverStart);
    window.addEventListener('mention-hover-end', handleMentionHoverEnd);
    return () => {
      window.removeEventListener('mention-hover-start', handleMentionHoverStart);
      window.removeEventListener('mention-hover-end', handleMentionHoverEnd);
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
          preserveDrawingBuffer: true, // REQUIRED for canvas.toDataURL() screenshot capture
        });

        mapInstanceRef.current = mapInstance as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            // Buildings are controlled via sidebar - don't add by default
            // User can enable via Controls icon in sidebar
          }
        });

        // Handle double-click to select location and expand inline mention form
        mapInstance.on('dblclick', (e: any) => {
          if (!mounted) return;
          
          // Prevent mention creation if hovering over a mention
          if (isHoveringMentionRef.current || hoveredMentionIdRef.current) {
            return;
          }
          
          // Check if click hit a mention layer - if so, don't create new mention
          // Mention click handlers will handle opening the popup
          const mentionLayers = ['map-mentions-point', 'map-mentions-point-label'];
          const features = (mapInstance as any).queryRenderedFeatures(e.point, {
            layers: mentionLayers,
          });

          // If clicked on a mention, don't create new mention (mention click handler will handle it)
          if (features.length > 0) {
            return;
          }
          
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          // Dispatch event to show location in sidebar and expand mention form
          // Location details can be shown without authentication - auth check happens when creating mention
          // Only dispatch if not hovering over a mention
          if (!isHoveringMentionRef.current && !hoveredMentionIdRef.current) {
            window.dispatchEvent(new CustomEvent('show-location-for-mention', {
              detail: { lat, lng }
            }));
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
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <div 
        className="relative flex-1 w-full overflow-hidden flex"
        style={{ height: '100vh' }}
      >
        {/* Sidebar - shows on all screens, mobile nav is built into Sidebar */}
        <Sidebar account={account} map={mapInstanceRef.current} />

        {/* Map and other components */}
        <div className="flex-1 relative overflow-hidden mt-14 lg:mt-0">
        {/* Mapbox Container */}
        <div 
          ref={mapContainer} 
          className="absolute inset-0 w-full h-full"
          style={{ margin: 0, padding: 0, overflow: 'hidden', zIndex: 1 }}
        />

        {/* Mentions Layer */}
        {mapLoaded && mapInstanceRef.current && (
          <MentionsLayer key={mentionsRefreshKey} map={mapInstanceRef.current} mapLoaded={mapLoaded} />
        )}

        {/* POIs Layer - Toggleable via button */}
        {mapLoaded && mapInstanceRef.current && (
          <>
            <POIsLayer map={mapInstanceRef.current} mapLoaded={mapLoaded} visible={isPOILayerVisible} />
            <DraftPOIsLayer map={mapInstanceRef.current} mapLoaded={mapLoaded} />
          </>
        )}


        {/* Left Sidebar */}
        <FloatingMapContainer
          map={mapInstanceRef.current}
          mapLoaded={mapLoaded}
          isOpen={isSidebarOpen && !isModalOpen}
          onLocationSelect={handleLocationSelect}
        />


        {/* Homepage Stats Handle */}
        <HomepageStatsHandle />

        {/* POI Layer Toggle - Top Left */}
        <div className="absolute top-4 left-4 z-20 pointer-events-auto">
          <button
            onClick={() => setIsPOILayerVisible(!isPOILayerVisible)}
            className="bg-white border border-gray-200 rounded-md px-2 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span className="text-xs">POIs</span>
            {isPOILayerVisible && (
              <span className="w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Floating Account Dropdown - Top Right (desktop only, mobile has it in nav) */}
        <div className="hidden lg:flex absolute top-4 right-4 z-20 pointer-events-auto items-center gap-2">
          {account?.plan === 'hobby' && (
            <button
              onClick={() => openUpgrade()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              Upgrade
            </button>
          )}
          <AccountDropdown
            variant="light"
            onAccountClick={() => openAccount('settings')}
            onSignInClick={() => openWelcome()}
          />
        </div>

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
      </div>

      {/* Modals handled globally via AppModalContext/GlobalModals */}
    </div>
  );
}
