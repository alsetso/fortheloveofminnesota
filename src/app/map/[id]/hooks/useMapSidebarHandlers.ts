'use client';

import { useCallback } from 'react';

interface UseMapSidebarHandlersOptions {
  toggleSidebar: (type: string) => void;
}

/**
 * Consolidated sidebar handlers
 * Reduces 5 identical handler functions to a single reusable pattern
 */
export function useMapSidebarHandlers({ toggleSidebar }: UseMapSidebarHandlersOptions) {
  return {
    handleSettingsClick: useCallback(() => toggleSidebar('settings'), [toggleSidebar]),
    handleFilterClick: useCallback(() => toggleSidebar('filter'), [toggleSidebar]),
    handlePostsClick: useCallback(() => toggleSidebar('posts'), [toggleSidebar]),
    handleMembersClick: useCallback(() => toggleSidebar('members'), [toggleSidebar]),
    handleJoinClick: useCallback(() => toggleSidebar('join'), [toggleSidebar]),
  };
}
