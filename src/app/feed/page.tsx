'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import FeedContent from '@/components/feed/FeedContent';
import SearchResults from '@/components/layout/SearchResults';
import FeedPageLayout from './FeedPageLayout';
import { useMemo } from 'react';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useUnifiedSidebar } from '@/hooks/useUnifiedSidebar';
import MentionTimeFilter from '@/components/feed/MentionTimeFilter';
import MentionTypeFilter from '@/components/feed/MentionTypeFilter';
import LiveMapAnalyticsCard from '@/components/feed/LiveMapAnalyticsCard';

export default function FeedPage() {
  const { openWelcome } = useAppModalContextSafe();
  const { activeSidebar, toggleSidebar, closeSidebar } = useUnifiedSidebar();


  const sidebarConfigs = useMemo(() => [
    {
      type: 'filter' as const,
      title: 'Filters',
      content: (
        <div className="space-y-6">
          <MentionTimeFilter />
          <MentionTypeFilter />
        </div>
      ),
      popupType: 'search' as const,
    },
    {
      type: 'analytics' as const,
      title: 'Analytics',
      content: <LiveMapAnalyticsCard />,
      popupType: 'analytics' as const,
      infoText: 'View real-time visit statistics and page analytics',
    },
  ], []);

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
      <FeedPageLayout
        activeSidebar={activeSidebar}
        onSidebarClose={closeSidebar}
        sidebarConfigs={sidebarConfigs}
      >
        <FeedContent />
      </FeedPageLayout>
    </PageWrapper>
  );
}
