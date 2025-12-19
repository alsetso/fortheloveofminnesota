'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMapboxGL } from '@/features/_archive/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/_archive/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import CreatePinModal from '@/components/_archive/map/CreatePinModal';
import SimpleNav from '@/components/SimpleNav';
import { usePageView } from '@/hooks/usePageView';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ProfilePinsLayer from './ProfilePinsLayer';
import ProfileMapControls from './ProfileMapControls';
import ProfileMapToolbar from './ProfileMapToolbar';
import { useProfileOwnership } from '@/hooks/useProfileOwnership';
import type { 
  ProfilePin, 
  ProfileAccount,
} from '@/types/profile';
import { filterPinsForVisitor } from '@/types/profile';

interface ProfileMapClientProps {
  account: ProfileAccount;
  pins: ProfilePin[];
  isOwnProfile: boolean;
}

// Consolidated modal state type
type ModalState = 
  | { type: 'none' }
  | { type: 'create-pin'; coordinates: { lat: number; lng: number } }
  | { type: 'debug' };

export default function ProfileMapClient({ 
  account, 
  pins: initialPins, 
  isOwnProfile: serverIsOwnProfile
}: ProfileMapClientProps) {
  usePageView();
  
  // Use ownership hook for consolidated ownership logic
  const ownership = useProfileOwnership({
    account,
    serverIsOwnProfile,
  });
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const temporaryMarkerRef = useRef<any>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [pinsRefreshKey, setPinsRefreshKey] = useState(0);
  
  // Local pins state - starts with server-provided pins, can be updated client-side
  const [localPins, setLocalPins] = useState<ProfilePin[]>(initialPins);
  
  // Consolidated modal state
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });
  
  // Track active popup for coordination with modals
  const [activePopupPinId, setActivePopupPinId] = useState<string | null>(null);
  
  // Derived modal states for convenience
  const isCreatePinModalOpen = modalState.type === 'create-pin';
  const isDebugModalOpen = modalState.type === 'debug';
  const createPinCoordinates = modalState.type === 'create-pin' ? modalState.coordinates : null;

  // Filter pins for display based on ownership and view mode
  const displayPins = ownership.canSeePrivatePins 
    ? localPins 
    : filterPinsForVisitor(localPins);

  // Add temporary pin marker on map
  const addTemporaryPin = useCallback(async (coordinates: { lat: number; lng: number }) => {
    if (!mapInstanceRef.current || !mapLoaded || (mapInstanceRef.current as any).removed) return;

    try {
      const mapbox = await loadMapboxGL();

      // Remove existing temporary marker if any
      if (temporaryMarkerRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }

      // Create temporary marker element with pulsing animation
      const el = document.createElement('div');
      el.className = 'temporary-pin-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: #ef4444;
        border: 3px solid #ffffff;
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        cursor: pointer;
        pointer-events: none;
      `;

      // Add animation keyframes if not already added
      if (!document.getElementById('temporary-marker-styles')) {
        const style = document.createElement('style');
        style.id = 'temporary-marker-styles';
        style.textContent = `
          @keyframes pulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            }
            50% {
              box-shadow: 0 0 0 12px rgba(239, 68, 68, 0);
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Create marker
      const marker = new mapbox.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([coordinates.lng, coordinates.lat])
        .addTo(mapInstanceRef.current);

      temporaryMarkerRef.current = marker;
    } catch (err) {
      console.error('Error creating temporary pin:', err);
    }
  }, [mapLoaded]);

  // Remove temporary pin marker
  const removeTemporaryPin = useCallback(() => {
    if (temporaryMarkerRef.current) {
      temporaryMarkerRef.current.remove();
      temporaryMarkerRef.current = null;
    }
  }, []);

  // Update temporary pin color based on visibility
  const updateTemporaryPinColor = useCallback((visibility: 'public' | 'only_me') => {
    if (!temporaryMarkerRef.current) return;
    
    const el = temporaryMarkerRef.current.getElement();
    if (!el) return;

    if (visibility === 'only_me') {
      // Grey color for private pins
      el.style.backgroundColor = '#6b7280';
      el.style.boxShadow = '0 0 0 0 rgba(107, 114, 128, 0.7)';
    } else {
      // Red color for public pins
      el.style.backgroundColor = '#ef4444';
      el.style.boxShadow = '0 0 0 0 rgba(239, 68, 68, 0.7)';
    }

    // Update keyframe animation colors
    const styleEl = document.getElementById('temporary-marker-styles');
    if (styleEl) {
      const color = visibility === 'only_me' ? '107, 114, 128' : '239, 68, 68';
      styleEl.textContent = `
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(${color}, 0.7);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(${color}, 0);
          }
        }
      `;
    }
  }, []);

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

        mapInstanceRef.current = mapInstance;

        mapInstance.on('load', () => {
          if (mounted) {
            setMapLoaded(true);
            
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

  // Set up click handler for creating pins (only for owners)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !ownership.canCreatePin) return;

    const handleClick = (e: any) => {
      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;
      
      // Add temporary pin marker at the clicked location
      addTemporaryPin({ lat, lng });
      
      // Set coordinates and open modal
      setModalState({ type: 'create-pin', coordinates: { lat, lng } });
    };

    mapInstanceRef.current.on('click', handleClick);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleClick);
      }
    };
  }, [mapLoaded, ownership.canCreatePin, addTemporaryPin]);

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

  const handlePinCreated = (newPin?: ProfilePin) => {
    // Remove temporary pin marker
    removeTemporaryPin();
    
    // If we received the new pin data, add it optimistically
    if (newPin) {
      setLocalPins(prev => [newPin, ...prev]);
    }
    
    setPinsRefreshKey(prev => prev + 1);
    setModalState({ type: 'none' });
    // No page reload needed - pin added to local state
  };

  const handleCloseCreatePinModal = () => {
    // Remove temporary pin marker
    removeTemporaryPin();
    setModalState({ type: 'none' });
  };

  // Stable callbacks for ProfilePinsLayer to prevent unnecessary re-renders
  const handlePinDeleted = useCallback((pinId: string) => {
    setLocalPins(prev => prev.filter(p => p.id !== pinId));
    setActivePopupPinId(null);
  }, []);

  const handlePopupOpen = useCallback((pinId: string) => {
    setActivePopupPinId(pinId);
  }, []);

  const handlePopupClose = useCallback(() => {
    setActivePopupPinId(null);
  }, []);

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

      {/* Owner Hint Overlay - Only show for owners */}
      {ownership.canCreatePin && mapLoaded && (
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
          isOwnProfile={ownership.canEdit}
          onPinDeleted={handlePinDeleted}
          onPopupOpen={handlePopupOpen}
          onPopupClose={handlePopupClose}
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
        pins={displayPins}
        account={account}
        isOwnProfile={ownership.isOwner}
        viewMode={ownership.isOwner ? ownership.viewMode : undefined}
        onViewModeToggle={ownership.isOwner ? ownership.toggleViewMode : undefined}
        onLocationSelect={(coordinates) => {
          if (mapInstanceRef.current && mapLoaded) {
            mapInstanceRef.current.flyTo({
              center: [coordinates.lng, coordinates.lat],
              zoom: 14,
              duration: 1500,
              essential: true,
            });
          }
        }}
        onAccountUpdate={(updates) => {
          // Update local account state if needed
        }}
      />

      {/* Visitor Mode Banner */}
      {ownership.isOwner && ownership.viewMode === 'visitor' && (
        <div className="fixed top-[6rem] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-xs font-medium rounded-full shadow-lg">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Viewing as Visitor
          <button 
            onClick={() => ownership.setViewMode('owner')}
            className="ml-1 p-0.5 hover:bg-orange-600 rounded transition-colors"
            title="Exit visitor view"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Debug Info Button - Bottom Left (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => setModalState({ type: 'debug' })}
          className="fixed bottom-4 left-4 z-30 flex items-center gap-1.5 px-2 py-1.5 bg-gray-900/80 text-white text-[10px] font-medium rounded hover:bg-gray-900 transition-colors"
          title="View profile debug info"
        >
          <InformationCircleIcon className="w-3.5 h-3.5" />
          Debug
        </button>
      )}

      {/* Debug Modal */}
      {isDebugModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Profile Debug Info</h3>
              <button
                onClick={() => setModalState({ type: 'none' })}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Profile Being Viewed */}
              <div>
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Profile Being Viewed
                </h4>
                <div className="bg-gray-50 rounded p-3 space-y-1 text-xs">
                  <div><span className="text-gray-500">Account ID:</span> <span className="font-mono text-gray-900">{account.id}</span></div>
                  <div><span className="text-gray-500">Username:</span> <span className="font-mono text-gray-900">@{account.username || 'none'}</span></div>
                  <div><span className="text-gray-500">User ID:</span> <span className="font-mono text-gray-900">{account.user_id || 'null (guest)'}</span></div>
                  <div><span className="text-gray-500">Guest ID:</span> <span className="font-mono text-gray-900">{account.guest_id || 'null'}</span></div>
                  <div><span className="text-gray-500">Name:</span> <span className="text-gray-900">{account.first_name} {account.last_name}</span></div>
                </div>
              </div>

              {/* Current Viewer */}
              <div>
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Current Viewer (You)
                </h4>
                <div className="bg-gray-50 rounded p-3 space-y-1 text-xs">
                  {ownership.viewer ? (
                    <>
                      <div><span className="text-gray-500">Type:</span> <span className={`font-medium ${ownership.viewer.type === 'authenticated' ? 'text-green-600' : ownership.viewer.type === 'guest' ? 'text-blue-600' : 'text-gray-600'}`}>{ownership.viewer.type}</span></div>
                      {ownership.viewer.userId && <div><span className="text-gray-500">User ID:</span> <span className="font-mono text-gray-900">{ownership.viewer.userId}</span></div>}
                      {ownership.viewer.email && <div><span className="text-gray-500">Email:</span> <span className="text-gray-900">{ownership.viewer.email}</span></div>}
                      {ownership.viewer.guestId && <div><span className="text-gray-500">Guest ID:</span> <span className="font-mono text-gray-900">{ownership.viewer.guestId}</span></div>}
                    </>
                  ) : (
                    <div className="text-gray-500">Loading...</div>
                  )}
                </div>
              </div>

              {/* Ownership Status */}
              <div>
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Ownership Status
                </h4>
                <div className={`rounded p-3 text-xs ${ownership.canEdit ? 'bg-green-50 border border-green-200' : ownership.viewMode === 'visitor' ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className={`font-semibold ${ownership.canEdit ? 'text-green-700' : ownership.isOwner ? 'text-orange-700' : 'text-red-700'}`}>
                    {ownership.isOwner && ownership.viewMode === 'visitor'
                      ? '👁 Viewing as Visitor (your profile)' 
                      : ownership.canEdit 
                        ? '✓ This is YOUR profile' 
                        : '✗ This is NOT your profile'}
                  </div>
                  <div className="mt-1 text-gray-600 space-y-0.5">
                    <div>Owner: {ownership.isOwner ? '✓ yes' : '✗ no'}</div>
                    <div>View mode: {ownership.viewMode}</div>
                  </div>
                </div>
              </div>

              {/* View as Visitor Toggle (only show if owner) */}
              {ownership.isOwner && (
                <div>
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    View Mode
                  </h4>
                  <div className="bg-gray-50 rounded p-3">
                    <button
                      onClick={() => ownership.toggleViewMode()}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded transition-colors ${
                        ownership.viewMode === 'visitor' 
                          ? 'bg-orange-500 text-white hover:bg-orange-600' 
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {ownership.viewMode === 'visitor' ? (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                          Exit Visitor View
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                          View as Visitor
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-[10px] text-gray-500 text-center">
                      {ownership.viewMode === 'visitor'
                        ? 'Currently viewing as a visitor would see your profile.' 
                        : 'See how visitors view your profile.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Permissions */}
              <div>
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Your Permissions
                </h4>
                <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={ownership.canCreatePin ? 'text-green-600' : 'text-red-600'}>{ownership.canCreatePin ? '✓' : '✗'}</span>
                    <span className="text-gray-700">Can create pins (click map)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={ownership.canSeePrivatePins ? 'text-green-600' : 'text-red-600'}>{ownership.canSeePrivatePins ? '✓' : '✗'}</span>
                    <span className="text-gray-700">Can see private pins</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={ownership.canEdit ? 'text-green-600' : 'text-red-600'}>{ownership.canEdit ? '✓' : '✗'}</span>
                    <span className="text-gray-700">Can edit profile</span>
                  </div>
                </div>
              </div>

              {/* Pin Stats */}
              <div>
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Pins Data
                </h4>
                <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
                  <div><span className="text-gray-500">Total pins loaded:</span> <span className="font-semibold text-gray-900">{localPins.length}</span></div>
                  <div><span className="text-gray-500">Public:</span> <span className="text-gray-900">{localPins.filter(p => p.visibility === 'public').length}</span></div>
                  <div><span className="text-gray-500">Private:</span> <span className="text-gray-900">{localPins.filter(p => p.visibility === 'only_me').length}</span></div>
                  {ownership.viewMode === 'visitor' && (
                    <div className="pt-1 border-t border-gray-200 mt-1">
                      <span className="text-orange-600">Displayed (visitor mode):</span> <span className="font-semibold text-orange-700">{displayPins.length}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
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

      {/* Create Pin Modal (only for owners) */}
      {ownership.canCreatePin && (
        <CreatePinModal
          isOpen={isCreatePinModalOpen}
          onClose={handleCloseCreatePinModal}
          coordinates={createPinCoordinates}
          onPinCreated={handlePinCreated}
          onBack={handleCloseCreatePinModal}
          onVisibilityChange={updateTemporaryPinColor}
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
