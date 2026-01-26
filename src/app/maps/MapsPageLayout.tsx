'use client';

import UnifiedSidebarContainer from '@/components/layout/UnifiedSidebarContainer';
import type { UnifiedSidebarType } from '@/hooks/useUnifiedSidebar';

interface MapsPageLayoutProps {
  children: React.ReactNode;
  activeSidebar: UnifiedSidebarType;
  onSidebarClose: () => void;
  sidebarConfigs: Array<{
    type: UnifiedSidebarType;
    title: string;
    content: React.ReactNode;
    popupType?: 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'search' | 'members';
    darkMode?: boolean;
    infoText?: string;
  }>;
}

export default function MapsPageLayout({
  children,
  activeSidebar,
  onSidebarClose,
  sidebarConfigs,
}: MapsPageLayoutProps) {
  return (
    <div className="relative w-full h-full flex">
      {/* Mobile: Content + Sidebar container handles popups */}
      <div className="lg:hidden w-full h-full relative overflow-hidden">
        <div className="absolute inset-0 w-full h-full overflow-y-auto">
          {children}
        </div>
        <UnifiedSidebarContainer
          activeSidebar={activeSidebar}
          onClose={onSidebarClose}
          sidebars={sidebarConfigs}
        />
      </div>

      {/* Desktop: Two-column layout (left sidebar + content) */}
      <div className="hidden lg:flex w-full h-full">
        {/* Left Sidebar: Unified container */}
        <UnifiedSidebarContainer
          activeSidebar={activeSidebar}
          onClose={onSidebarClose}
          sidebars={sidebarConfigs}
        />
        
        {/* Center: Content */}
        <main className="flex-1 min-w-0 relative h-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
