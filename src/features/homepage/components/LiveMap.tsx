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
import MobileNavPopup from '@/components/layout/MobileNavPopup';
import MapTopContainer from '@/components/layout/MapTopContainer';
import MapEntityPopup from '@/components/layout/MapEntityPopup';
import Map3DControlsSecondaryContent from '@/features/sidebar/components/Map3DControlsSecondaryContent';
import ContributeContent from '@/components/layout/ContributeContent';
import NewsContent from '@/components/layout/NewsContent';
import ToolsContent from '@/components/layout/ToolsContent';
import CreateMentionPopup from '@/components/layout/CreateMentionPopup';
import DailyWelcomeModal from '@/components/layout/DailyWelcomeModal';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import { useLivePageModals } from '../hooks/useLivePageModals';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import CongressionalDistrictsLayer from '@/features/map/components/CongressionalDistrictsLayer';
import CongressionalDistrictHoverInfo from '@/components/layout/CongressionalDistrictHoverInfo';
import CTUHoverInfo from '@/components/layout/CTUHoverInfo';
import GovernmentBuildingsLayer from '@/features/map/components/GovernmentBuildingsLayer';
import CTUBoundariesLayer from '@/features/map/components/CTUBoundariesLayer';
import BuildingDetailView from '@/features/admin/components/BuildingDetailView';

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
  const isTransitioningToCreateRef = useRef(false);
  const [createTabSelectedLocation, setCreateTabSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [createTabAtlasMeta, setCreateTabAtlasMeta] = useState<Record<string, any> | null>(null);
  const [createTabMapMeta, setCreateTabMapMeta] = useState<Record<string, any> | null>(null);
  const [createTabFullAddress, setCreateTabFullAddress] = useState<string | null>(null);
  
  // Points of Interest layer visibility state
  const [isPointsOfInterestVisible, setIsPointsOfInterestVisible] = useState(false);
  
  // Atlas layer visibility state (disabled - hiding all atlas entities)
  const [isAtlasLayerVisible, setIsAtlasLayerVisible] = useState(false);
  
  // Congressional districts visibility state
  const [showDistricts, setShowDistricts] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState<any | null>(null);
  
  // Government buildings visibility state
  const [showBuildings, setShowBuildings] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<any | null>(null);
  
  // CTU boundaries visibility state
  const [showCTU, setShowCTU] = useState(false);
  const [hoveredCTU, setHoveredCTU] = useState<any | null>(null);
  
  // Unified modal state management
  const {
    activeTab,
    popupData,
    isAccountModalOpen,
    openTab,
    closeTab,
    openCreate,
    closeCreate,
    openPopup,
    closePopup,
    openAccount,
    openMapStyles,
    openDynamicSearch,
    closeAccount,
    closeMapStyles,
    closeDynamicSearch,
    closeAll,
    isModalOpen,
  } = useLivePageModals();
  
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
  const { openWelcome, closeModal, modal } = useAppModalContextSafe();
  
  // URL-based state (only year filter)
  useUrlMapState();
  
  // Auth state from unified context - use isLoading to ensure auth is initialized
  const {
    user,
    account,
    isLoading: authLoading,
  } = useAuthStateSafe();

  // Show welcome modal for unauthenticated users and keep it open until authenticated
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    // If user is not authenticated, open welcome modal
    if (!user) {
      if (modal.type !== 'welcome') {
        openWelcome();
      }
    } else {
      // If user becomes authenticated, close welcome modal
      if (modal.type === 'welcome') {
        closeModal();
      }
    }
  }, [user, authLoading, modal.type, openWelcome, closeModal]);

  const isAdmin = account?.role === 'admin';
  const [lastNewsGeneration, setLastNewsGeneration] = useState<string | null>(null);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });
  const [showDailyWelcome, setShowDailyWelcome] = useState(false);

  // Show welcome toast when page loads (for authenticated users)
  useEffect(() => {
    if (!user || !account || !mapLoaded || authLoading) return undefined;

    let hideTimer: NodeJS.Timeout | null = null;

    // Small delay to ensure map is fully rendered
    const showWelcome = setTimeout(() => {
      setShowDailyWelcome(true);
      
      // Auto-hide after 3 seconds (toast behavior)
      hideTimer = setTimeout(() => {
        setShowDailyWelcome(false);
      }, 3000);
    }, 500); // 500ms delay after map loads

    return () => {
      clearTimeout(showWelcome);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [user, account, mapLoaded, authLoading]);

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

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

    const handleRemoveTempPin = () => {
      if (temporaryMarkerRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }
    };

    window.addEventListener('mention-created', handleMentionCreatedEvent);
    window.addEventListener('mention-created-remove-temp-pin', handleRemoveTempPin);
    return () => {
      window.removeEventListener('mention-created', handleMentionCreatedEvent);
      window.removeEventListener('mention-created-remove-temp-pin', handleRemoveTempPin);
    };
  }, []);

  // Listen for live account modal open/close to hide/show mobile nav and close all overlays
  useEffect(() => {
    const handleAccountModalChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isOpen: boolean }>;
      const isOpen = customEvent.detail?.isOpen || false;
      
      // Close all overlays when account modal opens
      if (isOpen) {
        openAccount();
      } else {
        // Modal state is managed by useLivePageModals, no need to set local state
      }
    };

    window.addEventListener('live-account-modal-change', handleAccountModalChange);
    return () => {
      window.removeEventListener('live-account-modal-change', handleAccountModalChange);
    };
  }, [openAccount]);

  // Maintain preview marker when create sheet is open
  useEffect(() => {
    const isCreateOpen = isModalOpen('create');
    if (isCreateOpen && createTabSelectedLocation && account && mapInstanceRef.current && !(mapInstanceRef.current as any).removed) {
      // Ensure marker exists and is properly positioned
      const ensurePreviewMarker = async () => {
        try {
          const mapbox = await import('mapbox-gl');
          const currentMap = mapInstanceRef.current;
          if (!currentMap || (currentMap as any).removed) return;

          const { lat, lng } = createTabSelectedLocation;

          // If marker doesn't exist or is at wrong position, create/update it
          if (!temporaryMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'mention-preview-marker';
            el.style.cssText = `
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            `;

            // Account image circle
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = `
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border: 2px solid white;
              overflow: hidden;
              background-color: white;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
              display: flex;
              align-items: center;
              justify-content: center;
            `;

            if (account.image_url) {
              const img = document.createElement('img');
              img.src = account.image_url;
              img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
              `;
              img.onerror = () => {
                const initial = document.createElement('div');
                initial.style.cssText = `
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-center;
                  background-color: #f3f4f6;
                  color: #6b7280;
                  font-size: 14px;
                  font-weight: 500;
                `;
                initial.textContent = account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'U';
                imageContainer.innerHTML = '';
                imageContainer.appendChild(initial);
              };
              imageContainer.appendChild(img);
            } else {
              const initial = document.createElement('div');
              initial.style.cssText = `
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-center;
                background-color: #f3f4f6;
                color: #6b7280;
                font-size: 14px;
                font-weight: 500;
              `;
              initial.textContent = account.username?.[0]?.toUpperCase() || account.first_name?.[0]?.toUpperCase() || 'U';
              imageContainer.appendChild(initial);
            }

            el.appendChild(imageContainer);

            // Preview label
            const label = document.createElement('div');
            label.style.cssText = `
              margin-top: 4px;
              padding: 2px 6px;
              background-color: rgba(0, 0, 0, 0.6);
              color: white;
              font-size: 10px;
              font-weight: 500;
              border-radius: 4px;
              white-space: nowrap;
            `;
            label.textContent = 'Preview';
            el.appendChild(label);

            const marker = new mapbox.Marker({
              element: el,
              anchor: 'bottom',
            })
              .setLngLat([lng, lat])
              .addTo(currentMap as any);

            temporaryMarkerRef.current = marker;
          } else {
            // Update position if marker exists but is at wrong location
            const currentLngLat = temporaryMarkerRef.current.getLngLat();
            const tolerance = 0.0001; // Small tolerance for floating point comparison
            if (Math.abs(currentLngLat.lng - lng) > tolerance || Math.abs(currentLngLat.lat - lat) > tolerance) {
              temporaryMarkerRef.current.setLngLat([lng, lat]);
            }
          }
        } catch (err) {
          console.error('[LiveMap] Error ensuring preview marker:', err);
        }
      };

      ensurePreviewMarker();
    } else if (!isCreateOpen && temporaryMarkerRef.current) {
      // Only remove marker when create sheet closes (not during transition)
      if (!isTransitioningToCreateRef.current) {
        temporaryMarkerRef.current.remove();
        temporaryMarkerRef.current = null;
      }
    }
  }, [isModalOpen('create'), createTabSelectedLocation, account]);

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

  // Unified handler for opening create form with location
  // Handles: single-click, "Add Mention" button, any show-location-for-mention event
  useEffect(() => {
    const handleShowLocationForMention = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        lat: number;
        lng: number;
        atlas_meta?: Record<string, any>;
        map_meta?: Record<string, any>;
        full_address?: string | null;
      }>;
      const { lat, lng, atlas_meta, map_meta, full_address } = customEvent.detail || {};
      if (!lat || !lng) return;

      // Set flag to prevent popup from removing marker during transition
      isTransitioningToCreateRef.current = true;

      // Set location state FIRST (before any async operations or closing popups)
      setCreateTabSelectedLocation({ lat, lng });
      setCreateTabAtlasMeta(atlas_meta || null);
      setCreateTabMapMeta(map_meta || null);
      setCreateTabFullAddress(full_address || null);

      // Close any open popups/tabs
      closeAll();

      // Open create form
      openCreate({ lat, lng, atlas_meta, map_meta });

      // Transform existing white pin to red pin when create form opens
      setTimeout(() => {
        if (temporaryMarkerRef.current && mapInstanceRef.current && !(mapInstanceRef.current as any).removed) {
          const markerElement = temporaryMarkerRef.current.getElement();
          if (markerElement) {
            // The pin element itself is the circle, find the dot inside
            const pinDot = markerElement.querySelector('.map-click-pin-dot') as HTMLElement;
            
            if (markerElement && pinDot) {
              // Change white pin to red pin
              markerElement.style.backgroundColor = '#ef4444'; // red-500
              markerElement.style.borderColor = '#ef4444';
              
              // Change black dot to white dot
              pinDot.style.backgroundColor = '#ffffff'; // white
            }
          }
        }
        
        // Clear flag
        isTransitioningToCreateRef.current = false;
      }, 50);
    };

    window.addEventListener('show-location-for-mention', handleShowLocationForMention);
    return () => {
      window.removeEventListener('show-location-for-mention', handleShowLocationForMention);
    };
  }, [account, closeAll, openCreate, setCreateTabSelectedLocation, setCreateTabAtlasMeta, setCreateTabMapMeta]);

  // Maintain red pin when create sheet is open - ensures it persists at correct location
  useEffect(() => {
    const isCreateOpen = isModalOpen('create');
    
    // When create form closes, remove marker (unless transitioning)
    if (!isCreateOpen && temporaryMarkerRef.current && !isTransitioningToCreateRef.current) {
      temporaryMarkerRef.current.remove();
      temporaryMarkerRef.current = null;
      return;
    }

    // When create form is open, ensure marker exists at correct location and is red
    if (isCreateOpen && createTabSelectedLocation && mapInstanceRef.current && !(mapInstanceRef.current as any).removed) {
      const { lat, lng } = createTabSelectedLocation;

      // If marker exists, verify it's at correct location and is red
      if (temporaryMarkerRef.current) {
        const currentLngLat = temporaryMarkerRef.current.getLngLat();
        const tolerance = 0.0001;
        const isCorrectLocation = 
          Math.abs(currentLngLat.lng - lng) < tolerance && 
          Math.abs(currentLngLat.lat - lat) < tolerance;
        
        if (!isCorrectLocation) {
          // Update position if marker is at wrong location
          temporaryMarkerRef.current.setLngLat([lng, lat]);
        }
        
        // Ensure marker is red (transform if needed)
        const markerElement = temporaryMarkerRef.current.getElement();
        if (markerElement) {
          const pinDot = markerElement.querySelector('.map-click-pin-dot') as HTMLElement;
          
          if (markerElement && pinDot) {
            // Ensure it's red with white dot
            markerElement.style.backgroundColor = '#ef4444';
            markerElement.style.borderColor = '#ef4444';
            pinDot.style.backgroundColor = '#ffffff';
          }
        }
      }
    }
  }, [isModalOpen('create'), createTabSelectedLocation]);

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
          style: MAP_CONFIG.STRATEGIC_STYLES.streets,
          center: [-93.1022, 44.9553], // Minnesota State Capitol, St. Paul, MN
          zoom: 14, // Zoom level 14 for detailed view
          pitch: 60, // Start at 60 degrees
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
          if (isModalOpen('create')) {
            setCreateTabSelectedLocation({ lat, lng });
            return;
          }
          
          // Add white pin marker at clicked location (will turn red when form opens)
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
              
              // Add black dot in the middle with class for easy transformation
              const dot = document.createElement('div');
              dot.className = 'map-click-pin-dot';
              dot.style.cssText = `
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: #000000;
                position: absolute;
              `;
              el.className = 'map-click-pin-marker';
              el.classList.add('map-click-pin-circle');
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
              console.error('[LiveMap] Error creating pin marker:', err);
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
          
          // Capture mapbox feature at click point for map_meta
          // Structure matches FloatingMapContainer: { location: LocationData | null, feature: ExtractedFeature | null }
          let mapMeta: Record<string, any> | null = null;
          try {
            const point = mapboxMap.project([lng, lat]);
            const result = queryFeatureAtPoint(mapboxMap, point, 'labels-first', false);
            if (result) {
              // queryFeatureAtPoint with returnRaw=false returns ExtractedFeature directly
              const extractedFeature = 'feature' in result ? result.feature : result;
              if (extractedFeature && 'layerId' in extractedFeature) {
                mapMeta = {
                  location: null, // Location data not available in LiveMap context
                  feature: {
                    layerId: extractedFeature.layerId,
                    sourceLayer: extractedFeature.sourceLayer,
                    category: extractedFeature.category,
                    name: extractedFeature.name,
                    label: extractedFeature.label,
                    icon: extractedFeature.icon,
                    properties: extractedFeature.properties,
                    atlasType: extractedFeature.atlasType,
                    showIntelligence: extractedFeature.showIntelligence,
                  },
                };
              }
            }
          } catch (err) {
            console.debug('[LiveMap] Error capturing map feature:', err);
          }
          
          // Reverse geocode to get full address
          let fullAddress: string | null = null;
          try {
            const token = MAP_CONFIG.MAPBOX_TOKEN;
            if (token) {
              const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${lng},${lat}.json`;
              const params = new URLSearchParams({
                access_token: token,
                types: 'address',
                limit: '1',
              });
              
              const response = await fetch(`${url}?${params}`);
              if (response.ok) {
                const data = await response.json();
                if (data.features && data.features.length > 0) {
                  fullAddress = data.features[0].place_name || null;
                }
              }
            }
          } catch (err) {
            console.debug('[LiveMap] Error reverse geocoding:', err);
          }
          
          // Dispatch event to open create form (single-click to mention)
          window.dispatchEvent(new CustomEvent('show-location-for-mention', {
            detail: { lat, lng, map_meta: mapMeta, full_address: fullAddress }
          }));
          
          // Dispatch event to update search input with address and coordinates
          if (fullAddress) {
            window.dispatchEvent(new CustomEvent('update-search-address', {
              detail: { 
                address: fullAddress,
                coordinates: { lat, lng }
              }
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
        {/* Title Card */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-white rounded-md border border-gray-200 px-3 py-2 shadow-sm">
            <h1 className="text-sm font-semibold text-gray-900">Live</h1>
          </div>
        </div>

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
            modalState={{
              isAccountModalOpen,
              openAccount,
              openMapStyles,
              openDynamicSearch,
              closeAccount,
              closeMapStyles,
              closeDynamicSearch,
              isModalOpen,
            }}
            districtsState={{
              showDistricts,
              setShowDistricts,
            }}
            buildingsState={{
              showBuildings,
              setShowBuildings,
            }}
            ctuState={{
              showCTU,
              setShowCTU,
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

          {/* Congressional Districts Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <CongressionalDistrictsLayer
              map={mapInstanceRef.current}
              mapLoaded={mapLoaded}
              visible={showDistricts}
              onDistrictHover={setHoveredDistrict}
            />
          )}

          {/* Government Buildings Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <GovernmentBuildingsLayer
              map={mapInstanceRef.current}
              mapLoaded={mapLoaded}
              visible={showBuildings}
              onBuildingClick={(building) => setSelectedBuilding(building)}
            />
          )}

          {/* CTU Boundaries Layer */}
          {mapLoaded && mapInstanceRef.current && (
            <CTUBoundariesLayer
              map={mapInstanceRef.current}
              mapLoaded={mapLoaded}
              visible={showCTU}
              onCTUHover={setHoveredCTU}
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

      {/* Mobile Nav Tabs - Fixed bottom bar - Hidden when account modal is open, slides down when sheets open */}
      {!isAccountModalOpen && (
        <MobileNavTabs
          activeTab={activeTab}
          onTabClick={handleTabClick}
          isSheetOpen={activeTab === 'news' || activeTab === 'contribute' || activeTab === 'tools'}
        />
      )}

      {/* News Sheet */}
      <MobileNavPopup
        isOpen={activeTab === 'news' && !isAccountModalOpen}
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
                <span className={`text-[10px] whitespace-nowrap ${
                  useBlurStyle ? 'text-white/80' : 'text-gray-500'
                }`}>
                  {formatLastGeneration(lastNewsGeneration)}
                </span>
              )}
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('generate-news'));
                }}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  useBlurStyle
                    ? 'text-white bg-white/10 border border-white/20 hover:bg-white/20'
                    : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
                }`}
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
      </MobileNavPopup>

      {/* Create Popup - Only opened via "Add Label" button */}
      <CreateMentionPopup
        isOpen={isModalOpen('create') && !isAccountModalOpen}
        onClose={() => {
          closeCreate();
          setCreateTabSelectedLocation(null);
          setCreateTabAtlasMeta(null);
          setCreateTabMapMeta(null);
          // Remove temporary marker when create popup closes
          if (temporaryMarkerRef.current) {
            temporaryMarkerRef.current.remove();
            temporaryMarkerRef.current = null;
          }
        }}
            map={mapInstanceRef.current}
            mapLoaded={mapLoaded}
            initialCoordinates={createTabSelectedLocation}
            initialAtlasMeta={createTabAtlasMeta}
        initialMapMeta={createTabMapMeta}
        initialFullAddress={createTabFullAddress}
            onMentionCreated={() => {
              closeCreate();
              setCreateTabSelectedLocation(null);
              setCreateTabAtlasMeta(null);
          setCreateTabMapMeta(null);
          setCreateTabFullAddress(null);
              setMentionsRefreshKey(prev => prev + 1);
            }}
          />

      {/* Contribute Sheet */}
      <MobileNavPopup
        isOpen={activeTab === 'contribute' && !isAccountModalOpen}
        onClose={closeTab}
        title="Contribute"
      >
        <ContributeContent map={mapInstanceRef.current} mapLoaded={mapLoaded} />
      </MobileNavPopup>

      {/* Tools Sheet */}
      <MobileNavPopup
        isOpen={activeTab === 'tools' && !isAccountModalOpen}
        onClose={closeTab}
        title="Tools"
      >
        <ToolsContent />
      </MobileNavPopup>

      {/* Map Entity Popup - Above mobile nav */}
      <MapEntityPopup
        isOpen={popupData.type !== null && !isAccountModalOpen}
        onClose={() => {
          closePopup();
          // Only remove red pin marker when popup closes if we're not transitioning to create
          // (If transitioning to create, we want to keep the preview marker)
          if (temporaryMarkerRef.current && !isTransitioningToCreateRef.current && !isModalOpen('create')) {
            temporaryMarkerRef.current.remove();
            temporaryMarkerRef.current = null;
          }
        }}
        type={popupData.type}
        data={popupData.data}
      />

      {/* Congressional District Hover Info - Right Side */}
      <CongressionalDistrictHoverInfo
        district={hoveredDistrict}
      />

      {/* CTU Hover Info - Right Side */}
      <CTUHoverInfo
        ctu={hoveredCTU}
      />

      {/* Building Detail View - Full Screen Modal */}
      {selectedBuilding && (
        <BuildingDetailView
          building={selectedBuilding}
          onClose={() => setSelectedBuilding(null)}
          // Don't show edit/delete buttons for public users
        />
      )}

      {/* Daily Welcome Modal */}
      <DailyWelcomeModal
        isOpen={showDailyWelcome}
        onClose={() => setShowDailyWelcome(false)}
        useBlurStyle={useBlurStyle}
      />

      {/* Modals handled globally via AppModalContext/GlobalModals */}
    </div>
  );
}

