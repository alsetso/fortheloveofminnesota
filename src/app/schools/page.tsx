'use client';

import { useState } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import SchoolsSubNav from '@/components/sub-nav/SchoolsSubNav';
import FollowedSchoolsList from '@/components/schools/FollowedSchoolsList';

export default function SchoolsPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<SchoolsSubNav />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      rightSidebar={<RightSidebar />}
    >
      <FollowedSchoolsList />
    </NewPageWrapper>
  );
}
