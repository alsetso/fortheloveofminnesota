'use client';

import { useMemo } from 'react';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import LandingPage from '@/components/landing/LandingPage';
import { useAuthStateSafe } from '@/features/auth';
import { useUnifiedSidebar } from '@/hooks/useUnifiedSidebar';
import HomePageLayout from './HomePageLayout';
import HomeFeedContent from '@/features/homepage/components/HomeFeedContent';

export default function Home() {
  const { account: authAccount } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const { closeSidebar: closeLeftSidebar } = useUnifiedSidebar();
  const leftSidebarConfigs = useMemo(() => [], []);
  const rightSidebarConfigs = useMemo(() => [], []);

  if (!authAccount) {
    return <LandingPage />;
  }

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={
        <MapSearchInput onLocationSelect={() => {}} />
      }
      accountDropdownProps={{
        onAccountClick: () => {},
        onSignInClick: openWelcome,
      }}
      searchResultsComponent={<SearchResults />}
    >
      <HomePageLayout
        leftSidebar={null}
        rightSidebar={null}
        onLeftSidebarClose={closeLeftSidebar}
        onRightSidebarClose={() => {}}
        leftSidebarConfigs={leftSidebarConfigs}
        rightSidebarConfigs={rightSidebarConfigs}
      >
        <div className="h-full overflow-y-auto scrollbar-hide">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            <HomeFeedContent />
          </div>
        </div>
      </HomePageLayout>
    </PageWrapper>
  );
}
