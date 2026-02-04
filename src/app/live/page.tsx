'use client';

import { useState, useCallback, useEffect, useMemo, useRef, useTransition, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { HeaderThemeProvider } from '@/contexts/HeaderThemeContext';
import { SearchStateProvider, useSearchState } from '@/contexts/SearchStateContext';
import AppContainer from '@/components/layout/AppContainer';
import AppMenu from '@/components/layout/AppMenu';
import MapInfo, { MapInfoSkeleton, type MapInfoLocation, type MapInfoMentionType } from '@/components/layout/MapInfo';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import LiveMapFooterStatus, { type LiveMapFooterStatusState } from '@/components/layout/LiveMapFooterStatus';
import LivePinCard, { type LivePinData } from '@/components/layout/LivePinCard';
import MentionTypeInfoCard from '@/components/layout/MentionTypeInfoCard';
import { useAuthStateSafe } from '@/features/auth';
import { getLiveLayerLabel, type LiveBoundaryLayerId } from '@/features/map/config';
import { preloadAll, resolveBoundaryByLayerId } from '@/features/map/services/liveBoundaryCache';
import MapPage from '../map/[id]/page';
import { generateUUID } from '@/lib/utils/uuid';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import SignInGate from '@/components/auth/SignInGate';
import type { MapInstance } from '@/components/layout/types';
import { MentionService } from '@/features/mentions/services/mentionService';
import MapControls from '@/components/layout/MapControls';
import type { NearbyPin } from '@/components/layout/types';
import ContributeOverlay from '@/app/map/[id]/components/ContributeOverlay';

function LiveHeaderThemeSync({ children }: { children: ReactNode }) {
  const { isSearchActive, isSearching, searchQuery } = useSearchState();
  
  return (
    <HeaderThemeProvider value={{ isDefaultLightBg: false, isSearchActive }}>
      {children}
      {/* Search overlay - covers map when actively searching (typing), behind footer/sidebar */}
      {isSearching && (
        <div 
          className="fixed inset-0 bg-black/40 z-[1995] pointer-events-none"
          aria-hidden="true"
        />
      )}
    </HeaderThemeProvider>
  );
}

function getFooterHeaderLabel(selectedLocation: MapInfoLocation | null): string {
  const boundaryLayer = selectedLocation?.mapMeta?.boundaryLayer as LiveBoundaryLayerId | undefined;
  const boundaryName = selectedLocation?.mapMeta?.boundaryName as string | undefined;
  if (boundaryLayer && boundaryName) {
    const title = getLiveLayerLabel(boundaryLayer);
    return `${title}: ${boundaryName}`;
  }
  return 'Location';
}

/**
 * Live page: map + overlay (header, footer).
 *
 * SELECTION (only one at a time):
 * - Pin: click a pin → URL ?pin=<id>, footer shows LivePinCard. Close icon clears selection and URL.
 * - Boundary: click state/county/CTU/district → URL ?layer=&id=, footer shows MapInfo. Close icon clears.
 * - Map location: click empty map → no pin/layer/id in URL, footer shows MapInfo (lat/lng). Close icon clears.
 *
 * URL params: pin | layer+id are mutually exclusive. type= (mention type) is preserved when changing/clearing selection.
 * Changing selection: click another pin, boundary, or map → buildLiveUrl clears previous and sets new.
 * Removing selection: close icon → handleClearSelection clears pin/layer/id and state, preserves type.
 */
function LivePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account, activeAccountId } = useAuthStateSafe();
  const currentAccountId = activeAccountId || account?.id || null;
  const isAuthenticated = Boolean(account || activeAccountId);
  const { isSearchActive, isSearching } = useSearchState();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapInfoLocation | null>(null);
  const [footerOpen, setFooterOpen] = useState(false);
  const [footerTargetState, setFooterTargetState] = useState<'low' | 'main' | 'tall' | null>(null);
  /** Single boundary layer visible on live map; only one at a time. Toggled from main menu Live map section. */
  const [liveBoundaryLayer, setLiveBoundaryLayer] = useState<LiveBoundaryLayerId | null>(null);
  /** Pin display grouping: when true cluster pins; when false (default) show all pins. */
  const [pinDisplayGrouping, setPinDisplayGrouping] = useState(false);
  /** Show only current account's pins on the live map. Only available for authenticated users. */
  const [showOnlyMyPins, setShowOnlyMyPins] = useState(false);
  /** Time filter for pins on the live map: 24h, 7d, or null = all time. */
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | null>(null);

  // Disable "show only my pins" for non-authenticated users
  useEffect(() => {
    if (!isAuthenticated && showOnlyMyPins) {
      setShowOnlyMyPins(false);
    }
  }, [isAuthenticated, showOnlyMyPins]);
  const [liveStatus, setLiveStatus] = useState<LiveMapFooterStatusState>({
    loadingData: true,
    mapLoaded: false,
    loadingPins: false,
  });
  const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyPins, setNearbyPins] = useState<NearbyPin[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [showContributeOverlay, setShowContributeOverlay] = useState(false);
  const [contributeLocation, setContributeLocation] = useState<MapInfoLocation | null>(null);
  const [contributeMentionTypeId, setContributeMentionTypeId] = useState<string | undefined>();
  const [liveMapId, setLiveMapId] = useState<string | null>(null);
  const lastAddToMapTimeRef = useRef<number>(0);

  // Track map center from liveStatus updates
  useEffect(() => {
    if (liveStatus.mapLoaded && mapInstance) {
      try {
        const center = mapInstance.getCenter();
        if (center) {
          setMapCenter({ lat: center.lat, lng: center.lng });
        }
      } catch (err) {
        // Ignore errors
      }
    }
  }, [liveStatus.mapLoaded, mapInstance]);

  // Store GeolocateControl reference
  const geolocateControlRef = useRef<any>(null);

  const handleGeolocateControlReady = useCallback((control: any) => {
    geolocateControlRef.current = control;
  }, []);

  // Listen for map move events to update center
  useEffect(() => {
    if (!mapInstance || !liveStatus.mapLoaded) return;
    
    const updateCenter = () => {
      try {
        const center = mapInstance.getCenter();
        if (center) {
          setMapCenter({ lat: center.lat, lng: center.lng });
        }
      } catch (err) {
        // Ignore errors
      }
    };

    mapInstance.on('moveend', updateCenter);
    return () => {
      mapInstance.off('moveend', updateCenter);
    };
  }, [mapInstance, liveStatus.mapLoaded]);


  // Fetch live map ID
  useEffect(() => {
    fetch('/api/maps/live')
      .then((res) => res.json())
      .then((data) => {
        if (data?.id) {
          setLiveMapId(data.id);
          
          // Record view for analytics
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
              map_id: data.id,
              referrer_url: typeof window !== 'undefined' ? document.referrer || null : null,
              session_id: sessionId,
              user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
            }),
          }).catch(() => {
            // Silently fail - view recording is not critical
          });
        }
      })
      .catch(() => {
        // Silently fail if live map lookup fails
      });
  }, []);

  // Do NOT preload boundary data on mount - only load when user explicitly toggles layers on
  // This prevents unnecessary API calls and improves initial page load performance

  // Lock viewport: no scroll, 100dvh/100vw app-like experience (desktop + mobile, any browser)
  useEffect(() => {
    document.documentElement.classList.add('live-map-page');
    document.body.classList.add('live-map-page');
    return () => {
      document.documentElement.classList.remove('live-map-page');
      document.body.classList.remove('live-map-page');
    };
  }, []);

  // Extract URL parameters - only one selection type at a time (priority: pin > layer+id > lat+lng)
  const pinIdFromUrl = searchParams.get('pin');
  const typeSlugFromUrl = searchParams.get('type');
  const layerFromUrl = searchParams.get('layer');
  const entityIdFromUrl = searchParams.get('id');
  const latFromUrl = searchParams.get('lat');
  const lngFromUrl = searchParams.get('lng');
  
  // Determine which selection type is active (only one at a time)
  const activeSelectionType = pinIdFromUrl 
    ? 'pin' 
    : (layerFromUrl && entityIdFromUrl) 
      ? 'boundary' 
      : (latFromUrl && lngFromUrl) 
        ? 'location' 
        : null;
  
  // Clear other selections when one is active
  const effectivePinId = activeSelectionType === 'pin' ? pinIdFromUrl : null;
  const effectiveLayer = activeSelectionType === 'boundary' ? layerFromUrl : null;
  const effectiveEntityId = activeSelectionType === 'boundary' ? entityIdFromUrl : null;
  const effectiveLat = activeSelectionType === 'location' ? latFromUrl : null;
  const effectiveLng = activeSelectionType === 'location' ? lngFromUrl : null;
  const [selectedPin, setSelectedPin] = useState<LivePinData | null>(null);
  const [isLoadingPin, setIsLoadingPin] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Simple cache: pinId -> pinData (no timestamps, no cleanup complexity)
  const pinCacheRef = useRef<Map<string, LivePinData>>(new Map());
  // Track in-flight requests to prevent duplicate fetches
  const inFlightRef = useRef<Map<string, Promise<LivePinData | null>>>(new Map());
  const [resolvedMentionType, setResolvedMentionType] = useState<MapInfoMentionType | null>(null);
  const supabase = useSupabaseClient();
  const clearMapSelectionRef = useRef<(() => void) | null>(null);

  /** Build /live URL: one selection (pin OR layer+id OR lat+lng), preserve type. Clears others. */
  const buildLiveUrl = useCallback(
    (updates: { pin?: string | null; layer?: string | null; id?: string | null; lat?: number | null; lng?: number | null; clearSelection?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      // Clear all entity type parameters
      next.delete('pin');
      next.delete('layer');
      next.delete('id');
      next.delete('lat');
      next.delete('lng');
      if (!updates.clearSelection) {
        if (updates.pin != null && updates.pin !== '') {
          next.set('pin', updates.pin);
        } else if (updates.layer != null && updates.layer !== '' && updates.id != null && updates.id !== '') {
          next.set('layer', updates.layer);
          next.set('id', updates.id);
        } else if (updates.lat != null && updates.lng != null) {
          next.set('lat', updates.lat.toString());
          next.set('lng', updates.lng.toString());
        }
      }
      const q = next.toString();
      return q ? `/live?${q}` : '/live';
    },
    [searchParams]
  );

  // Removed - pin state is handled by the useEffect below that sets 'tall'

  useEffect(() => {
    if (typeSlugFromUrl && !isContributeOpen) {
      setFooterOpen(true);
      setFooterTargetState('main'); // MentionTypeInfoCard → 'main' state
    }
  }, [typeSlugFromUrl, isContributeOpen]);

  // Resolve boundary from URL (layer + id) - only if it's the active selection
  useEffect(() => {
    if (activeSelectionType !== 'boundary' || !effectiveLayer || !effectiveEntityId) {
      if (activeSelectionType !== 'boundary') {
        setSelectedLocation(null);
      }
      return;
    }
    // Clear pin selection when boundary is selected
    setSelectedPin(null);
    setIsLoadingPin(false);
    let cancelled = false;
    resolveBoundaryByLayerId(effectiveLayer, effectiveEntityId)
      .then((loc) => {
        if (!cancelled && loc) {
          setSelectedLocation(loc);
          setFooterOpen(true);
          setFooterTargetState('main');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedLocation(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSelectionType, effectiveLayer, effectiveEntityId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setIsContributeOpen(window.location.hash === '#contribute');
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  useEffect(() => {
    if (!typeSlugFromUrl) {
      setResolvedMentionType(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('mention_types')
          .select('id, emoji, name')
          .eq('is_active', true);
        if (error) throw error;
        const all = (data || []) as { id: string; emoji: string; name: string }[];
        const match = all.find((t) => mentionTypeNameToSlug(t.name) === typeSlugFromUrl);
        if (!cancelled) setResolvedMentionType(match ?? null);
      } catch {
        if (!cancelled) setResolvedMentionType(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [typeSlugFromUrl, supabase]);

  // Simple fetch function with basic caching and deduplication
  const fetchPinData = useCallback(async (pinId: string): Promise<LivePinData | null> => {
    // Check cache first
    const cached = pinCacheRef.current.get(pinId);
    if (cached) {
      return cached;
    }

    // Check if request already in flight
    const inFlight = inFlightRef.current.get(pinId);
    if (inFlight) {
      return inFlight;
    }

    // Fetch and cache
    const promise = fetch(`/api/maps/live/pins/${pinId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LivePinData | null) => {
        if (data) {
          pinCacheRef.current.set(pinId, data);
        }
        return data;
      })
      .catch(() => null)
      .finally(() => {
        inFlightRef.current.delete(pinId);
      });

    inFlightRef.current.set(pinId, promise);
    return promise;
  }, []);

  // When URL has ?pin=, fetch pin data if needed - only if it's the active selection
  useEffect(() => {
    if (activeSelectionType !== 'pin' || !effectivePinId) {
      if (activeSelectionType !== 'pin') {
        setSelectedPin(null);
        setIsLoadingPin(false);
        setSelectedLocation(null);
      }
      return;
    }

    // Type guard: effectivePinId is guaranteed to be non-null here
    const pinId = effectivePinId;

    // If we already have this pin loaded, don't refetch
    if (selectedPin && String(selectedPin.id) === pinId) {
      setIsLoadingPin(false);
      return;
    }

    // Clear location selection when pin is selected
    setSelectedLocation(null);

    // Helper to check if pin has content
    const hasContent = (pin: LivePinData | null) => {
      if (!pin) return false;
      return !!(pin.description || pin.caption || pin.emoji || pin.image_url || pin.video_url);
    };

    // Check cache - if cached pin has no description, don't show skeleton
    const cached = pinCacheRef.current.get(pinId);
    if (cached) {
      setSelectedPin(cached);
      setIsLoadingPin(false);
      return;
    }

    // Fetch pin data
    // Show skeleton only if pin might have content (we'll check after fetch)
    setIsLoadingPin(true);
    setSelectedPin(null);

    let cancelled = false;
    fetchPinData(pinId)
      .then((data: LivePinData | null) => {
        if (!cancelled) {
          setSelectedPin(data);
          // Don't show skeleton if pin has no description/content
          setIsLoadingPin(hasContent(data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedPin(null);
          setIsLoadingPin(false);
        }
      });
    
    return () => {
      cancelled = true;
    };
  }, [activeSelectionType, effectivePinId, fetchPinData]);
  
  // Handle lat+lng location selection - only if it's the active selection
  useEffect(() => {
    if (activeSelectionType !== 'location' || !effectiveLat || !effectiveLng) {
      if (activeSelectionType !== 'location') {
        setSelectedLocation(null);
      }
      return;
    }
    
    // Clear pin selection when location is selected
    setSelectedPin(null);
    setIsLoadingPin(false);
    
    const lat = parseFloat(effectiveLat);
    const lng = parseFloat(effectiveLng);
    
    if (isNaN(lat) || isNaN(lng)) {
      setSelectedLocation(null);
      return;
    }
    
    setSelectedLocation({
      lat,
      lng,
      address: null,
      mapMeta: null,
    });
    setFooterOpen(true);
    setFooterTargetState('main');
  }, [activeSelectionType, effectiveLat, effectiveLng]);

  const handleLocationSelect = useCallback(
    async (info: { lat: number; lng: number; address: string | null; isOpen: boolean; mapMeta?: Record<string, any> | null }) => {
      if (!info.isOpen) return;
      const lat = Number(info.lat);
      const lng = Number(info.lng);
      const layer = info.mapMeta?.boundaryLayer as string | undefined;
      const entityId = info.mapMeta?.boundaryEntityId != null ? String(info.mapMeta.boundaryEntityId).trim() : '';
      
      // If it's a boundary, we need to fetch boundary data
      if (layer && entityId) {
        // Boundary data will be resolved by the useEffect that watches layerFromUrl/entityIdFromUrl
        setFooterOpen(true);
        setFooterTargetState('main');
        router.replace(
          buildLiveUrl({ layer, id: entityId })
        );
        return;
      }

      // Map click - check if mention type is selected and user is authenticated
      if (typeSlugFromUrl && resolvedMentionType && isAuthenticated && currentAccountId) {
        // Create pin immediately with selected mention type
        try {
          setIsLoadingPin(true);
          const mention = await MentionService.createMention({
            lat: Number.isFinite(lat) ? lat : 0,
            lng: Number.isFinite(lng) ? lng : 0,
            mention_type_id: resolvedMentionType.id,
            description: null, // No description yet - user can add later
            visibility: 'public',
            full_address: info.address || undefined,
            map_meta: info.mapMeta || undefined,
          }, currentAccountId);

          // Dispatch event for MentionsLayer to refresh
          window.dispatchEvent(new CustomEvent('mention-created', {
            detail: { mention }
          }));

          // Show the newly created pin
          const pinData: LivePinData = {
            id: mention.id,
            map_id: mention.map_id,
            lat: mention.lat,
            lng: mention.lng,
            description: mention.description,
            caption: (mention as any).caption || null, // caption may exist but not in type
            emoji: null,
            image_url: mention.image_url || null,
            video_url: (mention as any).video_url || null, // video_url may exist but not in type
            account_id: mention.account_id,
            created_at: mention.created_at,
            account: mention.account,
            mention_type: mention.mention_type,
            tagged_accounts: null,
          };
          
          setSelectedPin(pinData);
          setSelectedLocation(null);
          setIsLoadingPin(false);
          setFooterOpen(true);
          setFooterTargetState('tall');
          router.replace(buildLiveUrl({ pin: mention.id }));
        } catch (err) {
          console.error('[LivePage] Error creating pin:', err);
          setIsLoadingPin(false);
          // Fall through to show location selection
          setSelectedLocation({
            lat: Number.isFinite(lat) ? lat : 0,
            lng: Number.isFinite(lng) ? lng : 0,
            address: info.address,
            mapMeta: info.mapMeta ?? null,
          });
          setFooterOpen(true);
          setFooterTargetState('main');
          router.replace(buildLiveUrl({ clearSelection: true }));
        }
      } else {
        // No mention type selected or not authenticated - show location selection
        setSelectedPin(null);
        setIsLoadingPin(false);
        setSelectedLocation({
          lat: Number.isFinite(lat) ? lat : 0,
          lng: Number.isFinite(lng) ? lng : 0,
          address: info.address,
          mapMeta: info.mapMeta ?? null,
        });
        setFooterOpen(true);
        setFooterTargetState('main');
        router.replace(buildLiveUrl({ clearSelection: true }));
      }
    },
    [router, buildLiveUrl, typeSlugFromUrl, resolvedMentionType, isAuthenticated, currentAccountId]
  );

  // Listen for GeolocateControl geolocate event to show user location in footer
  // Must be after handleLocationSelect is defined
  useEffect(() => {
    if (!geolocateControlRef.current) return;

    const handleGeolocate = async (e: any) => {
      const coords = e.coords;
      if (!coords) return;

      const lat = coords.latitude;
      const lng = coords.longitude;

      // Reverse geocode to get address
      try {
        const { MAP_CONFIG } = await import('@/features/map/config');
        const token = MAP_CONFIG.MAPBOX_TOKEN;
        if (!token) return;

        const url = `${MAP_CONFIG.GEOCODING_BASE_URL}/${lng},${lat}.json`;
        const params = new URLSearchParams({
          access_token: token,
          types: 'address,poi,neighborhood,locality,place,postcode,district,region',
          limit: '1',
        });

        const response = await fetch(`${url}?${params}`);
        if (response.ok) {
          const data = await response.json();
          const address = data.features && data.features.length > 0
            ? data.features[0].place_name || null
            : null;

          // Show user location in footer
          handleLocationSelect({
            lat,
            lng,
            address,
            isOpen: true,
            mapMeta: {
              isUserLocation: true,
              feature: data.features?.[0] || null,
            },
          });
        } else {
          // Still show location even if reverse geocoding fails
          handleLocationSelect({
            lat,
            lng,
            address: null,
            isOpen: true,
            mapMeta: {
              isUserLocation: true,
            },
          });
        }
      } catch (err) {
        console.error('[LivePage] Failed to reverse geocode user location:', err);
        // Still show location even if reverse geocoding fails
        handleLocationSelect({
          lat,
          lng,
          address: null,
          isOpen: true,
          mapMeta: {
            isUserLocation: true,
          },
        });
      }
    };

    const control = geolocateControlRef.current;
    control.on('geolocate', handleGeolocate);

    return () => {
      control.off('geolocate', handleGeolocate);
    };
  }, [handleLocationSelect]);

  // Set footer to tall state when pin is selected
  useEffect(() => {
    if (pinIdFromUrl) {
      setFooterTargetState('tall');
    }
  }, [pinIdFromUrl]);

  const handleLivePinSelect = useCallback(
    (pinId: string, pinData?: Record<string, unknown> | null) => {
      // Clear location selection
      setSelectedLocation(null);
      setFooterOpen(true);
      // Set footer to tall state when pin is selected (LivePinCard)
      setFooterTargetState('tall');
      
      // If pinData provided, use it immediately
      if (pinData) {
        const pin = pinData as unknown as LivePinData;
        if (String(pin.id) === pinId) {
          pinCacheRef.current.set(pinId, pin);
          setSelectedPin(pin);
          setIsLoadingPin(false);
          startTransition(() => {
            router.replace(buildLiveUrl({ pin: pinId }));
          });
          return;
        }
      }
      
      // Check cache
      const cached = pinCacheRef.current.get(pinId);
      if (cached) {
        setSelectedPin(cached);
        setIsLoadingPin(false);
        startTransition(() => {
          router.replace(buildLiveUrl({ pin: pinId }));
        });
        return;
      }
      
      // Show skeleton immediately, then fetch
      setIsLoadingPin(true);
      setSelectedPin(null);
      
      // Update URL (useEffect will handle fetch)
      startTransition(() => {
        router.replace(buildLiveUrl({ pin: pinId }));
      });
    },
    [router, buildLiveUrl, startTransition]
  );

  const handleClearSelection = useCallback(() => {
    // Clear all URL parameters
    router.replace('/live');
    setSelectedLocation(null);
    setSelectedPin(null);
    setIsLoadingPin(false);
    setFooterOpen(false);
    // Set footer to low state when closing
    setFooterTargetState('low');
    clearMapSelectionRef.current?.();
  }, [router]);


  const handleAddToMap = useCallback((loc: MapInfoLocation, mentionTypeId?: string) => {
    // Rate limit: 1 per 3 seconds
    const now = Date.now();
    const timeSinceLastAdd = now - lastAddToMapTimeRef.current;
    if (timeSinceLastAdd < 3000) {
      return; // Ignore if less than 3 seconds since last add
    }
    lastAddToMapTimeRef.current = now;

    if (!liveMapId) {
      // Wait for live map ID to be loaded
      return;
    }

    // Store location data in sessionStorage for ContributeOverlay to read
    const dataKey = `contribute_${Date.now()}`;
    sessionStorage.setItem(
      dataKey,
      JSON.stringify({
        mapMeta: loc.mapMeta || null,
        fullAddress: loc.address || null,
      })
    );

    // Set coordinates and mention type in URL for ContributeOverlay
    const params = new URLSearchParams();
    params.set('lat', String(loc.lat));
    params.set('lng', String(loc.lng));
    if (mentionTypeId) {
      params.set('mention_type_id', mentionTypeId);
    }
    params.set('data_key', dataKey);
    
    // Update URL without navigation
    router.replace(`/live?${params.toString()}`, { scroll: false });

    // Show contribute overlay
    setContributeLocation(loc);
    setContributeMentionTypeId(mentionTypeId);
    setShowContributeOverlay(true);
  }, [liveMapId, router]);

  const handleContributeClose = useCallback(() => {
    setShowContributeOverlay(false);
    setContributeLocation(null);
    setContributeMentionTypeId(undefined);
    
    // Clean up URL params
    const params = new URLSearchParams(searchParams.toString());
    params.delete('lat');
    params.delete('lng');
    params.delete('mention_type_id');
    params.delete('data_key');
    const qs = params.toString();
    router.replace(qs ? `/live?${qs}` : '/live', { scroll: false });
  }, [router, searchParams]);

  const handleMentionCreated = useCallback(
    (mention: any) => {
      // Dispatch event for MentionsLayer to refresh
      window.dispatchEvent(
        new CustomEvent('mention-created', {
          detail: { mention },
        })
      );

      // Show the newly created pin
      const pinData: LivePinData = {
        id: mention.id,
        map_id: mention.map_id,
        lat: mention.lat,
        lng: mention.lng,
        description: mention.description,
        caption: (mention as any).caption || null,
        emoji: null,
        image_url: mention.image_url || null,
        video_url: (mention as any).video_url || null,
        account_id: mention.account_id,
        created_at: mention.created_at,
        account: mention.account,
        mention_type: mention.mention_type,
        tagged_accounts: null,
      };

      setSelectedPin(pinData);
      setSelectedLocation(null);
      setIsLoadingPin(false);
      setShowContributeOverlay(false);
      setContributeLocation(null);
      setContributeMentionTypeId(undefined);
      setFooterOpen(true);
      setFooterTargetState('tall');
      router.replace(buildLiveUrl({ pin: mention.id }));
    },
    [router, buildLiveUrl]
  );

  const handleClickedItemClick = useCallback((item: { type: 'pin' | 'area' | 'map' | 'boundary'; id?: string; lat: number; lng: number; layer?: 'state' | 'county' | 'district' | 'ctu'; username?: string | null }) => {
    // Clear previous selection state
    setSelectedPin(null);
    setSelectedLocation(null);
    
    if (item.type === 'pin' && item.id) {
      // Route to pin - clears all other entity types (layer+id, lat+lng)
      // Set loading immediately and update URL (triggers skeleton)
      setIsLoadingPin(true);
      router.replace(buildLiveUrl({ pin: item.id }));
      setFooterOpen(true);
    } else if (item.type === 'boundary' && item.id && item.layer) {
      // Route to boundary with layer and id - clears all other entity types (pin, lat+lng)
      setIsLoadingPin(false);
      router.replace(buildLiveUrl({ layer: item.layer, id: item.id }));
      setFooterOpen(true);
    } else if (item.type === 'map') {
      // Route to map coordinates - clears all other entity types (pin, layer+id)
      setIsLoadingPin(false);
      router.replace(buildLiveUrl({ lat: item.lat, lng: item.lng }));
      setFooterOpen(true);
    } else if (item.type === 'area' && item.id) {
      // Areas zoom to coordinates - clears all other entity types (pin, layer+id)
      setIsLoadingPin(false);
      router.replace(buildLiveUrl({ lat: item.lat, lng: item.lng }));
      setFooterOpen(true);
    }
  }, [router, buildLiveUrl]);

  const footerHeaderLabel = useMemo(
    () =>
      activeSelectionType === 'pin'
        ? 'Pin'
        : getFooterHeaderLabel(selectedLocation),
    [activeSelectionType, selectedLocation]
  );

  const footerContent = useMemo(() => {
    if (activeSelectionType === 'pin' && effectivePinId) {
      const pin = selectedPin && String(selectedPin.id) === effectivePinId ? selectedPin : null;
      // LivePinCard shows skeleton when pin is null (handles loading state internally)
      return (
        <LivePinCard
          pinId={effectivePinId}
          pin={pin}
          currentAccountId={currentAccountId}
        />
      );
    }
    const showMentionTypeCard = typeSlugFromUrl && !isContributeOpen;
    return (
      <>
        {showMentionTypeCard && !selectedLocation && <MentionTypeInfoCard typeSlug={typeSlugFromUrl} />}
        <MapInfo
          location={selectedLocation}
          zoom={liveStatus.currentZoom}
          onAddToMap={handleAddToMap}
          mentionType={showMentionTypeCard && resolvedMentionType ? resolvedMentionType : null}
          onMentionCreated={(mention) => {
            // Set footer to low state after successful submission
            setFooterTargetState('low');
            // Clear location selection
            setSelectedLocation(null);
            // Close MapInfo
            handleClearSelection();
          }}
        />
      </>
    );
  }, [activeSelectionType, effectivePinId, selectedPin, currentAccountId, typeSlugFromUrl, isContributeOpen, selectedLocation, resolvedMentionType, liveStatus.currentZoom, handleClearSelection, handleAddToMap]);

  const { openWelcome, isModalOpen } = useAppModalContextSafe();

  const handleLocationSelectForFooter = useCallback(
    (coordinates: { lat: number; lng: number }, placeName: string, mapboxMetadata?: any) => {
      handleLocationSelect({
        lat: coordinates.lat,
        lng: coordinates.lng,
        address: placeName || null,
        isOpen: true,
        mapMeta: mapboxMetadata || null,
      });
    },
    [handleLocationSelect]
  );

  // Listen for city boundary selection from search (must be after handleLocationSelect is defined)
  useEffect(() => {
    const handleCityBoundarySelect = (event: Event) => {
      const customEvent = event as CustomEvent<{
        layer: 'ctu';
        id: string;
        name: string;
        city: any;
      }>;
      
      const { id, name, city } = customEvent.detail;
      
      // Enable CTU layer if not already enabled
      if (liveBoundaryLayer !== 'ctu') {
        setLiveBoundaryLayer('ctu');
      }
      
      // Calculate center from geometry
      const getCenterFromGeometry = (geometry: any): { lat: number; lng: number } | null => {
        if (!geometry) return null;
        
        try {
          // Handle FeatureCollection
          if (geometry.type === 'FeatureCollection' && geometry.features && geometry.features.length > 0) {
            return getCenterFromGeometry(geometry.features[0].geometry);
          }
          
          // Handle Feature
          if (geometry.type === 'Feature' && geometry.geometry) {
            return getCenterFromGeometry(geometry.geometry);
          }
          
          // Handle Point
          if (geometry.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
            return { lng: geometry.coordinates[0], lat: geometry.coordinates[1] };
          }
          
          // Handle Polygon
          if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
            const ring = geometry.coordinates[0];
            if (Array.isArray(ring) && ring.length > 0) {
              let sumLng = 0;
              let sumLat = 0;
              let count = 0;
              
              for (const coord of ring) {
                if (Array.isArray(coord) && coord.length >= 2) {
                  sumLng += coord[0];
                  sumLat += coord[1];
                  count++;
                }
              }
              
              if (count > 0) {
                return { lng: sumLng / count, lat: sumLat / count };
              }
            }
          }
          
          // Handle MultiPolygon
          if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0) {
            const firstPolygon = geometry.coordinates[0];
            if (Array.isArray(firstPolygon) && firstPolygon.length > 0) {
              const ring = firstPolygon[0];
              if (Array.isArray(ring) && ring.length > 0) {
                let sumLng = 0;
                let sumLat = 0;
                let count = 0;
                
                for (const coord of ring) {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    sumLng += coord[0];
                    sumLat += coord[1];
                    count++;
                  }
                }
                
                if (count > 0) {
                  return { lng: sumLng / count, lat: sumLat / count };
                }
              }
            }
          }
        } catch (error) {
          console.error('Error calculating center from geometry:', error);
        }
        
        return null;
      };
      
      const center = getCenterFromGeometry(city.geometry);
      if (center) {
        // Update URL with boundary selection
        router.replace(
          buildLiveUrl({ layer: 'ctu', id })
        );
        
        // Trigger location select to update footer
        handleLocationSelect({
          lat: center.lat,
          lng: center.lng,
          address: name,
          isOpen: true,
          mapMeta: {
            boundaryLayer: 'ctu',
            boundaryName: name,
            boundaryEntityId: id,
            feature: { name },
            boundaryDetails: { ...city, geometry: undefined },
          },
        });
      }
    };

    window.addEventListener('city-boundary-select', handleCityBoundarySelect);
    return () => {
      window.removeEventListener('city-boundary-select', handleCityBoundarySelect);
    };
  }, [liveBoundaryLayer, router, handleLocationSelect, buildLiveUrl]);

  // Fetch nearby pins when search is active (moved from AppFooter)
  useEffect(() => {
    if (!isSearchActive || !mapCenter) {
      setNearbyPins([]);
      setLoadingNearby(false);
      return;
    }

    const fetchNearbyPins = async () => {
      setLoadingNearby(true);
      try {
        const radiusInKm = 20 * 1.60934; // 20 miles in km
        const response = await fetch(
          `/api/mentions/nearby?lat=${mapCenter.lat}&lng=${mapCenter.lng}&radius=${radiusInKm}`
        );
        
        if (response.ok) {
          const data = await response.json();
          setNearbyPins((data.mentions || []).slice(0, 20) as NearbyPin[]);
        }
      } catch (err) {
        console.error('Error fetching nearby pins:', err);
        setNearbyPins([]);
      } finally {
        setLoadingNearby(false);
      }
    };

    const timeoutId = setTimeout(fetchNearbyPins, 300);
    return () => clearTimeout(timeoutId);
  }, [isSearchActive, mapCenter]);

  // Compute visibility flags for MapControls
  const hasPinSelection = activeSelectionType === 'pin' && Boolean(effectivePinId || selectedPin);
  const hasLocationSelection = (activeSelectionType === 'boundary' || activeSelectionType === 'location') && Boolean(selectedLocation);
  const hasMentionTypeFilter = Boolean(typeSlugFromUrl && !isContributeOpen);
  const hasSelection = Boolean(hasPinSelection || hasLocationSelection || (typeSlugFromUrl && !isContributeOpen));
  const showSearchResults = isSearchActive;
  // Hide mention types when location is selected (when location selected card is shown)
  const showMentionTypes = !isSearching && !hasPinSelection && !hasLocationSelection;
  const showNearbyPins = !isSearching && !hasPinSelection && !hasLocationSelection && !hasMentionTypeFilter;

  return (
    <AppContainer>
        <MapPage
        params={Promise.resolve({ id: 'live' })}
        skipPageWrapper
        onLocationSelect={handleLocationSelect}
        onLiveStatusChange={setLiveStatus}
        onLivePinSelect={handleLivePinSelect}
        liveBoundaryLayer={liveBoundaryLayer}
        pinDisplayGrouping={pinDisplayGrouping}
        showOnlyMyPins={isAuthenticated ? showOnlyMyPins : false}
        timeFilter={timeFilter}
        onRegisterClearSelection={(fn) => {
          clearMapSelectionRef.current = fn;
        }}
        onMapInstanceReady={setMapInstance}
        onGeolocateControlReady={handleGeolocateControlReady}
      />
      {/* MapControls - replaces AppFooter */}
      <MapControls
        children={footerContent}
        statusContent={undefined}
        onAccountImageClick={() => setMenuOpen(true)}
        onUniversalClose={handleClearSelection}
        showCloseIcon={hasSelection}
        map={mapInstance || undefined}
        onLocationSelect={handleLocationSelectForFooter}
        showMentionTypes={showMentionTypes}
      />
      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        liveBoundaryLayer={liveBoundaryLayer}
        onLiveBoundaryLayerChange={setLiveBoundaryLayer}
        pinDisplayGrouping={pinDisplayGrouping}
        onPinDisplayGroupingChange={setPinDisplayGrouping}
        showOnlyMyPins={isAuthenticated ? showOnlyMyPins : false}
        onShowOnlyMyPinsChange={isAuthenticated ? setShowOnlyMyPins : undefined}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
      />
      {/* Contribute Overlay */}
      {liveMapId && showContributeOverlay && (
        <ContributeOverlay
          isOpen={showContributeOverlay}
          onClose={handleContributeClose}
          mapId={liveMapId}
          mapSlug="live"
          onMentionCreated={handleMentionCreated}
        />
      )}
        </AppContainer>
  );
}

export default function LivePage() {
  return (
    <LiveHeaderThemeSync>
      <SearchStateProvider>
        <LivePageContent />
      </SearchStateProvider>
    </LiveHeaderThemeSync>
  );
}
