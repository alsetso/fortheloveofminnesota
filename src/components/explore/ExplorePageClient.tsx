'use client';

import { useState } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import ExploreSubNav from '@/components/sub-nav/ExploreSubNav';
import ExploreRightSidebar from '@/components/explore/ExploreRightSidebar';
import ExploreContent from '@/components/explore/ExploreContent';

export default function ExplorePageClient() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 896 : true
  );

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<ExploreSubNav />}
      subSidebarLabel="Explore"
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      rightSidebar={<ExploreRightSidebar />}
    >
      <ExploreContent />
    </NewPageWrapper>
  );
}
