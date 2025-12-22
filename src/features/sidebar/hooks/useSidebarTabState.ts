'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export type SidebarTab = 'explore' | 'mentions' | 'controls' | 'poi' | 'faqs' | 'news' | null;

interface UseSidebarTabStateOptions {
  /** Whether to sync tab state to URL */
  syncToUrl?: boolean;
  /** Callback when tab changes */
  onTabChange?: (tab: SidebarTab) => void;
}

/**
 * Hook for managing sidebar tab state with URL synchronization.
 * 
 * URL parameter: `?tab=explore|mentions|controls|poi|faqs|news`
 * 
 * - When tab is active, URL shows `?tab=tabname`
 * - When URL has `?tab=tabname`, tab opens automatically
 * - All tabs use URL params on homepage
 * - Works only on homepage (`pathname === '/'`)
 */
export function useSidebarTabState(options: UseSidebarTabStateOptions = {}) {
  const { syncToUrl = true, onTabChange } = options;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const hasProcessedInitialParams = useRef(false);

  // Get tab from URL
  const getTabFromUrl = useCallback((): SidebarTab => {
    if (!isHomepage) return null;
    
    const tabParam = searchParams.get('tab');
    if (!tabParam) return null;

    // Allow all tabs in URL (explore, mentions, controls, poi, faqs, news)
    if (tabParam === 'explore' || tabParam === 'mentions' || tabParam === 'controls' || tabParam === 'poi' || tabParam === 'faqs' || tabParam === 'news') {
      return tabParam;
    }
    
    return null;
  }, [searchParams, isHomepage]);

  // Update URL with tab parameter
  const updateUrl = useCallback((tab: SidebarTab, replace = true) => {
    if (!syncToUrl || !isHomepage) return;
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    
    // Set URL param for all tabs
    if (tab === 'explore' || tab === 'mentions' || tab === 'controls' || tab === 'poi' || tab === 'faqs' || tab === 'news') {
      url.searchParams.set('tab', tab);
    } else {
      // Remove tab param when closing
      url.searchParams.delete('tab');
    }

    const newUrl = url.pathname + url.search;
    if (replace) {
      window.history.replaceState({}, '', newUrl || '/');
    } else {
      window.history.pushState({}, '', newUrl || '/');
    }
  }, [syncToUrl, isHomepage]);

  // Get current tab from URL (for initial load)
  const urlTab = getTabFromUrl();

  // Process initial URL params on mount
  useEffect(() => {
    if (!isHomepage || hasProcessedInitialParams.current) return;
    
    if (urlTab) {
      hasProcessedInitialParams.current = true;
      onTabChange?.(urlTab);
    } else {
      hasProcessedInitialParams.current = true;
    }
  }, [isHomepage, urlTab, onTabChange]);

  return {
    // Current tab from URL
    urlTab,
    // Update URL with tab
    updateUrl,
    // Helper to check if on homepage
    isHomepage,
  };
}

