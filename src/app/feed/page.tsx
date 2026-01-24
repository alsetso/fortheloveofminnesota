'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import FeedContent from '@/components/feed/FeedContent';
import SearchResults from '@/components/layout/SearchResults';
import { useRef } from 'react';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe } from '@/features/auth';

export default function FeedPage() {
  const { openWelcome } = useAppModalContextSafe();
  const { account } = useAuthStateSafe();
  
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
      <FeedContent />
    </PageWrapper>
  );
}
