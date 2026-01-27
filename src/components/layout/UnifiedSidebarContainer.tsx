'use client';

import BottomButtonsPopup from './BottomButtonsPopup';
import type { UnifiedSidebarType } from '@/hooks/useUnifiedSidebar';

interface SidebarContent {
  type: UnifiedSidebarType;
  title: string;
  content: React.ReactNode;
  popupType?: 'create' | 'home' | 'settings' | 'analytics' | 'location' | 'collections' | 'account' | 'search' | 'members';
  darkMode?: boolean;
  infoText?: string;
}

interface UnifiedSidebarContainerProps {
  activeSidebar: UnifiedSidebarType;
  onClose: () => void;
  sidebars: SidebarContent[];
  /** Additional class names for desktop sidebar */
  sidebarClassName?: string;
}

/**
 * Unified sidebar container that always renders on the left.
 * 
 * On desktop: Fixed left sidebar that slides in/out
 * On mobile: Bottom slide-up popups
 * 
 * Only one sidebar can be active at a time. Clicking different icons
 * switches which content is shown in the left sidebar position.
 */
export default function UnifiedSidebarContainer({
  activeSidebar,
  onClose,
  sidebars,
  sidebarClassName = '',
}: UnifiedSidebarContainerProps) {
  const activeSidebarConfig = sidebars.find(s => s.type === activeSidebar);

  return (
    <>
      {/* Mobile: Bottom slide-up popups */}
      <div className="lg:hidden absolute inset-0 pointer-events-none z-[9997]" style={{ height: '100%', maxHeight: '100%' }}>
        {activeSidebarConfig && (
          <BottomButtonsPopup
            isOpen={true}
            onClose={onClose}
            type={activeSidebarConfig.popupType || 'settings'}
            height="full"
            darkMode={activeSidebarConfig.darkMode || false}
            containerRelative={true}
            infoText={activeSidebarConfig.infoText}
          >
            {activeSidebarConfig.content}
          </BottomButtonsPopup>
        )}
      </div>

      {/* Desktop: Fixed left sidebar - uses transform to avoid map resize */}
      <aside
        className={`hidden lg:block transition-all duration-300 ease-in-out flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden ${
          activeSidebar 
            ? 'w-80 translate-x-0' 
            : 'w-0 -translate-x-full'
        } ${sidebarClassName}`}
      >
        {activeSidebarConfig && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {activeSidebarConfig.content}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
