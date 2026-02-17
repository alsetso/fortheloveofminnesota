'use client';

import { useState } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import GovOrgsSidebar from './components/GovOrgsSidebar';
import GovBuildingsSidebar from './components/GovBuildingsSidebar';
import GovDashboard from './components/GovDashboard';
import GovToast from './components/GovToast';
import { GovToastProvider } from './contexts/GovToastContext';
import { MagnifyingGlassIcon, BuildingOfficeIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';

interface GovPageClientProps {
  isAuthenticated: boolean;
}

/**
 * /gov – Minnesota Civic dashboard. Gov-specific sidebars replace app sidebars:
 * Left = Organizations, Center = People & roles, Right = Buildings.
 */
export default function GovPageClient({ isAuthenticated }: GovPageClientProps) {
  const [leaderSearchQuery, setLeaderSearchQuery] = useState('');
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  return (
    <GovToastProvider>
      <GovToast />
      <NewPageWrapper
        leftSidebar={<GovOrgsSidebar />}
        rightSidebar={<GovBuildingsSidebar />}
        mobileLeftSidebarOpen={mobileLeftOpen}
        onMobileLeftSidebarOpenChange={setMobileLeftOpen}
        mobileRightSidebarOpen={mobileRightOpen}
        onMobileRightSidebarOpenChange={setMobileRightOpen}
      >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-shrink-0 py-10 px-4 border-b border-border-muted dark:border-white/10 bg-surface text-center relative">
          {/* Mobile: open left (organizations) and right (buildings) sidebars */}
          <button
            type="button"
            onClick={() => setMobileLeftOpen(true)}
            className="md:hidden absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            aria-label="Open organizations"
          >
            <BuildingOfficeIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setMobileRightOpen(true)}
            className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            aria-label="Open buildings"
          >
            <BuildingStorefrontIcon className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Minnesota Civic
          </h1>
          <p className="text-sm text-foreground-muted mt-2 max-w-md mx-auto">
            Organizations, people and roles, and civic buildings.
          </p>
          <div className="relative max-w-sm mx-auto mt-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted pointer-events-none" />
            <input
              type="search"
              value={leaderSearchQuery}
              onChange={(e) => setLeaderSearchQuery(e.target.value)}
              placeholder="Search leaders…"
              className="w-full text-sm pl-9 pr-3 py-2 rounded-md border border-border-muted dark:border-white/10 bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-foreground-muted"
              aria-label="Search leaders"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 px-2 py-2">
          <GovDashboard leaderSearchQuery={leaderSearchQuery} />
        </div>
      </div>
    </NewPageWrapper>
    </GovToastProvider>
  );
}
