'use client';

import { useState } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';

export default function WorkPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      rightSidebar={<RightSidebar />}
    >
      <div className="p-4">
        <h1 className="text-sm font-semibold text-gray-900">Work</h1>
        <p className="text-xs text-gray-500 mt-1">Minnesota jobs, employers, and workforce data.</p>
      </div>
    </NewPageWrapper>
  );
}
