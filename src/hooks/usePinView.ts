'use client';

import { useEffect, useRef } from 'react';

interface UsePinViewOptions {
  pin_id: string;
  enabled?: boolean;
}

/**
 * Hook to track pin views using the simplified pin_views system
 */
export function usePinView({ pin_id, enabled = true }: UsePinViewOptions) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!enabled || hasTracked.current || !pin_id) return;

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
      pin_id,
      referrer_url: referrer || null,
      user_agent: userAgent || null,
      session_id: sessionId,
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    const trackView = () => {
      fetch('/api/analytics/pin-view', {
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
          console.error('[usePinView] Failed to track:', error.message || error, payload);
        });
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(trackView, { timeout: 2000 });
    } else {
      // Fallback: delay by 1 second
      setTimeout(trackView, 1000);
    }
  }, [pin_id, enabled]);
}

