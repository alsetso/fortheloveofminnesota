'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import ContributePageContent from './ContributePageContent';

interface ContributePageClientProps {
  mapId: string;
  mapSlug: string;
}

export default function ContributePageClient({ mapId, mapSlug }: ContributePageClientProps) {
  const { openWelcome } = useAppModalContextSafe();

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
      accountDropdownProps={{
        onAccountClick: () => {},
        onSignInClick: openWelcome,
      }}
      searchResultsComponent={<SearchResults />}
    >
        <ContributePageContent mapId={mapId} mapSlug={mapSlug} />
      </PageWrapper>
  );
}
