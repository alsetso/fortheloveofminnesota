'use client';

import { useState } from 'react';
import Link from 'next/link';
import { XMarkIcon } from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import WorkSubNav from '@/components/sub-nav/WorkSubNav';
import WorkRightSidebar from '@/components/work/WorkRightSidebar';
import WorkMap from '@/components/work/WorkMap';
import WorkMapGate from '@/components/work/WorkMapGate';
import { WorkViewProvider } from '@/contexts/WorkViewContext';

export default function WorkPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);
  const [careersBannerOpen, setCareersBannerOpen] = useState(true);

  return (
    <WorkViewProvider>
      <NewPageWrapper
        leftSidebar={<LeftSidebar />}
      subSidebar={<WorkSubNav />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      subSidebarLabel="Work"
      mainNoScroll
      rightSidebar={<WorkRightSidebar />}
    >
      <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden p-[10px] gap-3">
        {careersBannerOpen && (
          <div className="shrink-0 flex items-center justify-between gap-2 p-[10px] rounded-md border border-gray-200 bg-white">
            <Link
              href="/contact"
              className="flex-1 min-w-0 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Start a career with Love of Minnesota — contact us to learn more.
            </Link>
            <button
              type="button"
              onClick={() => setCareersBannerOpen(false)}
              aria-label="Dismiss"
              className="shrink-0 p-0.5 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 w-full relative rounded-md overflow-hidden">
          <WorkMapGate>
            <WorkMap />
          </WorkMapGate>
        </div>
      </div>
    </NewPageWrapper>
    </WorkViewProvider>
  );
}
