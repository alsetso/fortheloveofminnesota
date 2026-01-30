'use client';

import { ReactNode } from 'react';
import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import HomePageLayout from '@/app/HomePageLayout';
import HomeDashboardContent from '@/features/homepage/components/HomeDashboardContent';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { ProfileAccount } from '@/types/profile';

interface UsernamePageShellProps {
  children?: ReactNode;
  /** When true, render own dashboard (no handlers passed from server). */
  isOwnProfile?: boolean;
  /** Required when isOwnProfile; serializable so server can pass it. */
  profileAccountData?: ProfileAccount;
}

/**
 * Client shell so the [username] Server Component never passes
 * event handlers to Client Components. Own-profile dashboard is rendered here.
 */
export default function UsernamePageShell({ children, isOwnProfile, profileAccountData }: UsernamePageShellProps) {
  const { openWelcome } = useAppModalContextSafe();

  const content =
    isOwnProfile && profileAccountData ? (
      <HomePageLayout
        leftSidebar={null}
        rightSidebar={null}
        onLeftSidebarClose={() => {}}
        onRightSidebarClose={() => {}}
        leftSidebarConfigs={[]}
        rightSidebarConfigs={[]}
      >
        <div className="h-full overflow-y-auto scrollbar-hide">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            <HomeDashboardContent account={profileAccountData} />
          </div>
        </div>
      </HomePageLayout>
    ) : (
      children
    );

  return (
    <PageWrapper
      headerContent={null}
      searchComponent={<MapSearchInput onLocationSelect={() => {}} />}
      accountDropdownProps={{ onAccountClick: () => {}, onSignInClick: openWelcome }}
      searchResultsComponent={<SearchResults />}
    >
      {content}
    </PageWrapper>
  );
}
