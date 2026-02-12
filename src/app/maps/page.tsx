'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { SearchStateProvider } from '@/contexts/SearchStateContext';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import MapInfo, { type MapInfoLocation } from '@/components/layout/MapInfo';
import LivePinCard, { type LivePinData } from '@/components/layout/LivePinCard';
import MapPage from '../map/[id]/page';
import MapsPageFooter from '@/components/maps/MapsPageFooter';
import MentionTypeFilter from './components/MentionTypeFilter';
import MapStylesPopup from '@/components/layout/MapStylesPopup';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

export interface LiveMapData {
  map: { id: string; name?: string; slug?: string };
  pins: any[];
  tags: { id: string; emoji: string; name: string }[];
}

function MapsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeAccountId, account } = useAuthStateSafe();
  const currentAccountId = activeAccountId ?? null;
  const { modal } = useAppModalContextSafe();
  const isWelcomeModalOpen = modal.type === 'welcome';

  const [liveData, setLiveData] = useState<LiveMapData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | 'all'>('7d');
  const [showDistricts, setShowDistricts] = useState(false);
  const [showCTU, setShowCTU] = useState(false);
  const [showStateBoundary, setShowStateBoundary] = useState(false);
  const [showCountyBoundaries, setShowCountyBoundaries] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<MapInfoLocation | null>(null);
  const [liveStatus, setLiveStatus] = useState({ loadingData: true, mapLoaded: false, loadingPins: false, currentZoom: 0 });
  const [selectedPin, setSelectedPin] = useState<LivePinData | null>(null);
  const [isLoadingPin, setIsLoadingPin] = useState(false);
  const pinCacheRef = useRef<Map<string, LivePinData>>(new Map());
  const clearMapSelectionRef = useRef<(() => void) | null>(null);

  const pinIdFromUrl = searchParams.get('pin');
  const latFromUrl = searchParams.get('lat');
  const lngFromUrl = searchParams.get('lng');
  const hasPinSelection = Boolean(pinIdFromUrl);
  const hasLocationSelection = Boolean(latFromUrl && lngFromUrl);
  const hasSelection = hasPinSelection || hasLocationSelection;
  const showMentionTypes = !hasPinSelection && !hasLocationSelection;

  // Single fetch: public.map_pins + public.mention_types (no map lookup)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/maps/public')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.pins) return;
        setLiveData({
          map: data.map || { id: 'public', name: 'Minnesota', slug: 'public' },
          pins: data.pins || [],
          tags: data.mention_types || [],
        });
      })
      .catch((err) => console.error('[MapsPage] Fetch error:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const buildLiveUrl = useCallback(
    (updates: { pin?: string | null; lat?: number | null; lng?: number | null; clearSelection?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      next.delete('pin');
      next.delete('lat');
      next.delete('lng');
      if (!updates.clearSelection) {
        if (updates.pin != null && updates.pin !== '') {
          next.set('pin', updates.pin);
        } else if (updates.lat != null && updates.lng != null) {
          next.set('lat', updates.lat.toString());
          next.set('lng', updates.lng.toString());
        }
      }
      const q = next.toString();
      return q ? `/maps?${q}` : '/maps';
    },
    [searchParams]
  );

  const fetchPinData = useCallback(async (pinId: string): Promise<LivePinData | null> => {
    const cached = pinCacheRef.current.get(pinId);
    if (cached) return cached;
    const res = await fetch(`/api/pins/${pinId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data) pinCacheRef.current.set(pinId, data);
    return data;
  }, []);

  useEffect(() => {
    if (!hasPinSelection || !pinIdFromUrl) {
      setSelectedPin(null);
      setIsLoadingPin(false);
      return;
    }
    const cached = pinCacheRef.current.get(pinIdFromUrl);
    if (cached) {
      setSelectedPin(cached);
      setIsLoadingPin(false);
      return;
    }
    setIsLoadingPin(true);
    setSelectedPin(null);
    let cancelled = false;
    fetchPinData(pinIdFromUrl).then((data) => {
      if (!cancelled) {
        setSelectedPin(data);
        setIsLoadingPin(Boolean(data && (data.description || data.caption || data.emoji || data.image_url || data.video_url)));
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingPin(false);
    });
    return () => { cancelled = true; };
  }, [hasPinSelection, pinIdFromUrl, fetchPinData]);

  useEffect(() => {
    if (!hasLocationSelection || !latFromUrl || !lngFromUrl) {
      setSelectedLocation(null);
      return;
    }
    setSelectedPin(null);
    const lat = parseFloat(latFromUrl);
    const lng = parseFloat(lngFromUrl);
    if (!isNaN(lat) && !isNaN(lng)) {
      setSelectedLocation({ lat, lng, address: null, mapMeta: null });
    }
  }, [hasLocationSelection, latFromUrl, lngFromUrl]);

  const handleLocationSelect = useCallback(
    (info: { lat: number; lng: number; address: string | null; isOpen: boolean }) => {
      if (!info.isOpen) return;
      setSelectedPin(null);
      setSelectedLocation({
        lat: info.lat,
        lng: info.lng,
        address: info.address,
        mapMeta: null,
      });
      router.replace(buildLiveUrl({ lat: info.lat, lng: info.lng }));
    },
    [router, buildLiveUrl]
  );

  const handleLivePinSelect = useCallback(
    (pinId: string, pinData?: Record<string, unknown> | null) => {
      setSelectedLocation(null);
      if (pinData) {
        const pin = pinData as unknown as LivePinData;
        if (String(pin.id) === pinId) {
          pinCacheRef.current.set(pinId, pin);
          setSelectedPin(pin);
          setIsLoadingPin(false);
          router.replace(buildLiveUrl({ pin: pinId }));
          return;
        }
      }
      const cached = pinCacheRef.current.get(pinId);
      if (cached) {
        setSelectedPin(cached);
        setIsLoadingPin(false);
        router.replace(buildLiveUrl({ pin: pinId }));
        return;
      }
      setIsLoadingPin(true);
      setSelectedPin(null);
      router.replace(buildLiveUrl({ pin: pinId }));
    },
    [router, buildLiveUrl]
  );

  const handleClearSelection = useCallback(() => {
    router.replace('/maps');
    setSelectedLocation(null);
    setSelectedPin(null);
    setIsLoadingPin(false);
    clearMapSelectionRef.current?.();
  }, [router]);

  const footerContent = useMemo(() => {
    if (hasPinSelection && pinIdFromUrl) {
      const pin = selectedPin && String(selectedPin.id) === pinIdFromUrl ? selectedPin : null;
      return (
        <LivePinCard
          pinId={pinIdFromUrl}
          pin={pin}
          currentAccountId={currentAccountId}
        />
      );
    }
    return (
      <MapInfo
        location={selectedLocation}
        zoom={liveStatus.currentZoom}
        emptyLabel="Explore public pins on the map."
        onClose={handleClearSelection}
      />
    );
  }, [hasPinSelection, pinIdFromUrl, selectedPin, currentAccountId, selectedLocation, liveStatus.currentZoom, handleClearSelection]);

  const initialData = useMemo(() => {
    if (!liveData) return null;
    return {
      map: liveData.map as any,
      pins: liveData.pins,
      areas: [],
      members: null,
      tags: liveData.tags,
    };
  }, [liveData]);

  if (loading || !liveData?.pins) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-3.5rem)] bg-gray-50">
        <div className="text-sm text-gray-500">Loading map…</div>
      </div>
    );
  }

  return (
    <>
      <PageViewTracker />
      <NewPageWrapper leftSidebar={<LeftSidebar />} rightSidebar={<RightSidebar />}>
        <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden">
          {showMentionTypes && (
            <MentionTypeFilter
              tags={liveData.tags}
              visible={showMentionTypes}
              leftSlot={
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-md text-gray-600 hover:bg-white/90 hover:text-gray-900 transition-colors border border-gray-200 bg-white/90"
                  aria-label="Map settings"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                </button>
              }
            />
          )}
          <MapPage
            params={Promise.resolve({ id: 'public' })}
            skipPageWrapper
            onLocationSelect={handleLocationSelect}
            onLiveStatusChange={setLiveStatus}
            onLivePinSelect={handleLivePinSelect}
            onRegisterClearSelection={(fn) => { clearMapSelectionRef.current = fn; }}
            initialData={initialData}
            onMapInstanceReady={setMapInstance}
            timeFilter={timeFilter === 'all' ? null : timeFilter}
            controlledBoundaryState={{
              showDistricts,
              showCTU,
              showStateBoundary,
              showCountyBoundaries,
            }}
          />
          {!isWelcomeModalOpen && hasSelection && (
            <MapsPageFooter
              children={footerContent}
              onClose={handleClearSelection}
              showCloseIcon={hasSelection}
            />
          )}
          <MapStylesPopup
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            map={mapInstance}
            timeFilter={timeFilter}
            onTimeFilterChange={(f) => setTimeFilter(f)}
            account={account ?? undefined}
            onUpgrade={() => router.push('/billing')}
            onProToast={(feature) => { /* no-op on maps page */ }}
            districtsState={{ showDistricts, setShowDistricts }}
            ctuState={{ showCTU, setShowCTU }}
            stateBoundaryState={{ showStateBoundary, setShowStateBoundary }}
            countyBoundariesState={{ showCountyBoundaries, setShowCountyBoundaries }}
          />
        </div>
      </NewPageWrapper>
    </>
  );
}

export default function MapsPage() {
  return (
    <SearchStateProvider>
      <MapsPageContent />
    </SearchStateProvider>
  );
}
