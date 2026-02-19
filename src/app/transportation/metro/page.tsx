'use client';

import { useState, lazy, Suspense } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import TransportSubNav from '@/components/sub-nav/TransportSubNav';

const GTFSMap = lazy(() => import('@/components/transportation/GTFSMap'));

export default function MetroPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<TransportSubNav />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      subSidebarLabel="Transport"
    >
      <div className="flex flex-col h-full p-4 space-y-3">
        <div className="space-y-1 flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-foreground">Metro (•Live)</h1>
          <p className="text-xs text-gray-500 dark:text-foreground-muted">
            Real-time vehicle positions from Metro Transit GTFS feeds
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex-1 min-h-[400px] rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface flex items-center justify-center">
              <div className="text-xs text-gray-400 dark:text-foreground-muted">Loading map...</div>
            </div>
          }
        >
          <GTFSMap />
        </Suspense>
      </div>
    </NewPageWrapper>
  );
}
