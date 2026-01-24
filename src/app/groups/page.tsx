'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import GroupsContent from '@/components/groups/GroupsContent';

export default function GroupsPage() {
  const { openWelcome } = useAppModalContextSafe();
  
  return (
    <PageWrapper
      headerContent={null}
      searchComponent={
        <MapSearchInput
          onLocationSelect={() => {
            // Handle location selection if needed
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
      <GroupsContent />
    </PageWrapper>
  );
}
