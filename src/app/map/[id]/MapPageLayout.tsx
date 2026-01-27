'use client';

import UnifiedSidebarContainer from '@/components/layout/UnifiedSidebarContainer';
import type { UnifiedSidebarType } from '@/hooks/useUnifiedSidebar';

interface MapPageLayoutProps {
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

export default function MapPageLayout({
  children,
  activeSidebar,
  onSidebarClose,
  sidebarConfigs,
}: MapPageLayoutProps) {
  return (
    <div className="relative w-full h-full flex">
      {/* Mobile: Map container + Sidebar container handles popups */}
      <div className="lg:hidden w-full h-full relative overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
        <div className="absolute inset-0 w-full h-full">
          {children}
        </div>
        <UnifiedSidebarContainer
          activeSidebar={activeSidebar}
          onClose={onSidebarClose}
          sidebars={sidebarConfigs}
        />
      </div>

      {/* Desktop: Two-column layout (left sidebar + map) */}
      <div className="hidden lg:flex w-full h-full">
        {/* Left Sidebar: Unified container */}
        <UnifiedSidebarContainer
          activeSidebar={activeSidebar}
          onClose={onSidebarClose}
          sidebars={sidebarConfigs}
        />
        
        {/* Center: Map */}
        <main className="flex-1 min-w-0 relative h-full overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
