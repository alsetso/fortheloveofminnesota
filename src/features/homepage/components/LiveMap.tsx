'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { loadMapboxGL } from '@/features/map/utils/mapboxLoader';
import { MAP_CONFIG } from '@/features/map/config';
import type { MapboxMapInstance } from '@/types/mapbox-events';
import MentionsLayer from '@/features/map/components/MentionsLayer';
import AtlasLayer from '@/features/atlas/components/AtlasLayer';
import { useAuthStateSafe } from '@/features/auth';
import { usePageView } from '@/hooks/usePageView';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useUrlMapState } from '../hooks/useUrlMapState';
import PointsOfInterestLayer from '@/features/map/components/PointsOfInterestLayer';
import MobileNavTabs, { type MobileNavTab } from '@/components/layout/MobileNavTabs';
import MobileNavSheet from '@/components/layout/MobileNavSheet';
import MapTopContainer from '@/components/layout/MapTopContainer';
import MapEntityPopup from '@/components/layout/MapEntityPopup';
import NearbyPlacesContainer from '@/components/layout/NearbyPlacesContainer';
import Map3DControlsSecondaryContent from '@/features/sidebar/components/Map3DControlsSecondaryContent';
import ContributeContent from '@/components/layout/ContributeContent';
import NewsContent from '@/components/layout/NewsContent';
import CreateMentionContent from '@/components/layout/CreateMentionContent';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import { useMapOverlayState } from '../hooks/useMapOverlayState';

// Helper to format last generation timestamp
function formatLastGeneration(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

interface LiveMapProps {
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

export default function LiveMap({ cities, counties }: LiveMapProps) {
  // Track page view
  usePageView();
  const pathname = usePathname();
  
  // Map state
  const mapContainer = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const mapInstanceRef = useRef<MapboxMapInstance | null>(null);
  const [mentionsRefreshKey, setMentionsRefreshKey] = useState(0);
  const initializedRef = useRef(false);
  const hoveredMentionIdRef = useRef<string | null>(null);
  const isHoveringMentionRef = useRef(false);
  const temporaryMarkerRef = useRef<any>(null);
  const [createTabSelectedLocation, setCreateTabSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [createTabAtlasMeta, setCreateTabAtlasMeta] = useState<Record<string, any> | null>(null);
  
  // Points of Interest layer visibility state
  const [isPointsOfInterestVisible, setIsPointsOfInterestVisible] = useState(false);
  
  // Atlas layer visibility state (default true)
  const [isAtlasLayerVisible, setIsAtlasLayerVisible] = useState(true);
  
  // Unified overlay state management
  const {
    activeTab,
    popupData,
    openTab,
    closeTab,
    openCreate,
    closeCreate,
    openPopup,
    closePopup,
    closeAll,
    isOverlayOpen,
  } = useMapOverlayState();
  
  const activeTabRef = useRef<MobileNavTab | null>(null);
  
  // Keep ref in sync with activeTab for use in map click handler
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  
  // Atlas entity state (managed at parent level)
  const [selectedAtlasEntity, setSelectedAtlasEntity] = useState<{
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
  } | null>(null);
  
  // Modal controls (modals rendered globally, but we need access to open functions)
  const { isModalOpen, openWelcome, openAccount } = useAppModalContextSafe();
  
  // URL-based state (only year filter)
  useUrlMapState();
  
  // Auth state from unified context - use isLoading to ensure auth is initialized
  const {
    user,
    account,
    isLoading: authLoading,
  } = useAuthStateSafe();

  const isAdmin = account?.role === 'admin';
  const [lastNewsGeneration, setLastNewsGeneration] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

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

  // Fetch last news generation timestamp when News tab opens
  useEffect(() => {
    if (activeTab === 'news' && isAdmin) {
      fetch('/api/news/latest')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setLastNewsGeneration(data.data.generatedAt || data.data.createdAt || null);
          }
        })
        .catch(err => console.error('Failed to fetch last generation:', err));
    }
  }, [activeTab, isAdmin]);

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

  // Listen for live account modal open/close to hide/show mobile nav
  useEffect(() => {
    const handleAccountModalChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isOpen: boolean }>;
      setIsAccountModalOpen(customEvent.detail?.isOpen || false);
    };

    window.addEventListener('live-account-modal-change', handleAccountModalChange);
    return () => {
      window.removeEventListener('live-account-modal-change', handleAccountModalChange);
    };
  }, []);

  // Handle atlas entity click
  const handleAtlasEntityClick = useCallback(async (entity: {
    id: string;
    name: string;
    table_name: string;
    lat: number;
    lng: number;
    icon_path?: string | null;
  }) => {
    setSelectedAtlasEntity(entity);
    
    // Remove red pin marker when clicking on an atlas entity
    if (temporaryMarkerRef.current) {
      temporaryMarkerRef.current.remove();
      temporaryMarkerRef.current = null;
    }
    
    // Fly to location
    if (mapInstanceRef.current && mapLoaded && entity.lat && entity.lng) {
      const mapboxMap = mapInstanceRef.current as any;
      const currentZoom = mapboxMap.getZoom();
      const targetZoom = Math.max(currentZoom, 14); // Ensure we zoom in at least to level 14
      
      mapboxMap.flyTo({
        center: [entity.lng, entity.lat],
        zoom: targetZoom,
        duration: 800,
        essential: true,
      });
    }
    
    // Fetch atlas type for icon
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await (supabase as any)
        .schema('atlas')
        .from('atlas_types')
        .select('icon_path')
        .eq('slug', entity.table_name)
        .single();
      
      openPopup('atlas', {
        ...entity,
        icon_path: data?.icon_path || null,
        coordinates: { lat: entity.lat, lng: entity.lng },
      });
    } catch (error) {
      console.error('Error fetching atlas type:', error);
      openPopup('atlas', {
        ...entity,
        coordinates: { lat: entity.lat, lng: entity.lng },
      });
    }
  }, [mapLoaded, openPopup]);

  // Handle tab click - toggle sheet
  const handleTabClick = useCallback((tab: MobileNavTab) => {
    if (activeTab === tab) {
      closeTab();
      // No need to clear Create sheet state here since it's managed separately
    } else {
      openTab(tab);
    }
  }, [activeTab, openTab, closeTab]);

  // Listen for mention click events to show popup
  useEffect(() => {
    const handleMentionClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ mention: any }>;
      const mention = customEvent.detail?.mention;
      if (mention) {
        // Remove red pin marker when clicking on a mention
        if (temporaryMarkerRef.current) {
          temporaryMarkerRef.current.remove();
          temporaryMarkerRef.current = null;
        }
        openPopup('pin', {
          id: mention.id,
          description: mention.description,
          account: mention.account,
          account_id: mention.account_id,
          created_at: mention.created_at,
        });
      }
    };

    window.addEventListener('mention-click', handleMentionClick);
    return () => {
      window.removeEventListener('mention-click', handleMentionClick);
    };
  }, [openPopup]);

  // Listen for atlas entity click events from search
  useEffect(() => {
    const handleAtlasEntityClickEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        id: string;
        name: string;
        table_name: string;
        lat: number;
        lng: number;
      }>;
      const entity = customEvent.detail;
      if (entity) {
        handleAtlasEntityClick(entity);
      }
    };

    window.addEventListener('atlas-entity-click', handleAtlasEntityClickEvent);
    return () => {
      window.removeEventListener('atlas-entity-click', handleAtlasEntityClickEvent);
    };
  }, [handleAtlasEntityClick]);

  // Listen for show-location-for-mention event (from "Add Label" button in location/atlas popup)
  useEffect(() => {
    const handleShowLocationForMention = (event: Event) => {
      const customEvent = event as CustomEvent<{
        lat: number;
        lng: number;
        atlas_meta?: Record<string, any>;
      }>;
      const { lat, lng, atlas_meta } = customEvent.detail || {};
      if (lat && lng) {
        // Close any open popup and tabs, then open Create sheet
        closeAll();
        setCreateTabSelectedLocation({ lat, lng });
        setCreateTabAtlasMeta(atlas_meta || null);
        openCreate({ lat, lng, atlas_meta });
      }
    };

    window.addEventListener('show-location-for-mention', handleShowLocationForMention);
    return () => {
      window.removeEventListener('show-location-for-mention', handleShowLocationForMention);
    };
  }, [closePopup, closeTab]);

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
          pitch: 0, // Start at 0% angle
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
          }
        });

        // Handle single click for location popup
        mapInstance.on('click', async (e: any) => {
          if (!mounted) return;
          
          // Check if click hit a mention or atlas layer - those have their own handlers
          const mentionLayers = ['map-mentions-point', 'map-mentions-point-label'];
          const atlasLayers = ['atlas-entities-point', 'atlas-entities-point-label'];
          const hitRadius = 20;
          const box: [[number, number], [number, number]] = [
            [e.point.x - hitRadius, e.point.y - hitRadius],
            [e.point.x + hitRadius, e.point.y + hitRadius]
          ];
          
          const mapboxMap = mapInstance as any;
          
          // Check if mention layers exist before querying (they may not be loaded yet)
          let mentionFeatures: any[] = [];
          try {
            const existingMentionLayers = mentionLayers.filter(layerId => {
              try {
                return mapboxMap.getLayer(layerId) !== undefined;
              } catch {
                return false;
              }
            });
            
            if (existingMentionLayers.length > 0) {
              mentionFeatures = mapboxMap.queryRenderedFeatures(box, {
                layers: existingMentionLayers,
              });
            }
          } catch (queryError) {
            // Silently continue if query fails (layers don't exist)
          }
          
          // Check if atlas layers exist before querying (they may not be loaded yet)
          let atlasFeatures: any[] = [];
          try {
            const existingAtlasLayers = atlasLayers.filter(layerId => {
              try {
                return mapboxMap.getLayer(layerId) !== undefined;
              } catch {
                return false;
              }
            });
            
            if (existingAtlasLayers.length > 0) {
              atlasFeatures = mapboxMap.queryRenderedFeatures(box, {
                layers: existingAtlasLayers,
              });
            }
          } catch (queryError) {
            // Silently continue if query fails (layers don't exist)
          }

          // If clicked on a mention or atlas entity, don't show location popup
          if (mentionFeatures.length > 0 || atlasFeatures.length > 0) {
            return;
          }
          
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          
          // Check if click is within Minnesota bounds
          if (!MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
            // Show error message or silently ignore clicks outside Minnesota
            console.warn('[LiveMap] Click outside Minnesota bounds:', { lat, lng });
            return;
          }
          
          // If Create sheet is open, update the selected location
          if (isOverlayOpen('create')) {
            setCreateTabSelectedLocation({ lat, lng });
            return;
          }
          
          // Add red pin marker at clicked location
          const addRedPinMarker = async () => {
            const currentMap = mapInstanceRef.current;
            if (!currentMap || (currentMap as any).removed) return;
            
            try {
              const mapbox = await loadMapboxGL();
              
              // Remove existing temporary marker if any
              if (temporaryMarkerRef.current) {
                temporaryMarkerRef.current.remove();
                temporaryMarkerRef.current = null;
              }
              
              // Create white pin marker element with black dot
              const el = document.createElement('div');
              el.className = 'map-click-pin-marker';
              
              // Add pulsing animation style
              const styleId = 'map-click-pin-marker-style';
              if (!document.head.querySelector(`#${styleId}`)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                  @keyframes pulse-white {
                    0%, 100% {
                      opacity: 1;
                    }
                    50% {
                      opacity: 0.7;
                    }
                  }
                  .map-click-pin-marker {
                    animation: pulse-white 1.5s ease-in-out infinite;
                  }
                `;
                document.head.appendChild(style);
              }
              
              el.style.cssText = `
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background-color: white;
                border: 1.5px solid rgba(0, 0, 0, 0.2);
                cursor: pointer;
                pointer-events: none;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
              `;
              
              // Add black dot in the middle
              const dot = document.createElement('div');
              dot.style.cssText = `
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: #000000;
                position: absolute;
              `;
              el.appendChild(dot);
              
              // Create marker
              const marker = new mapbox.Marker({
                element: el,
                anchor: 'center',
              })
                .setLngLat([lng, lat])
                .addTo(currentMap as any);
              
              temporaryMarkerRef.current = marker;
            } catch (err) {
              console.error('[LiveMap] Error creating red pin marker:', err);
            }
          };
          
          await addRedPinMarker();
          
          // Incrementally zoom in on click
          const currentZoom = mapboxMap.getZoom();
          const zoomIncrement = 1.5;
          const targetZoom = Math.min(currentZoom + zoomIncrement, MAP_CONFIG.MAX_ZOOM);
          
          // Only zoom if we haven't reached max zoom
          if (targetZoom > currentZoom) {
            mapboxMap.flyTo({
              center: [lng, lat],
              zoom: targetZoom,
              duration: 1000,
              essential: true,
            });
          }
          
          // Reverse geocode to get place name
          try {
            const token = MAP_CONFIG.MAPBOX_TOKEN;
            if (token) {
              const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`;
              const params = new URLSearchParams({
                access_token: token,
                types: 'address,poi,place',
                limit: '1',
              });
              
              const response = await fetch(`${url}?${params}`);
              if (response.ok) {
                const data = await response.json();
                const feature = data.features?.[0];
                
                openPopup('location', {
                  place_name: feature?.place_name || 'Location',
                  address: feature?.place_name || '',
                  coordinates: { lat, lng },
                });
              } else {
                // Fallback if geocoding fails
                openPopup('location', {
                  place_name: 'Location',
                  coordinates: { lat, lng },
                });
              }
            } else {
              // Fallback if no token
              openPopup('location', {
                place_name: 'Location',
                coordinates: { lat, lng },
              });
            }
          } catch (error) {
            console.error('Reverse geocoding error:', error);
            openPopup('location', {
              place_name: 'Location',
              coordinates: { lat, lng },
            });
          }
        });

        // Handle double-click to select location
        mapInstance.on('dblclick', (e: any) => {
          if (!mounted) return;
          
          // Prevent mention creation if hovering over a mention
          if (isHoveringMentionRef.current || hoveredMentionIdRef.current) {
            return;
          }
          
          // Check if click hit a mention layer - if so, don't create new mention
          // Mention click handlers will handle opening the popup
          const mentionLayers = ['map-mentions-point', 'map-mentions-point-label'];
          // Query a box around the click point (20px radius) for larger clickable area
          const hitRadius = 20;
          const box: [[number, number], [number, number]] = [
            [e.point.x - hitRadius, e.point.y - hitRadius],
            [e.point.x + hitRadius, e.point.y + hitRadius]
          ];
          const features = (mapInstance as any).queryRenderedFeatures(box, {
            layers: mentionLayers,
          });

          // If clicked on a mention, don't create new mention (mention click handler will handle it)
          if (features.length > 0) {
            return;
          }
          
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          // Dispatch event for location selection (can be handled by other components)
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
          
          console.error('[LiveMap] Map error:', errorMessage);
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
      // Remove temporary marker on cleanup
      if (temporaryMarkerRef.current) {
        try {
          temporaryMarkerRef.current.remove();
        } catch {
          // Ignore cleanup errors
        }
        temporaryMarkerRef.current = null;
      }
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <div 
        className="relative flex-1 w-full overflow-hidden flex"
        style={{ height: '100vh' }}
      >
        {/* Map and other components - no sidebar */}
        <div className="flex-1 flex relative overflow-hidden">
          {/* Map Top Container - Search and Categories */}
          <MapTopContainer
            map={mapInstanceRef.current}
            onLocationSelect={(coordinates, placeName, mapboxMetadata) => {
              if (mapInstanceRef.current && mapLoaded) {
                mapInstanceRef.current.flyTo({
                  center: [coordinates.lng, coordinates.lat],
                  zoom: 15,
                  duration: 1500,
                });
              }
            }}
          />


          {/* Mapbox Container */}
          <div 
            ref={mapContainer} 
            className="flex-1 w-full h-full"
            style={{ margin: 0, padding: 0, overflow: 'hidden', zIndex: 1 }}
          />

          {/* Mentions Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <MentionsLayer key={mentionsRefreshKey} map={mapInstanceRef.current} mapLoaded={mapLoaded} />
          )}

          {/* Atlas Layer - Cities, Schools, Parks */}
          {mapLoaded && mapInstanceRef.current && (
            <AtlasLayer 
              map={mapInstanceRef.current} 
              mapLoaded={mapLoaded} 
              visible={isAtlasLayerVisible}
              onEntityClick={handleAtlasEntityClick}
            />
          )}

          {/* Points of Interest Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <PointsOfInterestLayer 
              map={mapInstanceRef.current} 
              mapLoaded={mapLoaded} 
              visible={isPointsOfInterestVisible} 
            />
          )}


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

      {/* Mobile Nav Tabs - Fixed bottom bar - Hidden when account modal is open */}
      {!isAccountModalOpen && (
        <MobileNavTabs
          activeTab={activeTab}
          onTabClick={handleTabClick}
        />
      )}

      {/* News Sheet */}
      <MobileNavSheet
        isOpen={activeTab === 'news'}
        onClose={closeTab}
        title="News"
        showSearch={true}
        map={mapInstanceRef.current}
        onLocationSelect={(coordinates, placeName) => {
          if (mapInstanceRef.current && mapLoaded) {
            mapInstanceRef.current.flyTo({
              center: [coordinates.lng, coordinates.lat],
              zoom: 15,
              duration: 1500,
            });
          }
        }}
        headerAction={
          isAdmin ? (
            <div className="flex items-center gap-2">
              {lastNewsGeneration && (
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {formatLastGeneration(lastNewsGeneration)}
                </span>
              )}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('generate-news'));
                }}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                title="Generate News"
              >
                Generate
              </button>
            </div>
          ) : undefined
        }
      >
        <NewsContent onGenerationComplete={() => {
          // Fetch latest generation timestamp after generation
          fetch('/api/news/latest')
            .then(res => res.json())
            .then(data => {
              if (data.success && data.data) {
                setLastNewsGeneration(data.data.generatedAt || data.data.createdAt || null);
              }
            })
            .catch(err => console.error('Failed to fetch last generation:', err));
        }} />
      </MobileNavSheet>

      {/* Explore Sheet */}
      <MobileNavSheet
        isOpen={activeTab === 'explore'}
        onClose={closeTab}
        title="Explore"
        showSearch={true}
        map={mapInstanceRef.current}
        onLocationSelect={(coordinates, placeName) => {
          if (mapInstanceRef.current && mapLoaded) {
            mapInstanceRef.current.flyTo({
              center: [coordinates.lng, coordinates.lat],
              zoom: 15,
              duration: 1500,
            });
          }
        }}
      >
        <NearbyPlacesContainer
          map={mapInstanceRef.current}
          mapLoaded={mapLoaded}
          isVisible={activeTab === 'explore'}
        />
      </MobileNavSheet>

      {/* Create Sheet - Only opened via "Add Label" button */}
      <MobileNavSheet
        isOpen={isOverlayOpen('create')}
        onClose={() => {
          closeCreate();
          setCreateTabSelectedLocation(null);
          setCreateTabAtlasMeta(null);
        }}
        title="Create"
        showSearch={true}
        map={mapInstanceRef.current}
        onLocationSelect={(coordinates, placeName) => {
          if (mapInstanceRef.current && mapLoaded) {
            mapInstanceRef.current.flyTo({
              center: [coordinates.lng, coordinates.lat],
              zoom: 15,
              duration: 1500,
            });
            setCreateTabSelectedLocation({ lat: coordinates.lat, lng: coordinates.lng });
            // Clear atlas meta when user selects a new location
            setCreateTabAtlasMeta(null);
          }
        }}
        contentPadding={false}
      >
        {createTabSelectedLocation ? (
          <CreateMentionContent
            map={mapInstanceRef.current}
            mapLoaded={mapLoaded}
            initialCoordinates={createTabSelectedLocation}
            initialAtlasMeta={createTabAtlasMeta}
            onMentionCreated={() => {
              closeCreate();
              setCreateTabSelectedLocation(null);
              setCreateTabAtlasMeta(null);
              setMentionsRefreshKey(prev => prev + 1);
            }}
          />
        ) : (
          <div className="space-y-3 p-4">
            <p className="text-xs text-gray-600">
              Click on the map to select a location, then create a mention.
            </p>
          </div>
        )}
      </MobileNavSheet>

      {/* Controls Sheet */}
      <MobileNavSheet
        isOpen={activeTab === 'controls'}
        onClose={closeTab}
        title="Map Controls"
      >
        <Map3DControlsSecondaryContent 
          map={mapInstanceRef.current} 
          pointsOfInterestVisible={isPointsOfInterestVisible}
          onPointsOfInterestVisibilityChange={setIsPointsOfInterestVisible}
        />
      </MobileNavSheet>

      {/* Contribute Sheet */}
      <MobileNavSheet
        isOpen={activeTab === 'contribute'}
        onClose={closeTab}
        title="Contribute"
      >
        <ContributeContent map={mapInstanceRef.current} mapLoaded={mapLoaded} />
      </MobileNavSheet>

      {/* Map Entity Popup - Above mobile nav */}
      <MapEntityPopup
        isOpen={popupData.type !== null}
        onClose={() => {
          closePopup();
          // Remove red pin marker when popup closes
          if (temporaryMarkerRef.current) {
            temporaryMarkerRef.current.remove();
            temporaryMarkerRef.current = null;
          }
        }}
        type={popupData.type}
        data={popupData.data}
      />

      {/* Modals handled globally via AppModalContext/GlobalModals */}
    </div>
  );
}

