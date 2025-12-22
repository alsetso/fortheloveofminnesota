'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';

/**
 * Centralized hook for managing profile page URL state
 * 
 * Manages:
 * - mentionId: Currently selected mention (opens popup)
 * - view: View mode ('visitor' for owner preview, undefined for owner view)
 * 
 * Improvements:
 * - Single source of truth (URL is the state)
 * - Debounced rapid mention switching
 * - Transition state to prevent conflicts
 * - Clean browser navigation handling
 * - Proper cleanup on unmount
 */

interface UrlStateUpdate {
  mentionId?: string | null;
  view?: 'owner' | 'visitor' | null;
}

export function useProfileUrlState() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  // Transition state to prevent rapid changes
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track the last URL we set programmatically
  const lastUrlRef = useRef<string>('');
  
  // Local state for immediate updates (searchParams doesn't update with replaceState)
  const [mentionId, setMentionIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('mentionId');
  });
  
  const [viewMode, setViewModeState] = useState<'owner' | 'visitor'>(() => {
    if (typeof window === 'undefined') return 'owner';
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'visitor' ? 'visitor' : 'owner';
  });

  // Sync with searchParams for browser back/forward navigation
  useEffect(() => {
    const urlMentionId = searchParams.get('mentionId');
    const urlView = searchParams.get('view');
    const urlViewMode = urlView === 'visitor' ? 'visitor' : 'owner';
    
    // Only sync if values differ (prevents unnecessary updates)
    if (urlMentionId !== mentionId) {
      setMentionIdState(urlMentionId);
    }
    
    if (urlViewMode !== viewMode) {
      setViewModeState(urlViewMode);
    }
  }, [searchParams, mentionId, viewMode]);

  /**
   * Handle browser back/forward navigation
   */
  useEffect(() => {
    const handlePopState = () => {
      // Clear any pending debounce when user navigates
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setIsTransitioning(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  /**
   * Cleanup on unmount - clear pinId if popup is open
   */
  useEffect(() => {
    return () => {
      // Clean up debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // If there's a mentionId in the URL when unmounting, clean it up
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.has('mentionId')) {
          params.delete('mentionId');
          const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
          window.history.replaceState({}, '', newUrl);
        }
      }
    };
  }, []);

  /**
   * Core URL update function with debouncing
   */
  const updateUrl = useCallback((
    updates: UrlStateUpdate,
    options: {
      method?: 'replace' | 'push';
      immediate?: boolean;
    } = {}
  ) => {
    const { method = 'replace', immediate = false } = options;
    
    // Clear existing debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const performUpdate = () => {
      if (typeof window === 'undefined') return;
      
      const url = new URL(window.location.href);
      
      // Handle mentionId
      if ('mentionId' in updates) {
        if (updates.mentionId) {
          url.searchParams.set('mentionId', updates.mentionId);
          setMentionIdState(updates.mentionId); // Update state immediately
        } else {
          url.searchParams.delete('mentionId');
          setMentionIdState(null); // Update state immediately
        }
      }
      
      // Handle view
      if ('view' in updates) {
        if (updates.view === 'visitor') {
          url.searchParams.set('view', 'visitor');
          setViewModeState('visitor'); // Update state immediately
        } else {
          url.searchParams.delete('view');
          setViewModeState('owner'); // Update state immediately
        }
      }
      
      const newUrl = url.pathname + url.search;
      
      // Only update if URL actually changed
      if (newUrl !== lastUrlRef.current) {
        lastUrlRef.current = newUrl;
        
        if (method === 'replace') {
          window.history.replaceState({}, '', newUrl);
        } else {
          window.history.pushState({}, '', newUrl);
        }
        
        // Don't call router.replace() - it causes page refresh
        // window.history.replaceState() is sufficient for shareable URLs
        // The URL is already in the browser's address bar, so it's bookmarkable/shareable
      }
      
      setIsTransitioning(false);
    };

    // For immediate updates (like closing popup), don't debounce
    if (immediate || updates.mentionId === null) {
      performUpdate();
    } else {
      // Debounce rapid mention switches
      setIsTransitioning(true);
      debounceTimerRef.current = setTimeout(performUpdate, 100);
    }
  }, []);

  /**
   * Set mentionId in URL (opens popup)
   */
  const setMentionId = useCallback((newMentionId: string | null, immediate: boolean = false) => {
    if (isTransitioning && !immediate) {
      // Prevent rapid switching unless immediate flag is set
      return;
    }
    updateUrl({ mentionId: newMentionId }, { immediate });
  }, [updateUrl, isTransitioning]);

  /**
   * Clear mentionId from URL (closes popup) - always immediate
   */
  const clearMentionId = useCallback(() => {
    updateUrl({ mentionId: null }, { immediate: true });
  }, [updateUrl]);

  /**
   * Set view mode in URL
   */
  const setView = useCallback((mode: 'owner' | 'visitor') => {
    updateUrl({ view: mode }, { immediate: true });
  }, [updateUrl]);

  /**
   * Toggle view mode (owner ↔ visitor)
   */
  const toggleView = useCallback(() => {
    const newMode = viewMode === 'owner' ? 'visitor' : 'owner';
    updateUrl({ view: newMode }, { immediate: true });
  }, [viewMode, updateUrl]);

  /**
   * Clear both mentionId and view (reset to default)
   */
  const clearAll = useCallback(() => {
    updateUrl({ mentionId: null, view: null }, { immediate: true });
  }, [updateUrl]);

  /**
   * Set mentionId and view in one operation
   */
  const setMentionIdAndView = useCallback((
    newMentionId: string | null,
    newView: 'owner' | 'visitor' | null,
    immediate: boolean = false
  ) => {
    if (isTransitioning && !immediate && newMentionId !== null) {
      return;
    }
    updateUrl({ mentionId: newMentionId, view: newView }, { immediate });
  }, [updateUrl, isTransitioning]);

  /**
   * Switch to a different mention (closes current, opens new)
   */
  const switchMention = useCallback((newMentionId: string) => {
    // Force immediate to ensure smooth transition
    updateUrl({ mentionId: newMentionId }, { immediate: true });
  }, [updateUrl]);

  return {
    // State
    mentionId,
    viewMode,
    isTransitioning,
    
    // Setters
    setMentionId,
    clearMentionId,
    setView,
    toggleView,
    clearAll,
    setMentionIdAndView,
    switchMention,
    
    // Raw update function for complex operations
    updateUrl,
    
    // Legacy aliases for backward compatibility (deprecated)
    pinId: mentionId,
    setPinId: setMentionId,
    clearPinId: clearMentionId,
    setPinIdAndView: setMentionIdAndView,
    switchPin: switchMention,
  };
}