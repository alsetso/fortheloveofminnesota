'use client';

import { useEffect, useRef } from 'react';
import { useAuthStateSafe } from '@/features/auth';

interface UsePageViewOptions {
  page_url?: string; // Optional - defaults to window.location.pathname
  enabled?: boolean;
  /** Override account ID for tracking */
  accountId?: string | null;
}

/**
 * Hook to track page views using the simplified page_url system
 * Automatically uses current page path if page_url not provided
 * Skips tracking if current account is an admin (to avoid polluting analytics)
 */
export function usePageView({ page_url, enabled = true, accountId }: UsePageViewOptions = {}) {
  const hasTracked = useRef(false);
  const { account } = useAuthStateSafe();
  
  // Skip tracking if current account is an admin
  const isAdmin = account?.role === 'admin';
  const shouldSkipTracking = isAdmin;

  useEffect(() => {
    if (!enabled || hasTracked.current || shouldSkipTracking) return;

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
    
    // Generate or get device ID from localStorage (shared across tabs on same device)
    let deviceId: string | null = null;
    if (typeof window !== 'undefined') {
      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      deviceId = localStorage.getItem('analytics_device_id');
      if (!deviceId || !isUuid(deviceId)) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('analytics_device_id', deviceId);
      }
    }

    const payload = {
      page_url: url,
      referrer_url: referrer || null,
      user_agent: userAgent || null,
      session_id: deviceId, // Using session_id column to store device_id
      ...(accountId !== undefined && { account_id: accountId }),
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
  }, [page_url, enabled, accountId, shouldSkipTracking]);
}



