'use client';

import LiveMap from '@/features/homepage/components/LiveMap';
import SpecialMapViewTracker from '@/components/analytics/SpecialMapViewTracker';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import LivePageHeaderButtons from './LivePageHeaderButtons';
import LivePageLayout from './LivePageLayout';
import MentionLocationSheet from '@/components/live/MentionLocationSheet';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useLivePageModals } from '@/features/homepage/hooks/useLivePageModals';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/features/ui/hooks/useToast';
import { useLiveUrlState } from '@/features/homepage/hooks/useLiveUrlState';
import { useMentionData } from '@/hooks/useMentionData';

// Configure route segment for optimal caching
export const dynamic = 'force-dynamic'; // Feed content changes frequently

export default function LivePage() {
  const mapInstanceRef = useRef<any>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'24h' | '7d' | 'all'>('all');
  const [showDistricts, setShowDistricts] = useState(false);
  const [showCTU, setShowCTU] = useState(false);
  const [showStateBoundary, setShowStateBoundary] = useState(false);
  const [showCountyBoundaries, setShowCountyBoundaries] = useState(false);
  
  // URL state management for location navigation
  const { urlState, hasProcessedUrl, setHasProcessedUrl, clearUrlParams } = useLiveUrlState();
  const [isMentionsSheetOpen, setIsMentionsSheetOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Fetch mention data using new hook (with caching and deduplication)
  const { mention: selectedMention, isLoading: isLoadingMention } = useMentionData(urlState.mentionId);
  
  const {
    isAccountModalOpen,
    openAccount,
    openMapStyles,
    openDynamicSearch,
    closeAccount,
    closeMapStyles,
    closeDynamicSearch,
    isModalOpen,
  } = useLivePageModals();
  const { openWelcome } = useAppModalContextSafe();
  const router = useRouter();
  const { pro: proToast } = useToast();
  
  const modalState = useMemo(() => ({
    isAccountModalOpen,
    openAccount,
    openMapStyles,
    openDynamicSearch,
    closeAccount,
    closeMapStyles,
    closeDynamicSearch,
    isModalOpen: (type: 'account' | 'mapStyles' | 'dynamicSearch') => isModalOpen(type),
  }), [isAccountModalOpen, openAccount, openMapStyles, openDynamicSearch, closeAccount, closeMapStyles, closeDynamicSearch, isModalOpen]);
  
  const handleSettingsClick = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  const handleFilterClick = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  const handleTimeFilterChange = (filter: '24h' | '7d' | 'all') => {
    setTimeFilter(filter);
    window.dispatchEvent(new CustomEvent('mention-time-filter-change', {
      detail: { timeFilter: filter }
    }));
  };

  // Sync boundary state with LiveMap via events
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

  // Handler for when a nearby mention is selected from the sheet
  const handleMentionSelect = useCallback((mentionId: string, lat: number, lng: number) => {
    // Update URL with new mentionId (useMentionData hook will fetch automatically)
    const params = new URLSearchParams(window.location.search);
    params.set('mentionId', mentionId);
    params.set('lat', lat.toString());
    params.set('lng', lng.toString());
    router.replace(`/live?${params.toString()}`, { scroll: false });
    
    setIsMentionsSheetOpen(true);
    
    // Trigger map fly-to for the new mention
    window.dispatchEvent(new CustomEvent('fly-to-location', {
      detail: { lat, lng, zoom: 15 }
    }));
  }, [router]);

  // Listen for mention selection events from unified sheet
  useEffect(() => {
    const handleSelectMention = (e: CustomEvent<{ mentionId: string; lat: number; lng: number }>) => {
      handleMentionSelect(e.detail.mentionId, e.detail.lat, e.detail.lng);
    };

    window.addEventListener('select-mention', handleSelectMention as EventListener);
    return () => {
      window.removeEventListener('select-mention', handleSelectMention as EventListener);
    };
  }, [handleMentionSelect]);

  // Listen for map loaded event
  useEffect(() => {
    const handleMapLoaded = () => {
      setMapLoaded(true);
    };

    window.addEventListener('map-loaded', handleMapLoaded);
    return () => {
      window.removeEventListener('map-loaded', handleMapLoaded);
    };
  }, []);

  // Listen for mention selected from map click (not from feed)
  useEffect(() => {
    const handleMentionSelectedFromMap = (e: CustomEvent<{ mentionId: string; lat: number; lng: number }>) => {
      // Reset processed flag to allow URL watcher to process the new mention
      setHasProcessedUrl(false);
      // URL is already updated by LiveMap, so the URL watcher will handle the rest
    };

    window.addEventListener('mention-selected-from-map', handleMentionSelectedFromMap as EventListener);
    return () => {
      window.removeEventListener('mention-selected-from-map', handleMentionSelectedFromMap as EventListener);
    };
  }, []);

  // Handle URL parameters for location navigation - wait for map to load
  useEffect(() => {
    // Don't process if map isn't loaded yet or if we've already processed
    if (!mapLoaded || hasProcessedUrl) return;

    // If we have mentionId but no lat/lng, use selectedMention from hook to get coordinates
    if (urlState.mentionId && (!urlState.lat || !urlState.lng) && selectedMention) {
      if (selectedMention.lat && selectedMention.lng) {
        // Update URL with coordinates
        const url = new URL(window.location.href);
        url.searchParams.set('lat', selectedMention.lat.toString());
        url.searchParams.set('lng', selectedMention.lng.toString());
        window.history.replaceState({}, '', url.toString());
        // Trigger re-render by updating state - this will cause the effect to run again
        setHasProcessedUrl(false);
      }
      return;
    }

    // Only proceed if we have coordinates and map instance
    if (!mapInstanceRef.current || !urlState.lat || !urlState.lng) {
      return;
    }

    handleLocationNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, urlState.lat, urlState.lng, urlState.zoom, urlState.mentionId, hasProcessedUrl, selectedMention]);

  const handleLocationNavigation = () => {
    if (!mapInstanceRef.current || !urlState.lat || !urlState.lng) return;

    const map = mapInstanceRef.current;
    const zoom = urlState.zoom || 15;

    // Fly to location - always fly when we have coordinates
    map.flyTo({
      center: [urlState.lng, urlState.lat],
      zoom,
      duration: 1500,
    });

    // Open mentions sheet only if mentionId is present
    if (urlState.mentionId) {
      setIsMentionsSheetOpen(true);
    }
    
    // Mark as processed to prevent re-triggering
    setHasProcessedUrl(true);
  };

  const handleCloseMentionsSheet = () => {
    setIsMentionsSheetOpen(false);
    clearUrlParams();
  };
  
  return (
    <PageWrapper
      headerContent={
        <LivePageHeaderButtons
          onSettingsClick={handleSettingsClick}
          onFilterClick={handleFilterClick}
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
          modalState={modalState}
        />
      }
      accountDropdownProps={{
        onAccountClick: openAccount,
        onSignInClick: openWelcome,
      }}
      searchResultsComponent={<SearchResults />}
    >
      <SpecialMapViewTracker mapIdentifier="live" />
      <LivePageLayout
        map={mapInstanceRef.current}
        timeFilter={timeFilter}
        onTimeFilterChange={handleTimeFilterChange}
        onUpgrade={() => router.push('/billing')}
        onProToast={(feature?: string) => proToast(feature || '')}
        districtsState={{
          showDistricts,
          setShowDistricts,
        }}
        ctuState={{
          showCTU,
          setShowCTU,
        }}
        stateBoundaryState={{
          showStateBoundary,
          setShowStateBoundary,
        }}
        countyBoundariesState={{
          showCountyBoundaries,
          setShowCountyBoundaries,
        }}
        isFilterOpen={isFilterOpen}
        isSettingsOpen={isSettingsOpen}
        onFilterToggle={handleFilterClick}
        onSettingsToggle={handleSettingsClick}
      >
        <LiveMap 
          mapInstanceRef={mapInstanceRef} 
          selectedMentionId={urlState.mentionId || null}
        />
      </LivePageLayout>

      {/* Unified Mention Location Sheet - Only opens when mentionId is present in URL */}
      {urlState.mentionId && selectedMention ? (
        <MentionLocationSheet
          isOpen={isMentionsSheetOpen}
          onClose={handleCloseMentionsSheet}
          selectedMention={selectedMention}
          radius={0.5} // 500 meters radius
          onMentionSelect={handleMentionSelect}
        />
      ) : null}
    </PageWrapper>
  );
}

