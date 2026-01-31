'use client';

import { useMemo, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useAuthStateSafe } from '@/features/auth';
import { useUnifiedSidebar } from '@/hooks/useUnifiedSidebar';
import HomePageLayout from './HomePageLayout';
import HomeFeedContent from '@/features/homepage/components/HomeFeedContent';
import PromotionalBanner from '@/components/auth/PromotionalBanner';

export default function Home() {
  const { account: authAccount, activeAccountId, isLoading } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const { closeSidebar: closeLeftSidebar } = useUnifiedSidebar();
  const leftSidebarConfigs = useMemo(() => [], []);
  const rightSidebarConfigs = useMemo(() => [], []);
  
  const isAuthenticated = Boolean(authAccount || activeAccountId);

  // Wait for auth to load before showing banner
  if (isLoading) {
    return null;
  }

  // Check if user is on hobby plan (no active subscription)
  const isOnHobbyPlan = authAccount 
    ? (authAccount.plan === 'hobby' || 
       (!authAccount.plan || 
        (authAccount.subscription_status !== 'active' && 
         authAccount.subscription_status !== 'trialing')))
    : false;

  // Show banner for anonymous users OR authenticated users on hobby plan
  if (!isAuthenticated || isOnHobbyPlan) {
    return <PromotionalBanner isOpen={true} />;
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
          <div className="w-full py-6">
            <HomeFeedContent />
          </div>
        </div>
      </HomePageLayout>
    </PageWrapper>
  );
}