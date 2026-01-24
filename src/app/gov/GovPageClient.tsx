'use client';

import PageWrapper from '@/components/layout/PageWrapper';
import MapSearchInput from '@/components/layout/MapSearchInput';
import SearchResults from '@/components/layout/SearchResults';
import GovTablesClient from './GovTablesClient';
import GovPageViewTracker from './components/GovPageViewTracker';
import CommunityBanner from '@/features/civic/components/CommunityBanner';
import RecentEditsFeed from '@/features/civic/components/RecentEditsFeed';
import { GovTabProvider } from './contexts/GovTabContext';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';

export default function GovPageClient() {
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
      <div className="h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <GovPageViewTracker />
          <GovTabProvider>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Tabs */}
              <div className="lg:col-span-3">
                <div className="lg:sticky lg:top-6 space-y-6">
                  {/* Header */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-1.5">
                    <h1 className="text-sm font-semibold text-gray-900">
                      Minnesota Government Directory
                    </h1>
                    <p className="text-xs text-gray-600">
                      A community-maintained directory of Minnesota state government organizations, officials, and their roles.
                    </p>
                  </div>

                  {/* Community Banner */}
                  <CommunityBanner />

                  {/* Tabs */}
                  <GovTablesClient showTabsOnly={true} />
                </div>
              </div>

              {/* Middle Column: Tables */}
              <div className="lg:col-span-6">
                <GovTablesClient showTablesOnly={true} />
              </div>

              {/* Right Column: Recent Edits Feed */}
              <div className="lg:col-span-3">
                <div className="lg:sticky lg:top-6">
                  <RecentEditsFeed limit={20} />
                </div>
              </div>
            </div>
          </GovTabProvider>
        </div>
      </div>
    </PageWrapper>
  );
}
