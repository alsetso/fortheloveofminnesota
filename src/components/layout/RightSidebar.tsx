'use client';

import { ReactNode } from 'react';

interface RightSidebarProps {
  children?: ReactNode;
}

/**
 * Right Sidebar - Sticky, scrollable
 * Default empty; accepts custom content. Following list moved to LeftSidebar.
 */
export default function RightSidebar({ children }: RightSidebarProps) {
  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto scrollbar-hide">
      {children}
    </div>
  );
}
