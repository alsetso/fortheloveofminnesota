'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import FeedContent from '@/components/feed/FeedContent';
import SearchResults from '@/components/layout/SearchResults';
import { useMemo } from 'react';
import { Cog6ToothIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useSidebarState } from '@/hooks/useSidebarState';
import SidebarToggleButton from '@/components/layout/SidebarToggleButton';

export default function FeedPage() {
  const { openWelcome } = useAppModalContextSafe();

  const {
    isLeftSidebarVisible,
    isRightSidebarVisible,
    isLeftPanelOpen,
    isRightPanelOpen,
    toggleLeft,
    toggleRight,
    closeLeftPanel,
    closeRightPanel,
  } = useSidebarState();

  const headerContent = useMemo(() => (
    <div className="flex items-center gap-2">
      <SidebarToggleButton
        icon={FunnelIcon}
        onClick={toggleLeft}
        ariaLabel="Toggle left sidebar"
        title="Feed filters"
      />
      <SidebarToggleButton
        icon={Cog6ToothIcon}
        onClick={toggleRight}
        ariaLabel="Toggle right sidebar"
        title="Feed sidebar"
      />
    </div>
  ), [toggleLeft, toggleRight]);

  return (
    <PageWrapper
      headerContent={headerContent}
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
      <FeedContent
        leftSidebarVisible={isLeftSidebarVisible}
        rightSidebarVisible={isRightSidebarVisible}
        leftPanelOpen={isLeftPanelOpen}
        rightPanelOpen={isRightPanelOpen}
        onRequestCloseLeftPanel={closeLeftPanel}
        onRequestCloseRightPanel={closeRightPanel}
      />
    </PageWrapper>
  );
}
