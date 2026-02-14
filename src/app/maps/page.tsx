'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchStateProvider } from '@/contexts/SearchStateContext';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import type { LivePinData } from '@/components/layout/LivePinCard';
import LocationPinPopup from '@/components/layout/LocationPinPopup';
import FinishPinModal from '@/components/modals/FinishPinModal';
import PublicMapView from '@/features/maps/PublicMapView';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import type { ProfilePin } from '@/types/profile';
import { MinnesotaBoundsService } from '@/features/map/services/minnesotaBoundsService';
import type { Collection } from '@/types/collection';

export interface LiveMapData {
  map: { id: string; name?: string; slug?: string };
  pins: { id: string; lat: number; lng: number; [key: string]: unknown }[];
  tags: { id: string; emoji: string; name: string }[];
}

function MapsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeAccountId } = useAuthStateSafe();
  const currentAccountId = activeAccountId ?? null;
  const { openWelcome } = useAppModalContextSafe();
  const { addToast } = useToastContext();

  const [liveData, setLiveData] = useState<LiveMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string | null; mapMeta?: Record<string, unknown> | null } | null>(null);
  const [selectedPin, setSelectedPin] = useState<LivePinData | null>(null);
  const [selectedPinCoords, setSelectedPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingPin, setIsLoadingPin] = useState(false);

  const pinIdFromUrl = searchParams.get('pin');
  const atFromUrl = searchParams.get('at');
  const hasPinSelection = Boolean(pinIdFromUrl);
  const hasLocationSelection = Boolean(atFromUrl);

  const atCoords = useMemo(() => {
    if (!atFromUrl) return null;
    const [latStr, lngStr] = atFromUrl.split(',');
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [atFromUrl]);

  const { address: reverseAddress } = useReverseGeocode(
    selectedLocation?.lat ?? atCoords?.lat ?? null,
    selectedLocation?.lng ?? atCoords?.lng ?? null
  );

  const [collections, setCollections] = useState<Collection[]>([]);
  useEffect(() => {
    if (!currentAccountId) return;
    fetch(`/api/accounts/${currentAccountId}/collections`)
      .then((res) => res.json())
      .then((data) => setCollections(data?.collections ?? []))
      .catch(() => {});
  }, [currentAccountId]);

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

  const buildUrl = useCallback(
    (updates: { pin?: string | null; at?: string | null; clear?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      next.delete('pin');
      next.delete('at');
      if (!updates.clear) {
        if (updates.pin) next.set('pin', updates.pin);
        else if (updates.at) next.set('at', updates.at);
      }
      const q = next.toString();
      return q ? `/maps?${q}` : '/maps';
    },
    [searchParams]
  );

  const handleClearSelection = useCallback(() => {
    router.replace(buildUrl({ clear: true }));
    setSelectedLocation(null);
    setSelectedPin(null);
    setSelectedPinCoords(null);
  }, [router, buildUrl]);

  const handlePinSelect = useCallback(
    (pinId: string, coords?: { lat: number; lng: number }) => {
      setSelectedLocation(null);
      setSelectedPinCoords(coords ?? null);
      const pin = liveData?.pins.find((p) => String(p.id) === pinId);
      if (pin) {
        setSelectedPin(pin as unknown as LivePinData);
        setIsLoadingPin(false);
      } else {
        setSelectedPin(null);
        setIsLoadingPin(true);
        fetch(`/api/pins/${pinId}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            setSelectedPin(data);
            setIsLoadingPin(false);
          })
          .catch(() => setIsLoadingPin(false));
      }
      router.replace(buildUrl({ pin: pinId }));
    },
    [router, buildUrl, liveData?.pins]
  );

  const handleLocationSelect = useCallback(
    (info: { lat: number; lng: number; address: string | null; mapMeta?: Record<string, unknown> | null }) => {
      if (!MinnesotaBoundsService.isWithinMinnesota({ lat: info.lat, lng: info.lng })) {
        addToast(createToast('info', 'Pins can only be placed within Minnesota', { duration: 3000 }));
        return;
      }
      if (!currentAccountId) {
        openWelcome();
        addToast(createToast('info', 'Sign in to add pins', { duration: 3000 }));
        return;
      }
      setSelectedPin(null);
      setSelectedLocation({ lat: info.lat, lng: info.lng, address: info.address ?? null, mapMeta: info.mapMeta ?? null });
      router.replace(buildUrl({ at: `${info.lat.toFixed(6)},${info.lng.toFixed(6)}` }));
    },
    [router, buildUrl, currentAccountId, openWelcome, addToast]
  );

  useEffect(() => {
    if (!hasLocationSelection || !atCoords) {
      setSelectedLocation(null);
      return;
    }
    setSelectedPin(null);
    setSelectedLocation((prev) =>
      prev && prev.lat === atCoords.lat && prev.lng === atCoords.lng
        ? prev
        : { ...atCoords, address: prev?.address ?? null, mapMeta: prev?.mapMeta ?? null }
    );
  }, [hasLocationSelection, atCoords]);

  useEffect(() => {
    if (!hasPinSelection || !pinIdFromUrl) {
      setSelectedPin(null);
      setSelectedPinCoords(null);
      setIsLoadingPin(false);
      return;
    }
    const pin = liveData?.pins.find((p) => String(p.id) === pinIdFromUrl);
    if (pin) {
      setSelectedPin(pin as unknown as LivePinData);
      setSelectedPinCoords(null);
      setIsLoadingPin(false);
    } else {
      setIsLoadingPin(true);
      setSelectedPin(null);
      fetch(`/api/pins/${pinIdFromUrl}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setSelectedPin(data);
          setIsLoadingPin(false);
        })
        .catch(() => setIsLoadingPin(false));
    }
  }, [hasPinSelection, pinIdFromUrl, liveData?.pins]);

  const locationPopupAddress = selectedLocation?.address ?? (hasLocationSelection && atCoords ? reverseAddress : null);

  const handleViewRecorded = useCallback((pinId: string, viewCount: number) => {
    setLiveData((prev) => {
      if (!prev) return prev;
      const idx = prev.pins.findIndex((p) => String(p.id) === pinId);
      if (idx === -1) return prev;
      const updated = [...prev.pins];
      updated[idx] = { ...updated[idx], view_count: viewCount };
      return { ...prev, pins: updated };
    });
  }, []);

  // Finish-pin modal state
  const [finishPin, setFinishPin] = useState<ProfilePin | null>(null);
  const [finishPinAddress, setFinishPinAddress] = useState<string | null>(null);

  const handlePinCreated = useCallback((pin: ProfilePin) => {
    handleClearSelection();
    setLiveData((prev) =>
      prev && pin ? { ...prev, pins: [{ ...pin, lat: pin.lat ?? 0, lng: pin.lng ?? 0 }, ...(prev.pins ?? [])] } : prev
    );
    // Open the finish-pin modal so user can add description, media, collection
    setFinishPin(pin);
    setFinishPinAddress(locationPopupAddress);
  }, [handleClearSelection, locationPopupAddress]);

  const handleFinishPinUpdated = useCallback((updatedPin: ProfilePin) => {
    setLiveData((prev) => {
      if (!prev) return prev;
      const idx = prev.pins.findIndex((p) => String(p.id) === String(updatedPin.id));
      if (idx === -1) return prev;
      const updated = [...prev.pins];
      updated[idx] = { ...updated[idx], ...updatedPin };
      return { ...prev, pins: updated };
    });
    setFinishPin(null);
    setFinishPinAddress(null);
  }, []);

  const handleFinishPinClose = useCallback(() => {
    setFinishPin(null);
    setFinishPinAddress(null);
  }, []);

  if (loading || !liveData?.pins) {
    return (
      <div className="flex items-center justify-center w-full h-[calc(100vh-3.5rem)] bg-gray-50 dark:bg-surface-muted">
        <div className="text-sm text-gray-500 dark:text-foreground-muted">Loading map…</div>
      </div>
    );
  }

  return (
    <>
      <PageViewTracker />
      <NewPageWrapper leftSidebar={<LeftSidebar />} rightSidebar={<RightSidebar />}>
        <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden">
          <PublicMapView
            pins={liveData.pins}
            selectedPinId={pinIdFromUrl}
            selectedPin={selectedPin}
            currentAccountId={currentAccountId}
            locationMarker={hasLocationSelection && atCoords && !finishPin ? atCoords : null}
            selectedPinCoords={selectedPinCoords}
            isLoadingPin={isLoadingPin}
            onPinSelect={handlePinSelect}
            onPinDeselect={handleClearSelection}
            onLocationSelect={handleLocationSelect}
            onViewRecorded={handleViewRecorded}
          />
          {hasLocationSelection && atCoords && !finishPin && (
            <LocationPinPopup
              isOpen
              onClose={handleClearSelection}
              lat={atCoords.lat}
              lng={atCoords.lng}
              address={locationPopupAddress}
              mapMeta={selectedLocation?.mapMeta}
              accountId={currentAccountId}
              onPinCreated={handlePinCreated}
            />
          )}
          {finishPin && currentAccountId && (
            <FinishPinModal
              isOpen
              onClose={handleFinishPinClose}
              pin={finishPin}
              accountId={currentAccountId}
              address={finishPinAddress}
              onPinUpdated={handleFinishPinUpdated}
              collections={collections}
            />
          )}
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
