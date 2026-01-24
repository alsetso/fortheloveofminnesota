'use client';

import LiveMap from '@/features/homepage/components/LiveMap';
import SpecialMapViewTracker from '@/components/analytics/SpecialMapViewTracker';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useRef } from 'react';
import { useLivePageModals } from '@/features/homepage/hooks/useLivePageModals';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

// Configure route segment for optimal caching
export const dynamic = 'force-dynamic'; // Feed content changes frequently

export default function LivePage() {
  const mapInstanceRef = useRef<any>(null);
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
  
  const modalState = {
    isAccountModalOpen,
    openAccount,
    openMapStyles,
    openDynamicSearch,
    closeAccount,
    closeMapStyles,
    closeDynamicSearch,
    isModalOpen: (type: 'account' | 'mapStyles' | 'dynamicSearch') => isModalOpen(type),
  };
  
  return (
    <PageWrapper
      headerContent={null}
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
      <LiveMap mapInstanceRef={mapInstanceRef} />
    </PageWrapper>
  );
}

