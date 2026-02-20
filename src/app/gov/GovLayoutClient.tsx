'use client';

import { useState, ReactNode } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import LeftSidebar from '@/components/layout/LeftSidebar';
import GovSubNav from '@/components/sub-nav/GovSubNav';
import GovContextSidebar from '@/components/gov/GovContextSidebar';
import { GovSidebarProvider } from '@/contexts/GovSidebarContext';

interface GovLayoutClientProps {
  children: ReactNode;
}

/**
 * GovSubSidebarContent renders the combined sub-sidebar panel:
 * - GovSubNav (always visible — main gov section nav)
 * - GovContextSidebar (route-aware contextual panel, renders below GovSubNav or null)
 */
function GovSubSidebarContent() {
  return (
    <div className="h-full flex flex-col">
      <GovSubNav />
      <GovContextSidebar />
    </div>
  );
}

export default function GovLayoutClient({ children }: GovLayoutClientProps) {
  const [subSidebarOpen, setSubSidebarOpen] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth >= 896 : true
  );

  return (
    <GovSidebarProvider>
      <NewPageWrapper
        leftSidebar={<LeftSidebar />}
        subSidebar={<GovSubSidebarContent />}
        subSidebarLabel="Government"
        subSidebarOpen={subSidebarOpen}
        onSubSidebarOpenChange={setSubSidebarOpen}
      >
        {children}
      </NewPageWrapper>
    </GovSidebarProvider>
  );
}
