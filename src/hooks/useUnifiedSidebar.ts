'use client';

import { useState, useCallback } from 'react';

export type UnifiedSidebarType = string | null;

interface UseUnifiedSidebarOptions {
  initialType?: UnifiedSidebarType;
}

interface UseUnifiedSidebarReturn {
  activeSidebar: UnifiedSidebarType;
  isSidebarOpen: boolean;
  openSidebar: (type: UnifiedSidebarType) => void;
  closeSidebar: () => void;
  toggleSidebar: (type: UnifiedSidebarType) => void;
}

/**
 * Unified hook for managing a single left sidebar across all pages.
 * 
 * Only one sidebar can be active at a time. Clicking an icon switches
 * which content is shown in the left sidebar position.
 * 
 * @param options - Configuration options
 * @param options.initialType - Initial sidebar type to show (default: null)
 * 
 * @returns Sidebar state and control functions
 * 
 * @example
 * ```tsx
 * const {
 *   activeSidebar,
 *   isSidebarOpen,
 *   toggleSidebar,
 *   closeSidebar,
 * } = useUnifiedSidebar();
 * 
 * // Toggle filter sidebar
 * <button onClick={() => toggleSidebar('filter')}>Filter</button>
 * 
 * // Toggle settings sidebar (closes filter if open)
 * <button onClick={() => toggleSidebar('settings')}>Settings</button>
 * ```
 */
export function useUnifiedSidebar({
  initialType = null,
}: UseUnifiedSidebarOptions = {}): UseUnifiedSidebarReturn {
  const [activeSidebar, setActiveSidebar] = useState<UnifiedSidebarType>(initialType);

  const openSidebar = useCallback((type: UnifiedSidebarType) => {
    setActiveSidebar(type);
  }, []);

  const closeSidebar = useCallback(() => {
    setActiveSidebar(null);
  }, []);

  const toggleSidebar = useCallback((type: UnifiedSidebarType) => {
    setActiveSidebar(prev => prev === type ? null : type);
  }, []);

  return {
    activeSidebar,
    isSidebarOpen: activeSidebar !== null,
    openSidebar,
    closeSidebar,
    toggleSidebar,
  };
}
