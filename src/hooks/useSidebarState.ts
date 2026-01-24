'use client';

import { useState, useCallback } from 'react';

interface UseSidebarStateOptions {
  initialLeft?: boolean;
  initialRight?: boolean;
}

interface UseSidebarStateReturn {
  isLeftSidebarVisible: boolean;
  isRightSidebarVisible: boolean;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
  closeLeftPanel: () => void;
  closeRightPanel: () => void;
}

/**
 * Reusable hook for managing sidebar state across pages with three-column layouts.
 * 
 * Handles both desktop (sidebar visibility) and mobile (slide-in panels) behavior.
 * 
 * @param options - Configuration options
 * @param options.initialLeft - Initial visibility state for left sidebar (default: true)
 * @param options.initialRight - Initial visibility state for right sidebar (default: true)
 * 
 * @returns Sidebar state and control functions
 * 
 * @example
 * ```tsx
 * const {
 *   isLeftSidebarVisible,
 *   isRightSidebarVisible,
 *   toggleLeft,
 *   toggleRight,
 * } = useSidebarState();
 * ```
 */
export function useSidebarState({
  initialLeft = true,
  initialRight = true,
}: UseSidebarStateOptions = {}): UseSidebarStateReturn {
  const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(initialLeft);
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(initialRight);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  const toggleLeft = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      setIsLeftSidebarVisible((v) => !v);
    } else {
      setIsRightPanelOpen(false);
      setIsLeftPanelOpen((v) => !v);
    }
  }, []);

  const toggleRight = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) {
      setIsRightSidebarVisible((v) => !v);
    } else {
      setIsLeftPanelOpen(false);
      setIsRightPanelOpen((v) => !v);
    }
  }, []);

  const closeLeftPanel = useCallback(() => {
    setIsLeftPanelOpen(false);
  }, []);

  const closeRightPanel = useCallback(() => {
    setIsRightPanelOpen(false);
  }, []);

  return {
    isLeftSidebarVisible,
    isRightSidebarVisible,
    isLeftPanelOpen,
    isRightPanelOpen,
    toggleLeft,
    toggleRight,
    closeLeftPanel,
    closeRightPanel,
  };
}
