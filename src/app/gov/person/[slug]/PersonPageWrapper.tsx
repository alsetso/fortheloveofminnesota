'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

interface PersonPageWrapperProps {
  children: React.ReactNode;
}

export default function PersonPageWrapper({ children }: PersonPageWrapperProps) {
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
      <div className="h-full overflow-y-auto px-[10px] py-3">
        {children}
      </div>
    </PageWrapper>
  );
}
