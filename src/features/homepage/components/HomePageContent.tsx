'use client';

import { useState, useCallback, useEffect, useMemo, useRef, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSearchState } from '@/contexts/SearchStateContext';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MapInfo, { type MapInfoLocation, type MapInfoMentionType } from '@/components/layout/MapInfo';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import LivePinCard, { type LivePinData } from '@/components/layout/LivePinCard';
import MentionTypeInfoCard from '@/components/layout/MentionTypeInfoCard';
import { useAuthStateSafe } from '@/features/auth';
import { getLiveLayerLabel, type LiveBoundaryLayerId } from '@/features/map/config';
import { resolveBoundaryByLayerId } from '@/features/map/services/liveBoundaryCache';
import MapPage from '@/app/map/[id]/page';
import { generateUUID } from '@/lib/utils/uuid';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { MapInstance } from '@/components/layout/types';
import type { LiveMapFooterStatusState } from '@/components/layout/LiveMapFooterStatus';
import { MentionService } from '@/features/mentions/services/mentionService';
import MapControls from '@/components/layout/MapControls';
import type { NearbyPin } from '@/components/layout/types';
import AppMenu from '@/components/layout/AppMenu';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import LiveMapLeftSidebar from '@/components/maps/LiveMapLeftSidebar';
import LiveMapRightSidebar from '@/components/maps/LiveMapRightSidebar';
import MobileMentionTypeCarousel from '@/components/maps/MobileMentionTypeCarousel';

export default function HomePageContent() {
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
  const [liveBoundaryLayer, setLiveBoundaryLayer] = useState<LiveBoundaryLayerId | null>(null);
  const [pinDisplayGrouping, setPinDisplayGrouping] = useState(false);
  const [showOnlyMyPins, setShowOnlyMyPins] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveMapFooterStatusState>({
    loadingData: true,
    mapLoaded: false,
    loadingPins: false,
    currentZoom: undefined as number | undefined,
  });
  const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyPins, setNearbyPins] = useState<NearbyPin[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [liveMapId, setLiveMapId] = useState<string | null>(null);
  const lastAddToMapTimeRef = useRef<number>(0);
  const geolocateControlRef = useRef<any>(null);
  const clearMapSelectionRef = useRef<(() => void) | null>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const pinCacheRef = useRef<Map<string, LivePinData>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<LivePinData | null>>>(new Map());
  const [selectedPin, setSelectedPin] = useState<LivePinData | null>(null);
  const [isLoadingPin, setIsLoadingPin] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [resolvedMentionType, setResolvedMentionType] = useState<MapInfoMentionType | null>(null);
  const supabase = useSupabaseClient();
  const { openWelcome, isModalOpen, modal } = useAppModalContextSafe();
  const isWelcomeModalOpen = modal.type === 'welcome';

  // Fetch live map ID
  useEffect(() => {
    fetch('/api/maps/live')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          console.error('[HomePageContent] Failed to fetch live map:', data);
          // Try using dynamic route as fallback
          const fallbackRes = await fetch('/api/maps/dynamic/live');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData?.map?.id) {
              setLiveMapId(fallbackData.map.id);
              return;
            }
          }
          return;
        }
        if (data?.id) {
          setLiveMapId(data.id);
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
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.error('[HomePageContent] Error fetching live map:', err);
      });
  }, []);

  // Track map center
  useEffect(() => {
    if (liveStatus.mapLoaded && mapInstance) {
      try {
        const center = mapInstance.getCenter();
        if (center) {
          setMapCenter({ lat: center.lat, lng: center.lng });
        }
      } catch (err) {}
    }
  }, [liveStatus.mapLoaded, mapInstance]);

  useEffect(() => {
    if (!mapInstance || !liveStatus.mapLoaded) return;
    const updateCenter = () => {
      try {
        const center = mapInstance.getCenter();
        if (center) {
          setMapCenter({ lat: center.lat, lng: center.lng });
        }
      } catch (err) {}
    };
    mapInstance.on('moveend', updateCenter);
    return () => {
      mapInstance.off('moveend', updateCenter);
    };
  }, [mapInstance, liveStatus.mapLoaded]);

  // Disable "show only my pins" for non-authenticated users
  useEffect(() => {
    if (!isAuthenticated && showOnlyMyPins) {
      setShowOnlyMyPins(false);
    }
  }, [isAuthenticated, showOnlyMyPins]);

  // Extract URL parameters
  const pinIdFromUrl = searchParams.get('pin');
  const typeSlugFromUrl = searchParams.get('type');
  const layerFromUrl = searchParams.get('layer');
  const entityIdFromUrl = searchParams.get('id');
  const latFromUrl = searchParams.get('lat');
  const lngFromUrl = searchParams.get('lng');

  const activeSelectionType = pinIdFromUrl 
    ? 'pin' 
    : (layerFromUrl && entityIdFromUrl) 
      ? 'boundary' 
      : (latFromUrl && lngFromUrl) 
        ? 'location' 
        : null;

  const effectivePinId = activeSelectionType === 'pin' ? pinIdFromUrl : null;
  const effectiveLayer = activeSelectionType === 'boundary' ? layerFromUrl : null;
  const effectiveEntityId = activeSelectionType === 'boundary' ? entityIdFromUrl : null;
  const effectiveLat = activeSelectionType === 'location' ? latFromUrl : null;
  const effectiveLng = activeSelectionType === 'location' ? lngFromUrl : null;

  const buildLiveUrl = useCallback(
    (updates: { pin?: string | null; layer?: string | null; id?: string | null; lat?: number | null; lng?: number | null; clearSelection?: boolean }) => {
      const next = new URLSearchParams(searchParams);
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
      return q ? `/?${q}` : '/';
    },
    [searchParams]
  );

  // Resolve mention type
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

  // Fetch pin data
  const fetchPinData = useCallback(async (pinId: string): Promise<LivePinData | null> => {
    const cached = pinCacheRef.current.get(pinId);
    if (cached) return cached;
    const inFlight = inFlightRef.current.get(pinId);
    if (inFlight) return inFlight;
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

  // Handle pin selection from URL
  useEffect(() => {
    if (activeSelectionType !== 'pin' || !effectivePinId) {
      if (activeSelectionType !== 'pin') {
        setSelectedPin(null);
        setIsLoadingPin(false);
        setSelectedLocation(null);
      }
      return;
    }
    const pinId = effectivePinId;
    if (selectedPin && String(selectedPin.id) === pinId) {
      setIsLoadingPin(false);
      return;
    }
    setSelectedLocation(null);
    const cached = pinCacheRef.current.get(pinId);
    if (cached) {
      setSelectedPin(cached);
      setIsLoadingPin(false);
      return;
    }
    setIsLoadingPin(true);
    setSelectedPin(null);
    let cancelled = false;
    fetchPinData(pinId)
      .then((data: LivePinData | null) => {
        if (!cancelled) {
          setSelectedPin(data);
          setIsLoadingPin(!!(data && (data.description || data.caption || data.emoji || data.image_url || data.video_url)));
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
  }, [activeSelectionType, effectivePinId, fetchPinData, selectedPin]);

  // Handle boundary selection from URL
  useEffect(() => {
    if (activeSelectionType !== 'boundary' || !effectiveLayer || !effectiveEntityId) {
      if (activeSelectionType !== 'boundary') {
        setSelectedLocation(null);
      }
      return;
    }
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

  // Handle location selection from URL
  useEffect(() => {
    if (activeSelectionType !== 'location' || !effectiveLat || !effectiveLng) {
      if (activeSelectionType !== 'location') {
        setSelectedLocation(null);
      }
      return;
    }
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

  // Handle mention type filter
  useEffect(() => {
    if (typeSlugFromUrl) {
      setFooterOpen(true);
      setFooterTargetState('main');
    }
  }, [typeSlugFromUrl]);

  // Handle location select
  const handleLocationSelect = useCallback(
    async (info: { lat: number; lng: number; address: string | null; isOpen: boolean; mapMeta?: Record<string, any> | null }) => {
      if (!info.isOpen) return;
      const lat = Number(info.lat);
      const lng = Number(info.lng);
      const layer = info.mapMeta?.boundaryLayer as string | undefined;
      const entityId = info.mapMeta?.boundaryEntityId != null ? String(info.mapMeta.boundaryEntityId).trim() : '';
      
      if (layer && entityId) {
        setFooterOpen(true);
        setFooterTargetState('main');
        router.replace(buildLiveUrl({ layer, id: entityId }));
        return;
      }

      if (typeSlugFromUrl && resolvedMentionType && isAuthenticated && currentAccountId) {
        try {
          setIsLoadingPin(true);
          const mention = await MentionService.createMention({
            lat: Number.isFinite(lat) ? lat : 0,
            lng: Number.isFinite(lng) ? lng : 0,
            mention_type_id: resolvedMentionType.id,
            description: null,
            visibility: 'public',
            full_address: info.address || undefined,
            map_meta: info.mapMeta || undefined,
          }, currentAccountId);

          window.dispatchEvent(new CustomEvent('mention-created', {
            detail: { mention }
          }));

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
          setFooterOpen(true);
          setFooterTargetState('tall');
          router.replace(buildLiveUrl({ pin: mention.id }));
        } catch (err) {
          console.error('[HomePage] Error creating pin:', err);
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
      } else {
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

  const handleGeolocateControlReady = useCallback((control: any) => {
    geolocateControlRef.current = control;
  }, []);

  // Handle geolocate event
  useEffect(() => {
    if (!geolocateControlRef.current) return;
    const handleGeolocate = async (e: any) => {
      const coords = e.coords;
      if (!coords) return;
      const lat = coords.latitude;
      const lng = coords.longitude;
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

  const handleLivePinSelect = useCallback(
    (pinId: string, pinData?: Record<string, unknown> | null) => {
      setSelectedLocation(null);
      setFooterOpen(true);
      setFooterTargetState('tall');
      
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
      
      const cached = pinCacheRef.current.get(pinId);
      if (cached) {
        setSelectedPin(cached);
        setIsLoadingPin(false);
        startTransition(() => {
          router.replace(buildLiveUrl({ pin: pinId }));
        });
        return;
      }
      
      setIsLoadingPin(true);
      setSelectedPin(null);
      startTransition(() => {
        router.replace(buildLiveUrl({ pin: pinId }));
      });
    },
    [router, buildLiveUrl, startTransition]
  );

  const handleClearSelection = useCallback(() => {
    router.replace('/');
    setSelectedLocation(null);
    setSelectedPin(null);
    setIsLoadingPin(false);
    setFooterOpen(false);
    setFooterTargetState('low');
    clearMapSelectionRef.current?.();
  }, [router]);

  const handleAddToMap = useCallback((loc: MapInfoLocation) => {
    const now = Date.now();
    const timeSinceLastAdd = now - lastAddToMapTimeRef.current;
    if (timeSinceLastAdd < 3000) return;
    lastAddToMapTimeRef.current = now;

    const params = new URLSearchParams();
    params.set('lat', String(loc.lat));
    params.set('lng', String(loc.lng));
    if (resolvedMentionType) {
      params.set('type', mentionTypeNameToSlug(resolvedMentionType.name));
    }
    router.push(params.toString() ? `/maps?${params.toString()}` : '/maps');
  }, [router, resolvedMentionType]);

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

  // Set footer to tall when pin selected
  useEffect(() => {
    if (pinIdFromUrl) {
      setFooterTargetState('tall');
    }
  }, [pinIdFromUrl]);

  // Fetch nearby pins when search is active
  useEffect(() => {
    if (!isSearchActive || !mapCenter) {
      setNearbyPins([]);
      setLoadingNearby(false);
      return;
    }
    const fetchNearbyPins = async () => {
      setLoadingNearby(true);
      try {
        const radiusInKm = 20 * 1.60934;
        const response = await fetch(
          `/api/mentions/nearby?lat=${mapCenter.lat}&lng=${mapCenter.lng}&radius=${radiusInKm}`
        );
        if (response.ok) {
          const data = await response.json();
          setNearbyPins((data.mentions || []).slice(0, 20) as NearbyPin[]);
        }
      } catch (err) {
        setNearbyPins([]);
      } finally {
        setLoadingNearby(false);
      }
    };
    const timeoutId = setTimeout(fetchNearbyPins, 300);
    return () => clearTimeout(timeoutId);
  }, [isSearchActive, mapCenter]);

  // Footer content
  const footerContent = useMemo(() => {
    if (activeSelectionType === 'pin' && effectivePinId) {
      const pin = selectedPin && String(selectedPin.id) === effectivePinId ? selectedPin : null;
      return (
        <LivePinCard
          pinId={effectivePinId}
          pin={pin}
          currentAccountId={currentAccountId}
        />
      );
    }
    const showMentionTypeCard = Boolean(typeSlugFromUrl);
    return (
      <>
        {showMentionTypeCard && !selectedLocation && typeSlugFromUrl != null && (
          <MentionTypeInfoCard typeSlug={typeSlugFromUrl} />
        )}
        <MapInfo
          location={selectedLocation}
          zoom={liveStatus.currentZoom}
          onAddToMap={handleAddToMap}
          mentionType={showMentionTypeCard && resolvedMentionType ? resolvedMentionType : null}
          onMentionCreated={(mention) => {
            setFooterTargetState('low');
            setSelectedLocation(null);
            handleClearSelection();
          }}
        />
      </>
    );
  }, [activeSelectionType, effectivePinId, selectedPin, currentAccountId, typeSlugFromUrl, selectedLocation, resolvedMentionType, liveStatus.currentZoom, handleClearSelection, handleAddToMap]);

  const hasPinSelection = activeSelectionType === 'pin' && Boolean(effectivePinId || selectedPin);
  const hasLocationSelection = (activeSelectionType === 'boundary' || activeSelectionType === 'location') && Boolean(selectedLocation);
  const hasMentionTypeFilter = Boolean(typeSlugFromUrl);
  const hasSelection = Boolean(hasPinSelection || hasLocationSelection || typeSlugFromUrl);
  const showMentionTypes = !isSearching && !hasPinSelection && !hasLocationSelection;
  const showNearbyPins = !isSearching && !hasPinSelection && !hasLocationSelection && !hasMentionTypeFilter;


  return (
    <>
      <PageViewTracker />
      <NewPageWrapper
        leftSidebar={<LiveMapLeftSidebar />}
        rightSidebar={<LiveMapRightSidebar />}
      >
        {/* Map area: map + MapControls positioned inside */}
        <div ref={mapAreaRef} className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden">
          {showMentionTypes && (
            <MobileMentionTypeCarousel visible={showMentionTypes} />
          )}
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
          {!isWelcomeModalOpen && (
            <MapControls
              anchorRef={mapAreaRef}
              children={footerContent}
              statusContent={undefined}
              onAccountImageClick={() => setMenuOpen(true)}
              onUniversalClose={handleClearSelection}
              showCloseIcon={hasSelection}
              map={mapInstance || undefined}
              onLocationSelect={handleLocationSelectForFooter}
              showMentionTypes={showMentionTypes}
            />
          )}
        </div>
        
        {/* AppMenu */}
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
      </NewPageWrapper>
    </>
  );
}
