'use client';

import { useState, ReactNode } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';
import PeopleSubNav from '@/components/sub-nav/PeopleSubNav';
import PeopleRightSidebar from '@/components/people/PeopleRightSidebar';

interface PeopleLayoutClientProps {
  children: ReactNode;
}

export default function PeopleLayoutClient({ children }: PeopleLayoutClientProps) {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebar={<PeopleSubNav />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      subSidebarLabel="People"
      rightSidebar={<PeopleRightSidebar />}
    >
      {children}
    </NewPageWrapper>
  );
}
