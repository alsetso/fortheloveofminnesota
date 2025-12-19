'use client';

import { useEffect, useRef } from 'react';

interface UsePageViewOptions {
  page_url?: string; // Optional - defaults to window.location.pathname
  enabled?: boolean;
}

/**
 * Hook to track page views using the simplified page_url system
 * Automatically uses current page path if page_url not provided
 */
export function usePageView({ page_url, enabled = true }: UsePageViewOptions = {}) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!enabled || hasTracked.current) return;

    // Get page URL - use provided or current pathname
    const url = page_url || (typeof window !== 'undefined' ? window.location.pathname : '');
    
    if (!url || url.trim() === '') {
      console.warn('[usePageView] Skipping - no page_url provided');
      return;
    }

    hasTracked.current = true;

    // Get additional metadata
    const referrer = typeof document !== 'undefined' ? document.referrer : null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    
    // Generate or get session ID from sessionStorage
    let sessionId: string | null = null;
    if (typeof window !== 'undefined') {
      sessionId = sessionStorage.getItem('analytics_session_id');
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('analytics_session_id', sessionId);
      }
    }

    const payload = {
      page_url: url,
      referrer_url: referrer || null,
      user_agent: userAgent || null,
      session_id: sessionId,
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const trackView = () => {
      fetch('/api/analytics/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true, // Allows request to complete even if page unloads
      })
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || error.message || `HTTP ${response.status}`);
          }
          return response.json();
        })
        .catch((error) => {
          // Silently fail - don't break the page
          console.error('[usePageView] Failed to track:', error.message || error, payload);
        });
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(trackView, { timeout: 2000 });
    } else {
      // Fallback: delay by 1 second
      setTimeout(trackView, 1000);
    }
  }, [page_url, enabled]);
}

