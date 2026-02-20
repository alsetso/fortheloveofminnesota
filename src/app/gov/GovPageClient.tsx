'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GovSubNav from '@/components/sub-nav/GovSubNav';
import GovOrgsSidebar from './components/GovOrgsSidebar';
import GovBuildingsSidebar from './components/GovBuildingsSidebar';
import GovDashboard from './components/GovDashboard';
import GovToast from './components/GovToast';
import { GovToastProvider } from './contexts/GovToastContext';
import { MagnifyingGlassIcon, MapIcon, ListBulletIcon } from '@heroicons/react/24/outline';

const GovMap = dynamic(() => import('@/components/gov/GovMap'), { ssr: false });

interface GovPageClientProps {
  isAuthenticated: boolean;
}

export default function GovPageClient({ isAuthenticated }: GovPageClientProps) {
  const [leaderSearchQuery, setLeaderSearchQuery] = useState('');
  const [subSidebarOpen, setSubSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 896 : true
  );
  const [view, setView] = useState<'list' | 'map'>('list');

  return (
    <GovToastProvider>
      <GovToast />
      <NewPageWrapper
        leftSidebar={<LeftSidebar />}
        subSidebar={<GovSubNav />}
        subSidebarLabel="Government"
        subSidebarOpen={subSidebarOpen}
        onSubSidebarOpenChange={setSubSidebarOpen}
        rightSidebar={<GovBuildingsSidebar />}
        mainNoScroll={view === 'map'}
      >
        {view === 'map' ? (
          <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden p-[10px]">
            <div className="flex-1 min-h-0 w-full relative rounded-md overflow-hidden">
              <GovMap />
              <button
                type="button"
                onClick={() => setView('list')}
                className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                aria-label="Switch to list view"
              >
                <ListBulletIcon className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto w-full px-[10px] py-3 space-y-3">
            <div className="flex-shrink-0 pt-6 pb-3 text-center">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Minnesota Civic
              </h1>
              <p className="text-sm text-foreground-muted mt-2 max-w-md mx-auto">
                Organizations, people and roles, and civic buildings.
              </p>
              <div className="flex items-center gap-2 max-w-sm mx-auto mt-4">
                <div className="relative flex-1">
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
                <button
                  type="button"
                  onClick={() => setView('map')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-md border border-border-muted dark:border-white/10 bg-surface text-foreground-muted hover:bg-surface-accent hover:text-foreground transition-colors flex-shrink-0"
                  aria-label="Switch to map view"
                >
                  <MapIcon className="w-4 h-4" />
                  Map
                </button>
              </div>
            </div>

            <GovDashboard leaderSearchQuery={leaderSearchQuery} />

            <GovOrgsSidebar />
          </div>
        )}
      </NewPageWrapper>
    </GovToastProvider>
  );
}
