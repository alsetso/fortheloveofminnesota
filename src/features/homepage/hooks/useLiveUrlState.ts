'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface LiveUrlState {
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  mentionId: string | null;
}

/**
 * Hook for managing URL state on /live page
 * 
 * Supports:
 * - `?lat=44.9778&lng=-93.2650` - Navigate to location and open mentions sheet
 * - `?lat=44.9778&lng=-93.2650&zoom=15` - Navigate with custom zoom
 * - `?lat=44.9778&lng=-93.2650&mentionId=abc-123` - Navigate and highlight specific mention
 */
export function useLiveUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [hasProcessedUrl, setHasProcessedUrl] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Parse current URL state
  const getUrlState = useCallback((): LiveUrlState => {
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const zoomParam = searchParams.get('zoom');
    const mentionIdParam = searchParams.get('mentionId');

    return {
      lat: latParam ? parseFloat(latParam) : null,
      lng: lngParam ? parseFloat(lngParam) : null,
      zoom: zoomParam ? parseFloat(zoomParam) : null,
      mentionId: mentionIdParam || null,
    };
  }, [searchParams]);

  // Update URL without triggering navigation (with debouncing)
  const updateUrl = useCallback((params: Partial<LiveUrlState>, replace = true, debounceMs = 300) => {
    if (typeof window === 'undefined') return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce URL updates to prevent rapid re-renders
    debounceTimerRef.current = setTimeout(() => {
      const url = new URL(window.location.href);
      
      if (params.lat !== undefined) {
        if (params.lat !== null && !isNaN(params.lat)) {
          url.searchParams.set('lat', params.lat.toString());
        } else {
          url.searchParams.delete('lat');
        }
      }

      if (params.lng !== undefined) {
        if (params.lng !== null && !isNaN(params.lng)) {
          url.searchParams.set('lng', params.lng.toString());
        } else {
          url.searchParams.delete('lng');
        }
      }

      if (params.zoom !== undefined) {
        if (params.zoom !== null && !isNaN(params.zoom)) {
          url.searchParams.set('zoom', params.zoom.toString());
        } else {
          url.searchParams.delete('zoom');
        }
      }

      if (params.mentionId !== undefined) {
        if (params.mentionId !== null && params.mentionId.trim() !== '') {
          url.searchParams.set('mentionId', params.mentionId);
        } else {
          url.searchParams.delete('mentionId');
        }
      }

      const newUrl = url.pathname + url.search;
      if (replace) {
        window.history.replaceState({}, '', newUrl || '/');
      } else {
        window.history.pushState({}, '', newUrl || '/');
      }
    }, debounceMs);
  }, []);

  // Clear URL parameters
  const clearUrlParams = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('lat');
    url.searchParams.delete('lng');
    url.searchParams.delete('zoom');
    url.searchParams.delete('mentionId');
    window.history.replaceState({}, '', url.pathname);
  }, []);

  // Mark URL as processed after first check (prevents re-processing on every render)
  useEffect(() => {
    if (!hasProcessedUrl && (pathname === '/live' || pathname === '/map/live')) {
      const state = getUrlState();
      if (state.lat !== null && state.lng !== null) {
        setHasProcessedUrl(true);
      }
    }
  }, [hasProcessedUrl, pathname, getUrlState]);

  // Reset processed flag when mentionId changes (allows re-processing for different mentions)
  useEffect(() => {
    if (pathname === '/live' || pathname === '/map/live') {
      const state = getUrlState();
      if (state.mentionId) {
        // Reset processed flag when mentionId changes to allow re-highlighting
        setHasProcessedUrl(false);
      }
    }
  }, [searchParams, pathname, getUrlState]);

  // Reset processed flag when navigating away
  useEffect(() => {
    if (pathname !== '/live' && pathname !== '/map/live') {
      setHasProcessedUrl(false);
    }
  }, [pathname]);

  return {
    // Current URL state
    urlState: getUrlState(),
    // Whether URL has been processed (prevents duplicate processing)
    hasProcessedUrl,
    // Mark URL as processed
    setHasProcessedUrl,
    // URL manipulation
    updateUrl,
    clearUrlParams,
  };
}
