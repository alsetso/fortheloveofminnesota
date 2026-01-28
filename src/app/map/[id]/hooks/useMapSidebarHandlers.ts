'use client';

import { useCallback } from 'react';

interface UseMapSidebarHandlersOptions {
  toggleSidebar: (type: string) => void;
  isLiveMap?: boolean;
}

/**
 * Consolidated sidebar handlers
 * Reduces 5 identical handler functions to a single reusable pattern
 */
export function useMapSidebarHandlers({ toggleSidebar, isLiveMap = false }: UseMapSidebarHandlersOptions) {
  return {
    handleSettingsClick: useCallback(() => toggleSidebar('settings'), [toggleSidebar]),
    handleFilterClick: useCallback(() => toggleSidebar('filter'), [toggleSidebar]),
    handlePostsClick: useCallback(() => {
      // Only allow opening posts sidebar on live map - posts removed from custom maps
      if (isLiveMap) {
        toggleSidebar('posts');
      }
    }, [toggleSidebar, isLiveMap]),
    handleMembersClick: useCallback(() => toggleSidebar('members'), [toggleSidebar]),
    handleJoinClick: useCallback(() => toggleSidebar('join'), [toggleSidebar]),
  };
}
