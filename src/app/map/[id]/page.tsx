'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import toast, { Toaster } from 'react-hot-toast';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import MapIDBox from './components/MapIDBox';
import MapPageLayout from './MapPageLayout';
import MapPageHeaderButtons from './MapPageHeaderButtons';
import { useUnifiedSidebar, type UnifiedSidebarType } from '@/hooks/useUnifiedSidebar';
import { useMapMembership } from './hooks/useMapMembership';
import { generateUUID } from '@/lib/utils/uuid';
import { shouldNormalizeUrl, getMapUrl } from '@/lib/maps/urls';
import { isMapSetupComplete } from '@/lib/maps/mapSetupCheck';
import MapFilterContent from '@/components/layout/MapFilterContent';
import MapSettingsSidebar from './components/MapSettingsSidebar';
import MemberManager from './components/MemberManager';
import JoinMapSidebar from './components/JoinMapSidebar';
import MapPosts from './components/MapPosts';
import MapActionUpgradePrompt from '@/components/maps/MapActionUpgradePrompt';
import { canUserPerformMapAction, type PlanLevel } from '@/lib/maps/permissions';
import LocationSelectPopup from '@/components/layout/LocationSelectPopup';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import { queryFeatureAtPoint } from '@/features/map-metadata/services/featureService';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import type { MapData } from '@/types/map';

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const mapInstanceRef = useRef<any>(null);
  const clickMarkerRef = useRef<any>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number>(0);
  const [mapId, setMapId] = useState<string | null>(null);
  const [hasRecordedView, setHasRecordedView] = useState(false);
  const { activeSidebar, toggleSidebar, closeSidebar } = useUnifiedSidebar();
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | 'all'>('7d');
  const [showDistricts, setShowDistricts] = useState(false);
  const [showCTU, setShowCTU] = useState(false);
  const [showStateBoundary, setShowStateBoundary] = useState(false);
  const [showCountyBoundaries, setShowCountyBoundaries] = useState(false);
  const [initialPins, setInitialPins] = useState<any[]>([]);
  const [initialAreas, setInitialAreas] = useState<any[]>([]);
  const [initialMembers, setInitialMembers] = useState<any[] | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(true);
  const membershipToastShownRef = useRef(false);
  
  // Location select popup state (for map clicks)
  const [locationSelectPopup, setLocationSelectPopup] = useState<{
    isOpen: boolean;
    lat: number;
    lng: number;
    address: string | null;
    mapMeta: Record<string, any> | null;
  }>({
    isOpen: false,
    lat: 0,
    lng: 0,
    address: null,
    mapMeta: null,
  });

  // State for clicked coordinates (triggers reverse geocode hook)
  const [clickedCoordinates, setClickedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const { address: reverseGeocodeAddress } = useReverseGeocode(
    clickedCoordinates?.lat || null,
    clickedCoordinates?.lng || null
  );

  // Update location popup address when reverse geocode completes
  useEffect(() => {
    if (locationSelectPopup.isOpen && reverseGeocodeAddress !== null) {
      setLocationSelectPopup((prev) => ({
        ...prev,
        address: reverseGeocodeAddress,
      }));
    }
  }, [reverseGeocodeAddress, locationSelectPopup.isOpen]);
  
  // Upgrade prompt state
  const [upgradePrompt, setUpgradePrompt] = useState<{
    isOpen: boolean;
    action: 'pins' | 'areas' | 'posts' | 'clicks';
    requiredPlan: PlanLevel;
    currentPlan?: PlanLevel;
  }>({
    isOpen: false,
    action: 'pins',
    requiredPlan: 'contributor',
  });
  
  // Listen for permission denied events from API errors
  useEffect(() => {
    const handlePermissionDenied = (e: CustomEvent) => {
      const { action, requiredPlan, currentPlan } = e.detail;
      setUpgradePrompt({
        isOpen: true,
        action,
        requiredPlan,
        currentPlan,
      });
    };
    
    window.addEventListener('map-action-permission-denied', handlePermissionDenied as EventListener);
    return () => {
      window.removeEventListener('map-action-permission-denied', handlePermissionDenied as EventListener);
    };
  }, []);

  // Keep boundary toggles in sync with persisted map_layers
  useEffect(() => {
    const layers = mapData?.settings?.appearance?.map_layers || {};
    setShowDistricts(Boolean(layers.congressional_districts));
    setShowCTU(Boolean(layers.ctu_boundaries));
    setShowStateBoundary(Boolean(layers.state_boundary));
    setShowCountyBoundaries(Boolean(layers.county_boundaries));
  }, [mapData?.settings?.appearance?.map_layers]);

  // Get map ID from params
  useEffect(() => {
    params.then(({ id }) => {
      setMapId(id);
    });
  }, [params]);

  // Membership check (consolidated)
  const { isOwner, showMembers, isMember, isManager, loading: membershipLoading, userRole } = useMapMembership(mapId, mapData?.account_id || null, initialMembers);
  
  // Use active account ID from dropdown
  const currentAccountId = activeAccountId || account?.id || null;
  
  // Permission check handlers
  const handlePinAction = useCallback(() => {
    if (!mapData || !account) return;
    
    const permissionCheck = canUserPerformMapAction(
      'pins',
      mapData,
      {
        accountId: account.id,
        plan: (account.plan || 'hobby') as PlanLevel,
        subscription_status: account.subscription_status,
        role: userRole || null,
      },
      isOwner
    );
    
    if (!permissionCheck.allowed && permissionCheck.reason === 'plan_required') {
      setUpgradePrompt({
        isOpen: true,
        action: 'pins',
        requiredPlan: permissionCheck.requiredPlan!,
        currentPlan: permissionCheck.currentPlan,
      });
      return false;
    }
    
    return permissionCheck.allowed;
  }, [mapData, account, isOwner, userRole]);
  
  const handleAreaAction = useCallback(() => {
    if (!mapData || !account) return;
    
    const permissionCheck = canUserPerformMapAction(
      'areas',
      mapData,
      {
        accountId: account.id,
        plan: (account.plan || 'hobby') as PlanLevel,
        subscription_status: account.subscription_status,
        role: userRole || null,
      },
      isOwner
    );
    
    if (!permissionCheck.allowed && permissionCheck.reason === 'plan_required') {
      setUpgradePrompt({
        isOpen: true,
        action: 'areas',
        requiredPlan: permissionCheck.requiredPlan!,
        currentPlan: permissionCheck.currentPlan,
      });
      return false;
    }
    
    return permissionCheck.allowed;
  }, [mapData, account, isOwner, userRole]);
  
  const handlePostAction = useCallback(() => {
    if (!mapData || !account) return;
    
    const permissionCheck = canUserPerformMapAction(
      'posts',
      mapData,
      {
        accountId: account.id,
        plan: (account.plan || 'hobby') as PlanLevel,
        subscription_status: account.subscription_status,
        role: userRole || null,
      },
      isOwner
    );
    
    if (!permissionCheck.allowed && permissionCheck.reason === 'plan_required') {
      setUpgradePrompt({
        isOpen: true,
        action: 'posts',
        requiredPlan: permissionCheck.requiredPlan!,
        currentPlan: permissionCheck.currentPlan,
      });
      return false;
    }
    
    return permissionCheck.allowed;
  }, [mapData, account, isOwner, userRole]);

  // Show membership status toast after map loads and auth is checked
  useEffect(() => {
    // Only show toast if:
    // 1. Map data is loaded
    // 2. Membership check is complete
    // 3. User is authenticated
    // 4. We haven't shown the toast yet for this map
    if (!mapData || membershipLoading || !account || !mapId || membershipToastShownRef.current) {
      return;
    }

    // Skip toast for public maps where user has no role (they're just viewing)
    if (mapData.visibility === 'public' && !isOwner && !isMember) {
      membershipToastShownRef.current = true;
      return;
    }

    // Determine message based on role
    let title = '';
    let message = '';

    if (isOwner) {
      title = 'Map Owner';
      message = 'You own this map and have full control';
    } else if (isManager) {
      title = 'Map Manager';
      message = 'You can manage this map and its members';
    } else if (isMember && userRole === 'editor') {
      title = 'Map Editor';
      message = 'You can add pins, areas, and posts to this map';
    } else if (mapData.visibility === 'private') {
      title = 'Not a Member';
      message = 'This is a private map. Request access to collaborate';
    }

    // Only show toast if we have a message
    if (title) {
      toast(`${title}: ${message}`, {
        duration: 3000,
        position: 'top-right',
        style: {
          fontSize: '12px',
          padding: '10px',
        },
      });
      membershipToastShownRef.current = true;
    }
  }, [mapData, membershipLoading, account, mapId, isOwner, isManager, isMember, userRole]);

  // Reset toast flag when mapId changes
  useEffect(() => {
    membershipToastShownRef.current = false;
  }, [mapId]);

  // Check if this is the live map
  const isLiveMap = useMemo(() => {
    return mapData?.slug === 'live' || mapId === 'live';
  }, [mapData?.slug, mapId]);

  // Check membership and pending requests when map data loads
  useEffect(() => {
    if (!mapData || !mapId || !currentAccountId || isLiveMap) {
      setCheckingMembership(false);
      return;
    }

    const checkMembershipStatus = async () => {
      setCheckingMembership(true);
      
      // Check for pending request
      try {
        const requestsResponse = await fetch(`/api/maps/${mapId}/membership-requests`);
        if (requestsResponse.ok) {
          const requestsData = await requestsResponse.json();
          const pending = requestsData.requests?.some(
            (r: any) => r.account_id === currentAccountId && r.status === 'pending'
          ) || false;
          setHasPendingRequest(pending);
        } else if (requestsResponse.status === 403) {
          // 403 means can't view requests (not a manager/owner), assume no pending
          setHasPendingRequest(false);
        }
      } catch (err) {
        setHasPendingRequest(false);
      }

      setCheckingMembership(false);
    };

    checkMembershipStatus();
  }, [mapData, mapId, currentAccountId, isLiveMap]);



  const [mapLoaded, setMapLoaded] = useState(false);

  // Stable map load handler so Mapbox is only initialized once per mount
  const handleMapLoad = useCallback((map: any) => {
    mapInstanceRef.current = map;
    setMapLoaded(true);
  }, []);

  // Fly to location when location select popup opens
  useEffect(() => {
    if (!locationSelectPopup.isOpen || !mapLoaded || !mapInstanceRef.current) return;
    
    const mapboxMap = mapInstanceRef.current as any;
    if (mapboxMap.removed) return;
    
    const { lat, lng } = locationSelectPopup;
    if (lat === 0 && lng === 0) return; // Skip if coordinates are not set
    
    // Fly to the clicked location
    if (typeof mapboxMap.flyTo === 'function') {
      const currentZoom = typeof mapboxMap.getZoom === 'function' ? mapboxMap.getZoom() : 10;
      const targetZoom = Math.max(currentZoom, 15); // Ensure we zoom in at least to level 15
      
      mapboxMap.flyTo({
        center: [lng, lat],
        zoom: targetZoom,
        duration: 1000,
        essential: true,
      });
    }
  }, [locationSelectPopup.isOpen, locationSelectPopup.lat, locationSelectPopup.lng, mapLoaded]);

  // Remove click marker when popup closes
  useEffect(() => {
    if (!locationSelectPopup.isOpen && clickMarkerRef.current) {
      try {
        clickMarkerRef.current.remove();
      } catch (err) {
        // Ignore cleanup errors
      }
      clickMarkerRef.current = null;
    }
  }, [locationSelectPopup.isOpen]);

  // Add click handler for location select popup when map loads
  useEffect(() => {
    if (!mapLoaded) return;
    
    const mapboxMap = mapInstanceRef.current as any;
    if (!mapboxMap || mapboxMap.removed) return;

    const handleMapClick = async (e: any) => {
      const map = mapInstanceRef.current as any;
      if (!map || map.removed) return;
      
      // Check if click hit a pin or area layer - those have their own handlers
      const pinOrAreaLayers = ['map-pins-points', 'map-pins-point-label', 'map-areas-fill', 'map-areas-outline'];
      const hitRadius = 20;
      const box: [[number, number], [number, number]] = [
        [e.point.x - hitRadius, e.point.y - hitRadius],
        [e.point.x + hitRadius, e.point.y + hitRadius]
      ];
      
      let pinOrAreaFeatures: any[] = [];
      try {
        const existingLayers = pinOrAreaLayers.filter(layerId => {
          try {
            return map.getLayer(layerId) !== undefined;
          } catch {
            return false;
          }
        });
        
        if (existingLayers.length > 0) {
          pinOrAreaFeatures = map.queryRenderedFeatures(box, {
            layers: existingLayers,
          });
        }
      } catch (queryError) {
        // Silently continue if query fails
      }
      
      // If clicked on a pin or area, don't show location popup
      if (pinOrAreaFeatures.length > 0) {
        return;
      }
      
      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;
      
      // Check if click is within Minnesota bounds
      if (!MinnesotaBoundsService.isWithinMinnesota({ lat, lng })) {
        console.warn('[MapPage] Click outside Minnesota bounds:', { lat, lng });
        return;
      }

      // Remove existing click marker
      if (clickMarkerRef.current) {
        try {
          clickMarkerRef.current.remove();
        } catch (err) {
          // Ignore cleanup errors
        }
        clickMarkerRef.current = null;
      }

      // Create white circle with black dot marker
      try {
        const mapboxgl = (window as any).mapboxgl;
        if (mapboxgl && mapboxgl.Marker) {
          // Create marker element
          const el = document.createElement('div');
          el.style.cssText = `
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: #ffffff;
            border: 2px solid rgba(0, 0, 0, 0.3);
            cursor: pointer;
            pointer-events: none;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          `;

          // Add black dot
          const dot = document.createElement('div');
          dot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #000000;
            position: absolute;
          `;
          el.appendChild(dot);

          // Create and add marker
          clickMarkerRef.current = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat([lng, lat])
            .addTo(mapboxMap);
        }
      } catch (err) {
        console.error('[MapPage] Error creating click marker:', err);
      }

      // Always fly to the clicked location
      if (typeof mapboxMap.flyTo === 'function') {
        const currentZoom = typeof mapboxMap.getZoom === 'function' ? mapboxMap.getZoom() : 10;
        const targetZoom = Math.max(currentZoom + 2, 15); // Zoom in a bit (add 2 levels) or at least to level 15
        
        mapboxMap.flyTo({
          center: [lng, lat],
          zoom: targetZoom,
          duration: 1000,
          essential: true,
        });
      }

      // Only show location popup if map settings allow clicks
      const allowClicks = mapData?.settings?.collaboration?.allow_clicks ?? false;
      if (!allowClicks) {
        return; // Don't show popup if clicks are disabled
      }

      // Check clickability permission
      if (mapData && account) {
        const permissionCheck = canUserPerformMapAction(
          'clicks',
          mapData,
          {
            accountId: account.id,
            plan: (account.plan || 'hobby') as PlanLevel,
            subscription_status: account.subscription_status,
            role: userRole || null,
          },
          isOwner
        );

        if (!permissionCheck.allowed) {
          if (permissionCheck.reason === 'plan_required') {
            setUpgradePrompt({
              isOpen: true,
              action: 'clicks',
              requiredPlan: permissionCheck.requiredPlan!,
              currentPlan: permissionCheck.currentPlan,
            });
          }
          return;
        }
      }
      
      // Trigger reverse geocode hook
      setClickedCoordinates({ lat, lng });
      
      // Capture mapbox feature at click point for map_meta
      let mapMeta: Record<string, any> | null = null;
      try {
        const point = map.project([lng, lat]);
        const result = queryFeatureAtPoint(map, point, 'labels-first', false);
        if (result) {
          const extractedFeature = 'feature' in result ? result.feature : result;
          if (extractedFeature && 'layerId' in extractedFeature) {
            mapMeta = {
              location: null,
              feature: {
                layerId: extractedFeature.layerId,
                sourceLayer: extractedFeature.sourceLayer,
                category: extractedFeature.category,
                name: extractedFeature.name,
                label: extractedFeature.label,
                icon: extractedFeature.icon,
                properties: extractedFeature.properties,
                showIntelligence: extractedFeature.showIntelligence,
              },
            };
          }
        }
      } catch (err) {
        console.debug('[MapPage] Error capturing map feature:', err);
      }
      
      // Show location select popup (address will be set via reverse geocode hook)
      setLocationSelectPopup({
        isOpen: true,
        lat,
        lng,
        address: null, // Will be updated when reverse geocode completes
        mapMeta: mapMeta,
      });
    };

    mapboxMap.on('click', handleMapClick);
    
    return () => {
      const map = mapInstanceRef.current as any;
      if (map && !map.removed) {
        map.off('click', handleMapClick);
      }
      // Clean up click marker
      if (clickMarkerRef.current) {
        try {
          clickMarkerRef.current.remove();
        } catch (err) {
          // Ignore cleanup errors
        }
        clickMarkerRef.current = null;
      }
    };
  }, [mapLoaded, mapData, account, isOwner, userRole]);

  const handleSettingsClick = () => toggleSidebar('settings');
  const handleFilterClick = () => toggleSidebar('filter');
  const handlePostsClick = () => toggleSidebar('posts');
  const handleMembersClick = () => toggleSidebar('members');
  const handleJoinClick = () => toggleSidebar('join');

  // Debounced map resize when sidebars animate
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof map.resize !== 'function') return;

    const timeoutId = setTimeout(() => {
      try {
        map.resize();
      } catch {
        // ignore
      }
    }, 350); // Debounce to 350ms (after 300ms transition)

    return () => clearTimeout(timeoutId);
  }, [activeSidebar]);

  // Sidebar configurations
  const sidebarConfigs = useMemo(() => {
    if (!mapData) return [];

    const configs: Array<{
      type: UnifiedSidebarType;
      title: string;
      content: React.ReactNode;
      popupType?: 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'search' | 'members';
      darkMode?: boolean;
      infoText?: string;
    }> = [
      {
        type: 'filter',
        title: 'Filter Map',
        content: <MapFilterContent onClose={closeSidebar} />,
        popupType: 'search',
      },
    ];

    // Settings visible to all members (owners see editable, members see permissions)
    if (isMember || isOwner || currentAccountId) {
      configs.push({
        type: 'settings' as const,
        title: 'Map Settings',
        content: (
          <MapSettingsSidebar
            initialMap={{
              id: mapData.id,
              account_id: mapData.account_id,
              name: mapData.name,
              description: mapData.description,
              slug: mapData.slug,
              visibility: mapData.visibility,
              boundary: mapData.boundary || 'statewide',
              boundary_data: mapData.boundary_data || null,
              settings: mapData.settings || {
                appearance: {
                  map_style: 'street',
                  map_layers: {},
                  meta: {},
                },
                collaboration: {
                  allow_pins: false,
                  allow_areas: false,
                  allow_posts: false,
                },
                presentation: {
                  hide_creator: false,
                  is_featured: false,
                },
              },
              auto_approve_members: mapData.auto_approve_members || false,
              membership_rules: mapData.membership_rules || null,
              membership_questions: mapData.membership_questions || [],
              tags: mapData.tags,
              created_at: mapData.created_at,
              updated_at: mapData.updated_at,
            }}
            onUpdated={(updated) => {
              setMapData(prev => prev ? { ...prev, ...updated } : null);
            }}
            onClose={closeSidebar}
            isOwner={isOwner}
            userRole={isOwner ? 'owner' : (isManager ? 'manager' : (isMember ? 'editor' : null))}
          />
        ),
        popupType: 'settings',
      });
    }

    if (showMembers) {
      configs.push({
        type: 'members' as const,
        title: 'Members',
        content: (
          <MemberManager
            mapId={mapData.id}
            mapAccountId={mapData.account_id}
            autoApproveMembers={mapData.auto_approve_members || false}
            membershipQuestions={mapData.membership_questions || []}
            membershipRules={mapData.membership_rules || null}
            onClose={closeSidebar}
            mapName={mapData.name}
          />
        ),
        popupType: 'members' as 'members',
        infoText: 'Manage map members, roles, and membership requests',
      });
    }

    // Show join sidebar if user is not a member and not an owner
    // Note: We allow joining regardless of collaboration settings - the map owner
    // can configure membership rules/questions to control access
    if (!isMember && !isOwner && currentAccountId) {
      configs.push({
        type: 'join' as const,
        title: 'Join Map',
        content: (
          <JoinMapSidebar
            mapId={mapData.id}
            mapName={mapData.name}
            autoApproveMembers={mapData.auto_approve_members || false}
            membershipQuestions={(mapData.membership_questions || []).map((q: any, index: number) => ({
              id: q.id !== undefined ? q.id : index,
              question: q.question || q,
            }))}
            membershipRules={mapData.membership_rules || null}
            allowPins={mapData.settings?.collaboration?.allow_pins || false}
            allowAreas={mapData.settings?.collaboration?.allow_areas || false}
            allowPosts={mapData.settings?.collaboration?.allow_posts || false}
            pinPermissions={mapData.settings?.collaboration?.pin_permissions || null}
            areaPermissions={mapData.settings?.collaboration?.area_permissions || null}
            postPermissions={mapData.settings?.collaboration?.post_permissions || null}
            mapLayers={mapData.settings?.appearance?.map_layers || {}}
            memberCount={mapData.member_count || 0}
            onJoinSuccess={() => {
              // Refresh membership status
              setCheckingMembership(true);
            }}
            onClose={closeSidebar}
          />
        ),
        popupType: 'account',
      });
    }

    // Add posts section
    configs.push({
      type: 'posts' as const,
      title: 'Posts',
      content: (
        <MapPosts mapId={mapData.id} onClose={closeSidebar} />
      ),
      popupType: 'account',
      infoText: 'Posts associated with this map',
    });

    return configs;
  }, [mapData, isOwner, showMembers, isMember, currentAccountId, closeSidebar]);

  const handleTimeFilterChange = (filter: '24h' | '7d' | 'all') => {
    setTimeFilter(filter);
    window.dispatchEvent(new CustomEvent('mention-time-filter-change', {
      detail: { timeFilter: filter }
    }));
  };

  // Sync boundary state with map via events
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('map-boundaries-change', {
      detail: {
        showDistricts,
        showCTU,
        showStateBoundary,
        showCountyBoundaries,
      }
    }));
  }, [showDistricts, showCTU, showStateBoundary, showCountyBoundaries]);

  // Fetch all map data in one call - runs once per mapId
  useEffect(() => {
    if (!mapId) return;

    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        // Single aggregate endpoint: map + stats + pins + areas + members
        const response = await fetch(`/api/maps/${mapId}/data`);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 404) {
            setError('Map not found');
          } else if (response.status === 403) {
            setError('You do not have access to this map');
          } else {
            setError(data.error || 'Failed to load map');
          }
          setLoading(false);
          return;
        }

        // Validate response structure
        if (!data || typeof data !== 'object' || !data.map) {
          throw new Error('Invalid map data received');
        }
        
        const map: MapData = data.map;
        setMapData(map);
        setViewCount(data.stats?.stats?.total_views || 0);
        setInitialPins(data.pins || []);
        setInitialAreas(data.areas || []);
        setInitialMembers(data.members || null);

        // Record view (fire and forget)
        if (!hasRecordedView && map.id) {
          setHasRecordedView(true);
          let sessionId: string | null = null;
          if (typeof window !== 'undefined') {
            sessionId = localStorage.getItem('analytics_device_id') || generateUUID();
            if (!localStorage.getItem('analytics_device_id')) {
              localStorage.setItem('analytics_device_id', sessionId);
            }
          }
          fetch('/api/analytics/map-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              map_id: map.id,
              referrer_url: typeof window !== 'undefined' ? document.referrer || null : null,
              session_id: sessionId,
              user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
            }),
          }).catch(() => {});
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching map:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [mapId, hasRecordedView]);

  // URL normalization: redirect ID URLs to slug URLs when available
  useEffect(() => {
    if (!mapData || !mapId || loading) return;
    
    if (shouldNormalizeUrl(mapId, mapData)) {
      const canonicalUrl = getMapUrl(mapData);
      router.replace(canonicalUrl, { scroll: false });
    }
  }, [mapData, mapId, loading, router]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            fontSize: '12px',
            padding: '10px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <PageWrapper
        headerContent={
          <MapPageHeaderButtons
            onSettingsClick={handleSettingsClick}
            onFilterClick={handleFilterClick}
            onMembersClick={handleMembersClick}
            onJoinClick={handleJoinClick}
            onPostsClick={handlePostsClick}
            showSettings={isMember || isOwner || currentAccountId !== null}
            showMembers={showMembers}
            showJoin={!isMember && !isOwner && currentAccountId !== null}
            showPosts={true}
          />
        }
        searchComponent={
          <MapSearchInput
            map={mapInstanceRef.current}
            onLocationSelect={(coordinates, placeName) => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.flyTo({
                  center: [coordinates.lng, coordinates.lat],
                  zoom: 15,
                  duration: 1500,
                });
              }
            }}
          />
        }
        accountDropdownProps={{
          onAccountClick: () => {
            // Handle account click
          },
          onSignInClick: openWelcome,
        }}
        searchResultsComponent={<SearchResults />}
      >
        <div className={`relative w-full ${isLiveMap ? 'h-auto min-h-full' : 'h-full'}`} style={{ minHeight: 0, width: '100%' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-50" style={{ height: isLiveMap ? '100vh' : '100%' }}>
              <div className="text-center">
                <div className="w-6 h-6 border-4 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-600">Loading map...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 p-[10px] z-50" style={{ height: isLiveMap ? '100vh' : '100%' }}>
              <div className="bg-white border border-red-200 rounded-md p-[10px] max-w-md w-full">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-xs text-gray-600 mb-3">{error}</p>
                <button
                  onClick={() => router.push('/maps')}
                  className="text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md py-1.5 px-3 transition-colors"
                >
                  Back to Maps
                </button>
              </div>
            </div>
          )}

          {mapData && !loading && (
            <>
              <div className={`${isLiveMap ? 'h-screen' : 'h-full'} overflow-hidden`}>
                <MapPageLayout
                  activeSidebar={activeSidebar}
                  onSidebarClose={closeSidebar}
                  sidebarConfigs={sidebarConfigs}
                >
                  <MapIDBox 
                    mapStyle={mapData.settings?.appearance?.map_style || 'street'}
                    mapId={mapData.id}
                    isOwner={isOwner}
                    meta={mapData.settings?.appearance?.meta}
                    showDistricts={showDistricts}
                    showCTU={showCTU}
                    showStateBoundary={showStateBoundary}
                    showCountyBoundaries={showCountyBoundaries}
                    title={mapData.name}
                    description={mapData.description}
                    visibility={mapData.visibility}
                    allowOthersToPostPins={mapData.settings?.collaboration?.allow_pins || false}
                    allowOthersToAddAreas={mapData.settings?.collaboration?.allow_areas || false}
                    pinPermissions={mapData.settings?.collaboration?.pin_permissions || null}
                    areaPermissions={mapData.settings?.collaboration?.area_permissions || null}
                    onPinActionCheck={handlePinAction}
                    onAreaActionCheck={handleAreaAction}
                    account={mapData.account}
                    // Pass permission props for MapInfoCard if it's used in MapIDBox
                    userPlan={(account?.plan || 'hobby') as PlanLevel}
                    viewCount={viewCount}
                    hideCreator={mapData.settings?.presentation?.hide_creator || false}
                    map_account_id={mapData.account_id}
                    current_account_id={activeAccountId || account?.id || null}
                    created_at={mapData.created_at}
                    updated_at={mapData.updated_at}
                    initialPins={initialPins}
                    initialAreas={initialAreas}
                    auto_approve_members={mapData.auto_approve_members || false}
                    membership_questions={mapData.membership_questions || []}
                    membership_rules={mapData.membership_rules || null}
                    isMember={isMember}
                    onJoinClick={handleJoinClick}
                    onMapLoad={handleMapLoad}
                    onMapUpdate={(updatedData) => {
                      setMapData(prev => prev ? { ...prev, ...updatedData } : null);
                    }}
                  />
                </MapPageLayout>
              </div>

            </>
          )}
        </div>
      </PageWrapper>

      {/* Upgrade Prompt */}
      <MapActionUpgradePrompt
        isOpen={upgradePrompt.isOpen}
        onClose={() => setUpgradePrompt({ ...upgradePrompt, isOpen: false })}
        action={upgradePrompt.action}
        requiredPlan={upgradePrompt.requiredPlan}
        currentPlan={upgradePrompt.currentPlan}
      />

      {/* Location Select Popup */}
      <LocationSelectPopup
        isOpen={locationSelectPopup.isOpen}
        onClose={() => {
          setLocationSelectPopup({ 
            isOpen: false, 
            lat: 0, 
            lng: 0, 
            address: null, 
            mapMeta: null,
          });
          setClickedCoordinates(null);
        }}
        lat={locationSelectPopup.lat}
        lng={locationSelectPopup.lng}
        address={locationSelectPopup.address || reverseGeocodeAddress}
        mapMeta={locationSelectPopup.mapMeta}
        onAddToMap={(coordinates, mapMeta, mentionTypeId) => {
          // Navigate to /add page with location and mention type
          const params = new URLSearchParams();
          params.set('lat', coordinates.lat.toString());
          params.set('lng', coordinates.lng.toString());
          if (mentionTypeId) {
            params.set('mention_type_id', mentionTypeId);
          }
          router.push(`/add?${params.toString()}`);
        }}
      />
    </>
  );
}

