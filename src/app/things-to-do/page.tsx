'use client';

import { useState } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import RightSidebar from '@/components/layout/RightSidebar';

export default function ThingsToDoPage() {
  const [subSidebarOpen, setSubSidebarOpen] = useState(true);

  return (
    <NewPageWrapper
      leftSidebar={<LeftSidebar />}
      subSidebarOpen={subSidebarOpen}
      onSubSidebarOpenChange={setSubSidebarOpen}
      rightSidebar={<RightSidebar />}
    >
      <div className="p-4">
        <h1 className="text-sm font-semibold text-gray-900">Things to Do</h1>
        <p className="text-xs text-gray-500 mt-1">Events, attractions, and activities across Minnesota.</p>
      </div>
    </NewPageWrapper>
  );
}
