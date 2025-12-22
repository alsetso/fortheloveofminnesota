'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import { addBuildingExtrusions } from '@/features/map/utils/addBuildingExtrusions';
import CreateMentionModal from '@/features/map/components/CreateMentionModal';
import SimpleNav from '@/components/layout/SimpleNav';
import { usePageView } from '@/hooks/usePageView';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ProfilePinsLayer from './ProfilePinsLayer';
import ProfileMapControls from './ProfileMapControls';
import ProfileMapToolbar from './ProfileMapToolbar';
import ProfilePinsSidebar from './ProfilePinsSidebar';
import { useProfileOwnership } from '@/hooks/useProfileOwnership';
import { useTemporaryPinMarker } from '../hooks/useTemporaryPinMarker';
import { useDebounce } from '../hooks/useDebounce';
import { useProfileUrlState } from '../hooks/useProfileUrlState';
import type { 
  ProfilePin, 
  ProfileAccount,
} from '@/types/profile';
import type { Mention } from '@/types/mention';
import { filterPinsForVisitor } from '@/types/profile';

interface ProfileMapClientProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  isOwnProfile: boolean;
  initialViewMode?: 'owner' | 'visitor'; // Initial view mode from URL query param
}

// Consolidated modal state type
type ModalState = 
  | { type: 'none' }
  | { type: 'create-pin'; coordinates: { lat: number; lng: number } };

export default function ProfileMapClient({ 
  account, 
  pins: initialPins, 
  isOwnProfile: serverIsOwnProfile,
  initialViewMode = 'owner',
}: ProfileMapClientProps) {
  usePageView();
  
  // Centralized URL state management
  const { mentionId: urlMentionId, viewMode, setMentionId, clearMentionId, setView, setMentionIdAndView } = useProfileUrlState();
  
  // Use ownership hook for consolidated ownership logic
  const ownership = useProfileOwnership({
    account,
    serverIsOwnProfile,
  });

  // Local view mode state (synced with URL state)
  const [localViewMode, setLocalViewMode] = useState<'owner' | 'visitor'>(initialViewMode);
  
  // Sync local view mode with URL state
  useEffect(() => {
    setLocalViewMode(viewMode);
  }, [viewMode]);

  // Determine if owner controls should be shown
  const showOwnerControls = ownership.isOwner && localViewMode === 'owner';
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [pinsRefreshKey, setPinsRefreshKey] = useState(0);
  const [showPrivatePins, setShowPrivatePins] = useState(true); // Toggle for private pins visibility
  
  // Local pins state - starts with server-provided pins, can be updated client-side
  const [localPins, setLocalPins] = useState<ProfilePin[]>(initialPins);
  
  // Consolidated modal state
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  
  // Derived modal states for convenience
  const isCreatePinModalOpen = modalState.type === 'create-pin';
  const createPinCoordinates = modalState.type === 'create-pin' ? modalState.coordinates : null;

  // Filter pins for display based on ownership, view mode, and private pins toggle
  // Server already filters pins, but we need client-side filtering for "visitor view mode" and private toggle
  const displayPins = showOwnerControls 
    ? (showPrivatePins ? localPins : filterPinsForVisitor(localPins))
    : filterPinsForVisitor(localPins);

  // Temporary pin marker hook
  const { addTemporaryPin, removeTemporaryPin, updateTemporaryPinColor } = useTemporaryPinMarker({
    map: mapInstanceRef.current,
    mapLoaded,
  });

  // Consolidated effect: Close modal and remove temporary marker when:
  // 1. Switching to visitor view
  // 2. pinId appears in URL (user clicked existing pin)
  useEffect(() => {
    if (!isCreatePinModalOpen) return;

    const shouldClose = 
      localViewMode === 'visitor' || // Switching to visitor view
      (urlMentionId !== null); // User clicked existing mention

    if (shouldClose) {
      removeTemporaryPin();
      setModalState({ type: 'none' });
    }
  }, [localViewMode, urlMentionId, isCreatePinModalOpen, removeTemporaryPin]);

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
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: MAP_CONFIG.DEFAULT_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
          maxBounds: [
            [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
            [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
          ],
        });

        mapInstanceRef.current = mapInstance as unknown as MapboxMapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            
            // Add 3D building extrusions
            addBuildingExtrusions(mapInstance as any);
            
            // If there are pins, fly to fit all of them in view
            if (initialPins.length > 0) {
              // Small delay to ensure map is fully rendered before flying
              setTimeout(() => {
                if (!mounted || !mapInstance || (mapInstance as any).removed) return;
                
                if (initialPins.length === 1) {
                  // Single pin: fly directly to it
                  const pin = initialPins[0];
                  mapInstance.flyTo({
                    center: [pin.lng, pin.lat],
                    zoom: 14,
                    duration: 1500,
                    essential: true,
                  });
                } else {
                  // Multiple pins: fit bounds to show all
                  const lngs = initialPins.map(p => p.lng);
                  const lats = initialPins.map(p => p.lat);
                  const minLng = Math.min(...lngs);
                  const maxLng = Math.max(...lngs);
                  const minLat = Math.min(...lats);
                  const maxLat = Math.max(...lats);
                  
                  // Calculate dynamic padding based on spread
                  const lngSpread = maxLng - minLng;
                  const latSpread = maxLat - minLat;
                  const padding = Math.max(0.01, Math.min(0.1, Math.max(lngSpread, latSpread) * 0.15));
                  
                  mapInstance.fitBounds(
                    [
                      [minLng - padding, minLat - padding],
                      [maxLng + padding, maxLat + padding],
                    ],
                    { 
                      padding: { top: 100, bottom: 100, left: 100, right: 100 },
                      maxZoom: 15,
                      duration: 1500,
                    }
                  );
                }
              }, 100);
            }
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
          
          // Only log layer/source errors in development, don't show error UI
          // These are non-critical and handled by the PinsLayer component
          if (errorMessage.includes('source') || errorMessage.includes('layer')) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('[ProfileMap] Non-critical map error:', errorMessage);
            }
            return;
          }
          
          console.error('[ProfileMap] Map error:', errorMessage, e);
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
            console.warn('[ProfileMap] Error removing map instance:', err);
          }
        }
        mapInstanceRef.current = null;
      }
    };
  }, [initialPins]);

  // Debounced handler for creating pins (prevents rapid clicks from creating multiple markers)
  const handleMapClickForPinCreation = useCallback((e: any) => {
    const mapboxMap = mapInstanceRef.current as any;
    if (!mapboxMap) return;

    // Check if click hit a pin layer - if so, don't create new pin
    // Pin click handlers will handle opening the popup
    const pinLayers = ['profile-pins-point', 'profile-pins-point-label'];
    const features = mapboxMap.queryRenderedFeatures(e.point, {
      layers: pinLayers,
    });

    // If clicked on a pin, don't create new pin (pin click handler will handle it)
    if (features.length > 0) {
      return;
    }

    const lng = e.lngLat.lng;
    const lat = e.lngLat.lat;
    
    // Fly to clicked position with zoom 20
    mapboxMap.flyTo({
      center: [lng, lat],
      zoom: 20,
      duration: 1000,
    });
    
    // Add temporary pin marker at the clicked location
    addTemporaryPin({ lat, lng });
    
    // Set coordinates and open modal
    setModalState({ type: 'create-pin', coordinates: { lat, lng } });
  }, [addTemporaryPin]);

  // Debounce map clicks to prevent accidental multiple pin creation (300ms delay)
  const debouncedHandleMapClick = useDebounce(handleMapClickForPinCreation, 300);

  // Set up click handler for creating pins (only for owners, not in visitor view)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !showOwnerControls || !ownership.canCreatePin) return;

    mapInstanceRef.current.on('click', debouncedHandleMapClick);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', debouncedHandleMapClick);
      }
    };
  }, [mapLoaded, showOwnerControls, ownership.canCreatePin, debouncedHandleMapClick]);

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

    const mapboxMap = mapInstanceRef.current as any;
    
    // Common road layer patterns in Mapbox styles
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
      'link',
      'path',
      'pedestrian',
    ];

    try {
      const style = mapboxMap.getStyle();
      if (!style || !style.layers) return;

      style.layers.forEach((layer: any) => {
        const layerId = layer.id.toLowerCase();
        const isRoadLayer = roadLayerPatterns.some(pattern => 
          layerId.includes(pattern)
        );
        
        if (isRoadLayer) {
          try {
            mapboxMap.setLayoutProperty(
              layer.id,
              'visibility',
              visible ? 'visible' : 'none'
            );
          } catch (e) {
            // Layer might not support visibility, ignore
          }
        }
      });
    } catch (e) {
      console.warn('[ProfileMap] Error toggling road layers:', e);
    }
  }, [mapLoaded]);

  const handleMentionCreated = (newMention?: Mention) => {
    // Remove temporary pin marker
    removeTemporaryPin();
    
    // If we received the new mention data, add it optimistically
    if (newMention) {
      // Convert to ProfilePin format
      const profilePin: ProfilePin = {
        id: newMention.id,
        lat: newMention.lat,
        lng: newMention.lng,
        description: newMention.description,
        visibility: newMention.visibility as 'public' | 'only_me',
        created_at: newMention.created_at,
        updated_at: newMention.updated_at,
      };
      
      setLocalPins(prev => [profilePin, ...prev]);
      
      // Update URL with new pin ID to show it immediately
      setMentionId(newMention.id);
    }
    
    setPinsRefreshKey(prev => prev + 1);
    setModalState({ type: 'none' });
    // No page reload needed - mention added to local state
  };

  const handleCloseCreatePinModal = () => {
    // Remove temporary pin marker
    removeTemporaryPin();
    setModalState({ type: 'none' });
    
    // Clear any pinId from URL if modal was opened from a pin click
    // (but not if we're in the middle of creating a pin)
    if (urlMentionId && !createPinCoordinates) {
      clearMentionId();
    }
  };

  // Stable callback for ProfilePinsLayer to prevent unnecessary re-renders
  const handlePinArchived = useCallback((pinId: string) => {
    setLocalPins(prev => prev.filter(p => p.id !== pinId));
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Map Container - Full Viewport, adjusted for sidebar on xl screens */}
      <div 
        ref={mapContainer} 
        className="fixed inset-0 w-full h-full xl:w-[calc(100vw-225px)]"
        style={{ 
          height: '100vh', 
          margin: 0, 
          padding: 0, 
          overflow: 'hidden',
          zIndex: 1
        }}
      />

      {/* Owner Hint Overlay - Only show for owners (not in visitor view) */}
      {showOwnerControls && ownership.canCreatePin && mapLoaded && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            <p className="text-white text-[11px] font-medium">
              Click to create a pin • Click a pin to manage it
            </p>
          </div>
        </div>
      )}

      {/* Pins Layer - Only show this account's pins */}
      {mapLoaded && mapInstanceRef.current && (
        <ProfilePinsLayer
          key={pinsRefreshKey}
          map={mapInstanceRef.current}
          mapLoaded={mapLoaded}
          pins={displayPins}
          isOwnProfile={showOwnerControls}
          onPinArchived={handlePinArchived}
        />
      )}

      {/* Top Navigation */}
      <SimpleNav />

      {/* Map Toolbar - Below Nav */}
      <ProfileMapToolbar
        accountUsername={account.username}
        accountName={account.first_name ? `${account.first_name}${account.last_name ? ` ${account.last_name}` : ''}` : 'Profile'}
        pinCount={displayPins.length}
        map={mapInstanceRef.current}
        mapLoaded={mapLoaded}
        pins={displayPins as any}
        account={account}
        isOwnProfile={ownership.isOwner}
        isGuest={false}
        viewMode={ownership.isOwner ? localViewMode : undefined}
        onViewModeToggle={ownership.isOwner ? () => {
          const newMode = localViewMode === 'owner' ? 'visitor' : 'owner';
          
          // Clean up modal and temporary marker if switching to visitor
          if (newMode === 'visitor') {
            removeTemporaryPin();
            setModalState({ type: 'none' });
          }
          
          // Update URL state (clears pinId when switching to visitor)
          if (newMode === 'visitor') {
            setMentionIdAndView(null, 'visitor'); // Clear mentionId, set view=visitor
          } else {
            setView('owner'); // Just set view (pinId can stay if set)
          }
        } : undefined}
        showPrivatePins={showOwnerControls ? showPrivatePins : undefined}
        onTogglePrivatePins={showOwnerControls ? () => {
          setShowPrivatePins(prev => !prev);
          // Clear pinId when toggling private pins (pin visibility changes)
          if (urlMentionId) {
            clearMentionId();
          }
        } : undefined}
        onLocationSelect={(coordinates) => {
          if (mapInstanceRef.current && mapLoaded) {
            mapInstanceRef.current.flyTo({
              center: [coordinates.lng, coordinates.lat],
              zoom: 14,
              duration: 1500,
            });
          }
        }}
        onAccountUpdate={(updates) => {
          // Update local account state if needed
        }}
      />

      {/* Visitor Mode Banner - Show when in visitor view */}
      {ownership.isOwner && localViewMode === 'visitor' && (
        <div className="fixed top-[6rem] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-xs font-medium rounded-full shadow-lg">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Viewing as Visitor
          <button 
            onClick={() => {
              setView('owner');
            }}
            className="ml-1 p-0.5 hover:bg-orange-600 rounded transition-colors"
            title="Exit visitor view"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Map Controls - Bottom Right */}
      <ProfileMapControls
        map={mapInstanceRef.current}
        mapLoaded={mapLoaded}
        is3DMode={is3DMode}
        on3DToggle={handle3DToggle}
        roadsVisible={roadsVisible}
        onRoadsToggle={handleRoadsToggle}
      />

      {/* Pins Sidebar - Right side, only visible on xl screens (1200px+) */}
      <ProfilePinsSidebar
        pins={displayPins}
        isOwnProfile={ownership.isOwner}
        onPinClick={(pin) => {
          // Fly to pin location when clicked
          if (mapInstanceRef.current && mapLoaded) {
            mapInstanceRef.current.flyTo({
              center: [pin.lng, pin.lat],
              zoom: 14,
              duration: 1500,
            });
            // Set pinId in URL to show popup
            setMentionId(pin.id);
          }
        }}
      />

      {/* Create Pin Modal (only for owners, not in visitor view) */}
      {showOwnerControls && ownership.canCreatePin && (
        <CreateMentionModal
          isOpen={isCreatePinModalOpen}
          onClose={handleCloseCreatePinModal}
          coordinates={createPinCoordinates}
          onMentionCreated={handleMentionCreated}
          onBack={handleCloseCreatePinModal}
          onVisibilityChange={updateTemporaryPinColor}
          map={mapInstanceRef.current}
        />
      )}

      {/* Loading/Error Overlay */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-center">
            {mapError === 'missing-token' ? (
              <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                <div className="text-red-600 font-bold text-lg mb-2">Mapbox Token Missing</div>
                <div className="text-gray-700 text-sm mb-4">
                  Please set <code className="bg-gray-100 px-2 py-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in your <code className="bg-gray-100 px-2 py-1 rounded text-xs">.env.local</code> file.
                </div>
              </div>
            ) : mapError ? (
              <div className="bg-white border-2 border-red-500 rounded-lg p-6 max-w-md mx-4">
                <div className="text-red-600 font-bold text-lg mb-2">Map Error</div>
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
