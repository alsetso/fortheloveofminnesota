'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RealEstateSubNav from '@/components/sub-nav/RealEstateSubNav';
import RealEstateRightSidebar from '@/components/realestate/RealEstateRightSidebar';
import RealEstateMap from '@/components/realestate/RealEstateMap';
import RealEstateMapGate from '@/components/realestate/RealEstateMapGate';

export default function RealestatePage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);
  const [addressQuery, setAddressQuery] = useState('');

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<RealEstateSubNav />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      subSidebarLabel="Real Estate"
      mainNoScroll
      rightSidebar={<RealEstateRightSidebar />}
    >
      <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden p-[10px]">
        <div className="flex-shrink-0 mb-2">
          <label htmlFor="realestate-address-search" className="sr-only">
            Search address
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              id="realestate-address-search"
              type="search"
              placeholder="Search address"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-surface text-gray-900 dark:text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 w-full relative rounded-md overflow-hidden">
          <RealEstateMapGate>
            <RealEstateMap />
          </RealEstateMapGate>
        </div>
      </div>
    </NewPageWrapper>
  );
}
