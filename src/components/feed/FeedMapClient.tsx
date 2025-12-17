'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import TopNav from './TopNav';
import MapControls from './MapControls';
import LocationSidebar from './LocationSidebar';
import WelcomeModal from './WelcomeModal';
import AccountModal from './AccountModal';
import PinsLayer from '@/components/_archive/map/PinsLayer';
import CreatePinModal from '@/components/_archive/map/CreatePinModal';
import GuestDetailsModal from '@/components/auth/GuestDetailsModal';
import GuestAccountMergeModal from '@/components/auth/GuestAccountMergeModal';
import HomepageStatsHandle from './HomepageStatsHandle';
import { useAuth } from '@/features/auth';
import { usePageView } from '@/hooks/usePageView';
import { useHomepageState } from './useHomepageState';
import { useGuestAccountMerge } from '@/features/auth/hooks/useGuestAccountMerge';
import { GuestAccountService } from '@/features/auth/services/guestAccountService';
import { MapLayersPanel, useAtlasLayers, AtlasLayersRenderer } from '@/components/atlas';

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
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [pinsRefreshKey, setPinsRefreshKey] = useState(0);
  const removeTemporaryPinRef = useRef<(() => void) | null>(null);
  const updateTemporaryPinColorRef = useRef<((visibility: 'public' | 'only_me') => void) | null>(null);
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isGuestDetailsModalOpen, setIsGuestDetailsModalOpen] = useState(false);
  const [hasCompletedGuestProfile, setHasCompletedGuestProfile] = useState(false);
  const [isLayersPanelCollapsed, setIsLayersPanelCollapsed] = useState(true);
  const { layers, toggleLayer, setLayerCount } = useAtlasLayers();

  // Centralized state management for all homepage modals and UI states
  const {
    state,
    openWelcomeModal,
    closeWelcomeModal,
    openAccountModal,
    closeAccountModal,
    openCreatePinModal,
    closeCreatePinModal,
    backFromCreatePin,
    setSidebarOpen,
    openSidebarForMapClick,
    refreshAccount,
  } = useHomepageState();

  // Guest account merge hook
  const { state: mergeState } = useGuestAccountMerge();
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  // Check if guest profile is complete on mount
  useEffect(() => {
    const checkGuestProfile = async () => {
      if (!user && typeof window !== 'undefined') {
        const guestName = localStorage.getItem('mnuda_guest_name');
        // Profile is complete if name exists and is not just "Guest"
        if (guestName && guestName.trim() && guestName !== 'Guest') {
          // Verify account exists in Supabase
          try {
            const guestId = GuestAccountService.getGuestId();
            const account = await GuestAccountService.getGuestAccountByGuestId(guestId);
            if (account) {
              setHasCompletedGuestProfile(true);
            } else {
              // Account doesn't exist, but name is set - create it
              try {
                await GuestAccountService.getOrCreateGuestAccount();
                setHasCompletedGuestProfile(true);
              } catch (error) {
                console.error('[FeedMapClient] Error creating guest account:', error);
              }
            }
          } catch (error) {
            console.error('[FeedMapClient] Error checking guest account:', error);
          }
        }
      }
    };

    checkGuestProfile();
  }, [user]);

  // Open guest details modal on first click/interaction if profile not complete
  useEffect(() => {
    if (!user && !hasCompletedGuestProfile && !isGuestDetailsModalOpen && state.modalState !== 'welcome') {
      const handleFirstInteraction = () => {
        setIsGuestDetailsModalOpen(true);
        // Remove listeners after first interaction
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
      };

      // Wait a bit after welcome modal closes
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleFirstInteraction, { once: true });
        document.addEventListener('touchstart', handleFirstInteraction, { once: true });
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
      };
    }
  }, [user, hasCompletedGuestProfile, isGuestDetailsModalOpen, state.modalState]);

  // Merge functionality disabled - guest accounts remain separate from user accounts
  // When user logs in, guest data is not merged automatically
  // useEffect(() => {
  //   if (user && mergeState.hasGuestData && mergeState.guestAccount && mergeState.pinCount !== null && mergeState.pinCount > 0 && !isMergeModalOpen) {
  //     setIsMergeModalOpen(true);
  //   }
  // }, [user, mergeState.hasGuestData, mergeState.guestAccount, mergeState.pinCount, isMergeModalOpen]);

  // Handle URL params for account modal
  useEffect(() => {
    const modal = searchParams.get('modal');
    const tab = searchParams.get('tab');
    
    if (modal === 'account' && user && state.modalState !== 'account') {
      openAccountModal(tab || undefined);
    }
  }, [searchParams, user, state.modalState, openAccountModal]);


  // Listen for map clicks to update temporary pin when create pin modal is open
  useEffect(() => {
    const handleMapClickUpdatePin = (event: CustomEvent) => {
      const { lat, lng } = event.detail;
      
      // Only update if create pin modal is open
      if (state.modalState === 'create-pin' && state.createPinCoordinates) {
        // Update coordinates in state (this will update the modal)
        openCreatePinModal({ lat, lng });
        
        // Update temporary pin position via event
        window.dispatchEvent(new CustomEvent('update-temporary-pin', {
          detail: { lat, lng }
        }));
      }
    };

    window.addEventListener('map-click-update-pin', handleMapClickUpdatePin as EventListener);
    return () => {
      window.removeEventListener('map-click-update-pin', handleMapClickUpdatePin as EventListener);
    };
  }, [state.modalState, state.createPinCoordinates, openCreatePinModal]);

  // Handle URL params for pin navigation (lat, lng, pin)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const pinIdParam = searchParams.get('pin');

    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Fly to the location
        mapInstanceRef.current.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 1500,
        });

        // If a pin ID is provided, dispatch a custom event to trigger pin selection
        if (pinIdParam) {
          // Dispatch event after a short delay to ensure map has flown to location
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('select-pin-by-id', {
              detail: { pinId: pinIdParam }
            }));
          }, 1600);
        } else {
          // Just show location without pin selection
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('show-location', {
              detail: { lat, lng }
            }));
          }, 1600);
        }

        // Open sidebar
        setSidebarOpen(true);
      }
    }
  }, [searchParams, mapLoaded, setSidebarOpen]);

  // Handle account modal open from TopNav
  const handleAccountModalOpen = () => {
    if (user) {
      // Authenticated user: open account modal
      openAccountModal();
    } else {
      // Guest: open guest details modal
      setIsGuestDetailsModalOpen(true);
    }
  };

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
          style: MAP_CONFIG.STRATEGIC_STYLES.satellite,
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

        // Handle map clicks to show location (temporary pin only, no modal)
        // Modal will only open when user clicks "Create Pin" button

        // Handle double-click to open create pin modal
        mapInstance.on('dblclick', (e: any) => {
          if (!mounted) return;
          
          // Get coordinates from the click event
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          
          // Open create pin modal with coordinates
          openCreatePinModal({ lat, lng });
        });

        // Handle single click to update temporary pin position when create pin modal is open
        mapInstance.on('click', (e: any) => {
          if (!mounted) return;
          
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          
          // Dispatch event - FeedMapClient will check if modal is open and update accordingly
          window.dispatchEvent(new CustomEvent('map-click-update-pin', {
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
          
          console.error('[FeedMap] Map error:', errorMessage, e);
          if (mounted) {
            setMapError('load-error');
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
            console.warn('[FeedMap] Error removing map instance:', err);
          }
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

  const handle3DToggle = useCallback((enabled: boolean) => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    setIs3DMode(enabled);
    
    mapInstanceRef.current.easeTo({
      pitch: enabled ? 60 : 0,
      duration: 800,
    });
  }, [mapLoaded]);

  // Toggle road layers visibility
  const handleRoadsToggle = useCallback((visible: boolean) => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    setRoadsVisible(visible);
    
    const map = mapInstanceRef.current;
    
    // Road layer patterns in Mapbox styles
    const roadLayerPatterns = [
      'road',
      'bridge',
      'tunnel',
      'highway',
      'motorway',
      'trunk',
      'primary',
      'secondary',
      'tertiary',
      'street',
      'path',
      'pedestrian',
      'cycleway',
      'track',
    ];
    
    try {
      const style = map.getStyle();
      if (!style?.layers) return;
      
      style.layers.forEach((layer) => {
        const layerId = layer.id.toLowerCase();
        const isRoadLayer = roadLayerPatterns.some(pattern =>
          layerId.includes(pattern)
        );
        
        if (isRoadLayer) {
          try {
            map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
          } catch {
            // Layer might not support visibility, ignore
          }
        }
      });
    } catch (e) {
      console.warn('[FeedMap] Error toggling road layers:', e);
    }
  }, [mapLoaded]);

  const handlePinCreated = () => {
    // Refresh pins layer
    setPinsRefreshKey(prev => prev + 1);
    closeCreatePinModal();
    // Remove temporary pin after pin is created
    if (removeTemporaryPinRef.current) {
      removeTemporaryPinRef.current();
      removeTemporaryPinRef.current = null;
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Map Container - Full Viewport */}
      <div 
        ref={mapContainer} 
        className="fixed inset-0 w-full h-full"
        style={{ 
          width: '100vw', 
          height: '100vh', 
          margin: 0, 
          padding: 0, 
          overflow: 'hidden',
          zIndex: 1
        }}
      />

      {/* Pins Layer */}
      {mapLoaded && mapInstanceRef.current && (
        <PinsLayer key={pinsRefreshKey} map={mapInstanceRef.current} mapLoaded={mapLoaded} />
      )}

      {/* Atlas Layers (Cities, Counties, Neighborhoods, Schools, Parks, Lakes) */}
      {mapLoaded && mapInstanceRef.current && (
        <AtlasLayersRenderer
          map={mapInstanceRef.current}
          mapLoaded={mapLoaded}
          layers={layers}
          onLayerCountUpdate={setLayerCount}
          onToggleLayer={toggleLayer}
        />
      )}

      {/* Left Sidebar with Search and Location Details - Always visible, expands on mobile when data exists */}
      <LocationSidebar 
        map={mapInstanceRef.current} 
        mapLoaded={mapLoaded}
        isOpen={state.isSidebarOpen && state.modalState !== 'create-pin'}
        onLocationSelect={handleLocationSelect}
        onCreatePin={(coordinates) => {
          openCreatePinModal(coordinates);
        }}
        onSkipTrace={(coordinates) => {
          // TODO: Implement skip trace functionality
          console.log('Skip trace at:', coordinates);
        }}
        onDrawArea={(coordinates) => {
          // TODO: Implement draw area functionality
          console.log('Draw area at:', coordinates);
        }}
        onRemoveTemporaryPin={(removeFn) => {
          removeTemporaryPinRef.current = removeFn;
        }}
        onUpdateTemporaryPinColor={(updateFn) => {
          updateTemporaryPinColorRef.current = updateFn;
        }}
        onCloseCreatePinModal={() => {
          closeCreatePinModal();
        }}
        onMapClick={() => {
          // If guest hasn't completed profile, open guest details modal on first click
          if (!user && !hasCompletedGuestProfile && !isGuestDetailsModalOpen) {
            setIsGuestDetailsModalOpen(true);
            return;
          }
          // Only open sidebar if no modal is open
          openSidebarForMapClick();
        }}
      />

      {/* Top Navigation */}
      <TopNav 
        isAccountModalOpen={state.modalState === 'account'}
        onAccountModalOpen={handleAccountModalOpen}
        onWelcomeModalOpen={openWelcomeModal}
        hasCompletedGuestProfile={hasCompletedGuestProfile}
      />

      {/* Homepage Stats Handle - Small handle at top center */}
      <HomepageStatsHandle />

      {/* Map Controls - Bottom Right */}
      <MapControls 
        map={mapInstanceRef.current} 
        mapLoaded={mapLoaded}
        is3DMode={is3DMode}
        on3DToggle={handle3DToggle}
        roadsVisible={roadsVisible}
        onRoadsToggle={handleRoadsToggle}
      />

      {/* Atlas Layers Panel - Bottom Left */}
      <div className="fixed bottom-4 left-4 z-30">
        <MapLayersPanel
          layers={layers}
          onToggleLayer={toggleLayer}
          isCollapsed={isLayersPanelCollapsed}
          onToggleCollapse={() => setIsLayersPanelCollapsed(!isLayersPanelCollapsed)}
        />
      </div>

      {/* Welcome Modal */}
      <WelcomeModal 
        isOpen={state.modalState === 'welcome'} 
        onClose={closeWelcomeModal}
        onGuestContinue={() => {
          // Open guest details modal after welcome modal closes
          if (!user) {
            setIsGuestDetailsModalOpen(true);
          }
        }}
      />

      {/* Account Modal */}
      <AccountModal 
        isOpen={state.modalState === 'account'} 
        onClose={() => {
          closeAccountModal();
          // Clean up URL params
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('modal');
            url.searchParams.delete('tab');
            window.history.replaceState({}, '', url.pathname + url.search);
          }
        }}
        initialTab={state.accountModalTab as any}
        onAccountUpdate={async () => {
          await refreshAccount();
        }}
      />

      {/* Create Pin Modal */}
      <CreatePinModal
        isOpen={state.modalState === 'create-pin'}
        onClose={() => {
          closeCreatePinModal();
          // Remove temporary pin when modal is closed (cancelled)
          if (removeTemporaryPinRef.current) {
            removeTemporaryPinRef.current();
            removeTemporaryPinRef.current = null;
          }
        }}
        coordinates={state.createPinCoordinates}
        onPinCreated={handlePinCreated}
        onBack={() => {
          // Go back to location sidebar (temporary pin remains visible)
          backFromCreatePin();
        }}
        onVisibilityChange={(visibility) => {
          if (updateTemporaryPinColorRef.current) {
            updateTemporaryPinColorRef.current(visibility);
          }
        }}
      />

      {/* Guest Details Modal */}
      <GuestDetailsModal
        isOpen={isGuestDetailsModalOpen}
        onClose={() => {
          // Only allow closing if profile is complete
          const guestName = typeof window !== 'undefined' 
            ? localStorage.getItem('mnuda_guest_name') 
            : null;
          if (guestName && guestName.trim() && guestName !== 'Guest') {
            setIsGuestDetailsModalOpen(false);
            setHasCompletedGuestProfile(true);
          }
        }}
        onComplete={async () => {
          // Verify account was created and mark profile as complete
          try {
            const guestId = GuestAccountService.getGuestId();
            const account = await GuestAccountService.getGuestAccountByGuestId(guestId);
            if (account) {
              setHasCompletedGuestProfile(true);
            } else {
              // Account doesn't exist yet, but name is set - create it
              await GuestAccountService.getOrCreateGuestAccount();
              setHasCompletedGuestProfile(true);
            }
            // Close modal after completion
            setIsGuestDetailsModalOpen(false);
          } catch (error) {
            console.error('[FeedMapClient] Error completing guest profile:', error);
            // Still set as complete if name is valid
            const guestName = GuestAccountService.getGuestName();
            if (guestName && guestName.trim() && guestName !== 'Guest') {
              setHasCompletedGuestProfile(true);
              setIsGuestDetailsModalOpen(false);
            }
          }
        }}
        onSignIn={() => {
          // Open welcome modal for sign-in/sign-up
          openWelcomeModal();
        }}
      />

      {/* Guest Account Merge Modal - Disabled: Guest accounts remain separate from user accounts */}
      {/* <GuestAccountMergeModal
        isOpen={isMergeModalOpen}
        onClose={() => {
          setIsMergeModalOpen(false);
          // After closing, refresh pins if merge was successful
          if (mergeState.pinCount === 0 || !mergeState.hasGuestData) {
            setPinsRefreshKey(prev => prev + 1);
          }
        }}
      /> */}

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
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <div className="text-white font-medium">Loading map...</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


