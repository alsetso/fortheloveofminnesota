'use client';

import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { HeaderThemeProvider } from '@/contexts/HeaderThemeContext';
import AppContainer from '@/components/layout/AppContainer';
import AppContentWidth from '@/components/layout/AppContentWidth';
import AppMenu from '@/components/layout/AppMenu';
import MapInfo, { type MapInfoLocation, type MapInfoMentionType } from '@/components/layout/MapInfo';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { mentionTypeNameToSlug } from '@/features/mentions/utils/mentionTypeHelpers';
import LiveMapFooterStatus, { type LiveMapFooterStatusState } from '@/components/layout/LiveMapFooterStatus';
import LivePinCard, { type LivePinData } from '@/components/layout/LivePinCard';
import MentionTypeInfoCard from '@/components/layout/MentionTypeInfoCard';
import { useAuthStateSafe } from '@/features/auth';
import { getLiveLayerLabel, getLiveLayerTitleByZoom, type LiveBoundaryLayerId } from '@/features/map/config';
import { preloadAll, resolveBoundaryByLayerId } from '@/features/map/services/liveBoundaryCache';
import MapPage from '../map/[id]/page';

function LiveHeaderThemeSync({ children }: { children: ReactNode }) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  useEffect(() => {
    const read = () => setIsSearchActive(typeof window !== 'undefined' && window.location.hash === '#search');
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  return (
    <HeaderThemeProvider value={{ isDefaultLightBg: false, isSearchActive }}>
      {children}
    </HeaderThemeProvider>
  );
}

function getFooterHeaderLabel(
  selectedLocation: MapInfoLocation | null,
  currentZoom: number | undefined
): string {
  const boundaryLayer = selectedLocation?.mapMeta?.boundaryLayer as LiveBoundaryLayerId | undefined;
  const boundaryName = selectedLocation?.mapMeta?.boundaryName as string | undefined;
  if (boundaryLayer && boundaryName) {
    const title = getLiveLayerLabel(boundaryLayer);
    return `${title}: ${boundaryName}`;
  }
  return getLiveLayerTitleByZoom(currentZoom);
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
export default function LivePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { account, activeAccountId } = useAuthStateSafe();
  const currentAccountId = activeAccountId || account?.id || null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<MapInfoLocation | null>(null);
  const [footerOpen, setFooterOpen] = useState(false);
  /** Single boundary layer visible on live map; only one at a time. Toggled from main menu Live map section. */
  const [liveBoundaryLayer, setLiveBoundaryLayer] = useState<LiveBoundaryLayerId | null>(null);
  /** Pin display grouping: when true (default) cluster pins; when false show all pins. */
  const [pinDisplayGrouping, setPinDisplayGrouping] = useState(true);
  /** Show only current account's pins on the live map. */
  const [showOnlyMyPins, setShowOnlyMyPins] = useState(false);
  /** Time filter for pins on the live map: 24h, 7d, or null = all time. */
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveMapFooterStatusState>({
    loadingData: true,
    mapLoaded: false,
    loadingPins: false,
  });

  // Start boundary fetches as soon as live page mounts so they run in parallel with map load
  useEffect(() => {
    preloadAll();
  }, []);

  const pinIdFromUrl = searchParams.get('pin');
  const typeSlugFromUrl = searchParams.get('type');
  const layerFromUrl = searchParams.get('layer');
  const entityIdFromUrl = searchParams.get('id');
  const [selectedPin, setSelectedPin] = useState<LivePinData | null>(null);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [resolvedMentionType, setResolvedMentionType] = useState<MapInfoMentionType | null>(null);
  const supabase = useSupabaseClient();
  const clearMapSelectionRef = useRef<(() => void) | null>(null);

  /** Build /live URL: one selection (pin OR layer+id), preserve type. Clears others. */
  const buildLiveUrl = useCallback(
    (updates: { pin?: string | null; layer?: string | null; id?: string | null; clearSelection?: boolean }) => {
      const next = new URLSearchParams(searchParams);
      next.delete('pin');
      next.delete('layer');
      next.delete('id');
      if (!updates.clearSelection) {
        if (updates.pin != null && updates.pin !== '') {
          next.set('pin', updates.pin);
        } else if (updates.layer != null && updates.layer !== '' && updates.id != null && updates.id !== '') {
          next.set('layer', updates.layer);
          next.set('id', updates.id);
        }
      }
      const q = next.toString();
      return q ? `/live?${q}` : '/live';
    },
    [searchParams]
  );

  useEffect(() => {
    if (pinIdFromUrl) setFooterOpen(true);
  }, [pinIdFromUrl]);

  useEffect(() => {
    if (typeSlugFromUrl && !isContributeOpen) setFooterOpen(true);
  }, [typeSlugFromUrl, isContributeOpen]);

  // Resolve boundary from URL (layer + id) and set footer MapInfo; one entity at a time.
  useEffect(() => {
    if (pinIdFromUrl || !layerFromUrl || !entityIdFromUrl) return;
    let cancelled = false;
    resolveBoundaryByLayerId(layerFromUrl, entityIdFromUrl)
      .then((loc) => {
        if (!cancelled && loc) {
          setSelectedLocation(loc);
          setFooterOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedLocation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [layerFromUrl, entityIdFromUrl, pinIdFromUrl]);

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

  // When URL has ?pin=, ensure we have full pin data (account.image_url, username) for the footer card
  useEffect(() => {
    if (!pinIdFromUrl) {
      setSelectedPin(null);
      return;
    }
    const hasFullData = selectedPin && String(selectedPin.id) === pinIdFromUrl && selectedPin.account?.image_url != null;
    if (hasFullData) return; // already have pin with account image (from click or prior fetch)

    let cancelled = false;
    fetch(`/api/maps/live/pins/${pinIdFromUrl}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LivePinData | null) => {
        if (!cancelled && data) setSelectedPin(data);
      })
      .catch(() => {
        if (!cancelled) setSelectedPin(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pinIdFromUrl, selectedPin?.id, selectedPin?.account]);

  const handleLocationSelect = useCallback(
    (info: { lat: number; lng: number; address: string | null; isOpen: boolean; mapMeta?: Record<string, any> | null }) => {
      if (!info.isOpen) return;
      const lat = Number(info.lat);
      const lng = Number(info.lng);
      setSelectedLocation({
        lat: Number.isFinite(lat) ? lat : 0,
        lng: Number.isFinite(lng) ? lng : 0,
        address: info.address,
        mapMeta: info.mapMeta ?? null,
      });
      setFooterOpen(true);
      const layer = info.mapMeta?.boundaryLayer as string | undefined;
      const entityId = info.mapMeta?.boundaryEntityId != null ? String(info.mapMeta.boundaryEntityId).trim() : '';
      if (process.env.NODE_ENV === 'development') {
        console.debug('[LiveBoundary] Live handleLocationSelect', {
          boundaryLayer: layer,
          boundaryEntityId: info.mapMeta?.boundaryEntityId,
          entityIdTrimmed: entityId,
          willSetUrl: !!(layer && entityId),
        });
      }
      if (layer && entityId) setSelectedPin(null);
      router.replace(
        buildLiveUrl(
          layer && entityId ? { layer, id: entityId } : { clearSelection: true }
        )
      );
    },
    [router, buildLiveUrl]
  );

  const handleLivePinSelect = useCallback(
    (pinId: string, pinData?: Record<string, unknown> | null) => {
      setSelectedPin((pinData ?? null) as LivePinData | null);
      setSelectedLocation(null);
      router.replace(buildLiveUrl({ pin: pinId }));
      setFooterOpen(true);
    },
    [router, buildLiveUrl]
  );

  const handleClearSelection = useCallback(() => {
    router.replace(buildLiveUrl({ clearSelection: true }));
    setSelectedLocation(null);
    setSelectedPin(null);
    setFooterOpen(false);
    clearMapSelectionRef.current?.();
  }, [router, buildLiveUrl]);

  const handlePinCardClose = useCallback(() => {
    handleClearSelection();
  }, [handleClearSelection]);

  const handleAddToMap = useCallback((loc: MapInfoLocation, mentionTypeId?: string) => {
    window.dispatchEvent(
      new CustomEvent('open-contribute-overlay', {
        detail: {
          lat: loc.lat,
          lng: loc.lng,
          mapMeta: loc.mapMeta ?? null,
          address: loc.address ?? null,
          mentionTypeId: mentionTypeId ?? undefined,
        },
      })
    );
  }, []);

  const footerHeaderLabel = useMemo(
    () =>
      pinIdFromUrl
        ? 'Pin'
        : getFooterHeaderLabel(selectedLocation, liveStatus.currentZoom),
    [pinIdFromUrl, selectedLocation, liveStatus.currentZoom]
  );

  const footerContent = useMemo(() => {
    if (pinIdFromUrl) {
      const pin = selectedPin && String(selectedPin.id) === pinIdFromUrl ? selectedPin : null;
      return (
        <LivePinCard
          pinId={pinIdFromUrl}
          pin={pin}
          onClose={handlePinCardClose}
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
          onClose={handleClearSelection}
        />
      </>
    );
  }, [pinIdFromUrl, selectedPin, currentAccountId, typeSlugFromUrl, isContributeOpen, selectedLocation, resolvedMentionType, liveStatus.currentZoom, handlePinCardClose, handleClearSelection, handleAddToMap]);

  return (
    <LiveHeaderThemeSync>
    <AppContainer>
      <MapPage
        params={Promise.resolve({ id: 'live' })}
        skipPageWrapper
        onLocationSelect={handleLocationSelect}
        onLiveStatusChange={setLiveStatus}
        onLivePinSelect={handleLivePinSelect}
        liveBoundaryLayer={liveBoundaryLayer}
        pinDisplayGrouping={pinDisplayGrouping}
        showOnlyMyPins={showOnlyMyPins}
        timeFilter={timeFilter}
        onRegisterClearSelection={(fn) => {
          clearMapSelectionRef.current = fn;
        }}
      />
      <AppContentWidth
        footerHeaderLabel={footerHeaderLabel}
        footerContent={footerContent}
        footerOpen={footerOpen}
        onFooterOpenChange={setFooterOpen}
        footerStatusContent={<LiveMapFooterStatus status={liveStatus} />}
        onAccountImageClick={() => setMenuOpen(true)}
      />
      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        liveBoundaryLayer={liveBoundaryLayer}
        onLiveBoundaryLayerChange={setLiveBoundaryLayer}
        pinDisplayGrouping={pinDisplayGrouping}
        onPinDisplayGroupingChange={setPinDisplayGrouping}
        showOnlyMyPins={showOnlyMyPins}
        onShowOnlyMyPinsChange={setShowOnlyMyPins}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
      />
    </AppContainer>
    </LiveHeaderThemeSync>
  );
}
