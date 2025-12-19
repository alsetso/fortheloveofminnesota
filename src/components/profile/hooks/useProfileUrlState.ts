'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';

/**
 * Centralized hook for managing profile page URL state
 * 
 * Manages:
 * - pinId: Currently selected pin (opens popup)
 * - view: View mode ('visitor' for owner preview, undefined for owner view)
 * 
 * Improvements:
 * - Single source of truth (URL is the state)
 * - Debounced rapid pin switching
 * - Transition state to prevent conflicts
 * - Clean browser navigation handling
 * - Proper cleanup on unmount
 */

interface UrlStateUpdate {
  pinId?: string | null;
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
  const [pinId, setPinIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('pinId');
  });
  
  const [viewMode, setViewModeState] = useState<'owner' | 'visitor'>(() => {
    if (typeof window === 'undefined') return 'owner';
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'visitor' ? 'visitor' : 'owner';
  });

  // Sync with searchParams for browser back/forward navigation
  useEffect(() => {
    const urlPinId = searchParams.get('pinId');
    const urlView = searchParams.get('view');
    const urlViewMode = urlView === 'visitor' ? 'visitor' : 'owner';
    
    // Only sync if values differ (prevents unnecessary updates)
    if (urlPinId !== pinId) {
      setPinIdState(urlPinId);
    }
    
    if (urlViewMode !== viewMode) {
      setViewModeState(urlViewMode);
    }
  }, [searchParams, pinId, viewMode]);

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
      
      // If there's a pinId in the URL when unmounting, clean it up
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.has('pinId')) {
          params.delete('pinId');
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
      
      // Handle pinId
      if ('pinId' in updates) {
        if (updates.pinId) {
          url.searchParams.set('pinId', updates.pinId);
          setPinIdState(updates.pinId); // Update state immediately
        } else {
          url.searchParams.delete('pinId');
          setPinIdState(null); // Update state immediately
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
    if (immediate || updates.pinId === null) {
      performUpdate();
    } else {
      // Debounce rapid pin switches
      setIsTransitioning(true);
      debounceTimerRef.current = setTimeout(performUpdate, 100);
    }
  }, []);

  /**
   * Set pinId in URL (opens popup)
   */
  const setPinId = useCallback((newPinId: string | null, immediate: boolean = false) => {
    if (isTransitioning && !immediate) {
      // Prevent rapid switching unless immediate flag is set
      return;
    }
    updateUrl({ pinId: newPinId }, { immediate });
  }, [updateUrl, isTransitioning]);

  /**
   * Clear pinId from URL (closes popup) - always immediate
   */
  const clearPinId = useCallback(() => {
    updateUrl({ pinId: null }, { immediate: true });
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
   * Clear both pinId and view (reset to default)
   */
  const clearAll = useCallback(() => {
    updateUrl({ pinId: null, view: null }, { immediate: true });
  }, [updateUrl]);

  /**
   * Set pinId and view in one operation
   */
  const setPinIdAndView = useCallback((
    newPinId: string | null,
    newView: 'owner' | 'visitor' | null,
    immediate: boolean = false
  ) => {
    if (isTransitioning && !immediate && newPinId !== null) {
      return;
    }
    updateUrl({ pinId: newPinId, view: newView }, { immediate });
  }, [updateUrl, isTransitioning]);

  /**
   * Switch to a different pin (closes current, opens new)
   */
  const switchPin = useCallback((newPinId: string) => {
    // Force immediate to ensure smooth transition
    updateUrl({ pinId: newPinId }, { immediate: true });
  }, [updateUrl]);

  return {
    // State
    pinId,
    viewMode,
    isTransitioning,
    
    // Setters
    setPinId,
    clearPinId,
    setView,
    toggleView,
    clearAll,
    setPinIdAndView,
    switchPin,
    
    // Raw update function for complex operations
    updateUrl,
  };
}