'use client';

import UnifiedSidebarContainer from '@/components/layout/UnifiedSidebarContainer';
import type { UnifiedSidebarType } from '@/hooks/useUnifiedSidebar';

interface HomePageLayoutProps {
  children: React.ReactNode;
  leftSidebar: UnifiedSidebarType;
  rightSidebar: UnifiedSidebarType;
  onLeftSidebarClose: () => void;
  onRightSidebarClose: () => void;
  leftSidebarConfigs: Array<{
    type: UnifiedSidebarType;
    title: string;
    content: React.ReactNode;
    popupType?: 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'search' | 'members';
    darkMode?: boolean;
    infoText?: string;
  }>;
  rightSidebarConfigs: Array<{
    type: UnifiedSidebarType;
    title: string;
    content: React.ReactNode;
    popupType?: 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'search' | 'members';
    darkMode?: boolean;
    infoText?: string;
  }>;
}

export default function HomePageLayout({
  children,
  leftSidebar,
  rightSidebar,
  onLeftSidebarClose,
  onRightSidebarClose,
  leftSidebarConfigs,
  rightSidebarConfigs,
}: HomePageLayoutProps) {
  return (
    <div className="relative w-full h-full flex">
      {/* Mobile: Content + Sidebar containers handle popups */}
      <div className="lg:hidden w-full h-full relative overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
        <div className="absolute inset-0 w-full h-full overflow-y-auto">
          {children}
        </div>
        {/* Left sidebar popup */}
        <UnifiedSidebarContainer
          activeSidebar={leftSidebar}
          onClose={onLeftSidebarClose}
          sidebars={leftSidebarConfigs}
        />
        {/* Right sidebar popup - rendered separately for mobile */}
        {rightSidebar && rightSidebarConfigs.find(s => s.type === rightSidebar) && (
          <div className="absolute inset-0 pointer-events-none" style={{ height: '100%', maxHeight: '100%' }}>
            <UnifiedSidebarContainer
              activeSidebar={rightSidebar}
              onClose={onRightSidebarClose}
              sidebars={rightSidebarConfigs}
            />
          </div>
        )}
      </div>

      {/* Desktop: Three-column layout (left sidebar + content + right sidebar) */}
      <div className="hidden lg:flex w-full h-full">
        {/* Left Sidebar: Maps */}
        <UnifiedSidebarContainer
          activeSidebar={leftSidebar}
          onClose={onLeftSidebarClose}
          sidebars={leftSidebarConfigs}
        />
        
        {/* Center: Content */}
        <main className="flex-1 min-w-0 relative h-full overflow-y-auto">
          {children}
        </main>

        {/* Right Sidebar: Analytics */}
        <aside
          className={`${
            rightSidebar ? 'w-80' : 'w-0'
          } transition-all duration-300 ease-in-out flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden`}
        >
          {rightSidebarConfigs.find(s => s.type === rightSidebar) && (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto scrollbar-hide">
                {rightSidebarConfigs.find(s => s.type === rightSidebar)?.content}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
