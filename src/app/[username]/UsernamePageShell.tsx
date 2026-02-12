'use client';

import { ReactNode } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import HomePageLayout from '@/app/HomePageLayout';
import HomeDashboardContent from '@/features/homepage/components/HomeDashboardContent';
import ViewAsSelector from '@/features/profiles/components/ViewAsSelector';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import type { ProfileAccount } from '@/types/profile';

interface UsernamePageShellProps {
  children?: ReactNode;
  /** When true, render own dashboard (no handlers passed from server). */
  isOwnProfile?: boolean;
  /** Required when isOwnProfile; serializable so server can pass it. */
  profileAccountData?: ProfileAccount;
  /** When true, show Owner/Public/Users selector in header (owner previewing as public/users). */
  showViewAsSelector?: boolean;
}

/**
 * Client shell so the [username] Server Component never passes
 * event handlers to Client Components. Own-profile dashboard is rendered here.
 * When showViewAsSelector, owner sees public-profile content but can switch view via selector.
 */
export default function UsernamePageShell({ children, isOwnProfile, profileAccountData, showViewAsSelector }: UsernamePageShellProps) {
  const { openWelcome } = useAppModalContextSafe();

  const showDashboard = isOwnProfile && profileAccountData && !showViewAsSelector;
  const content = showDashboard ? (
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

  // Own dashboard uses LeftSidebar; profile view uses ProfileViewContent (separate component)
  const leftSidebar = showDashboard ? <LeftSidebar /> : <LeftSidebar />;

  return (
    <NewPageWrapper
      leftSidebar={leftSidebar}
      rightSidebar={<RightSidebar />}
      headerContent={isOwnProfile || showViewAsSelector ? <ViewAsSelector visible darkText /> : null}
    >
      <div className="w-full py-6">
        {content}
      </div>
    </NewPageWrapper>
  );
}
