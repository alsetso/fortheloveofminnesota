'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface UrlMapState {
  year: number | null; // Filter pins by year
}

/**
 * Hook for year filter URL parameter.
 * 
 * Supports:
 * - `?year=2024` - Filter pins by year
 */
export function useUrlMapState() {
  const searchParams = useSearchParams();

  // Parse current URL state
  const getUrlState = useCallback((): UrlMapState => {
    const yearParam = searchParams.get('year');

    return {
      year: yearParam ? parseInt(yearParam, 10) : null,
    };
  }, [searchParams]);

  // Update URL without triggering navigation
  const updateUrl = useCallback((params: Partial<UrlMapState>, replace = true) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    
    if (params.year !== undefined) {
      if (params.year !== null && !isNaN(params.year)) {
        url.searchParams.set('year', params.year.toString());
      } else {
        url.searchParams.delete('year');
      }
    }

    const newUrl = url.pathname + url.search;
    if (replace) {
      window.history.replaceState({}, '', newUrl || '/');
    } else {
      window.history.pushState({}, '', newUrl || '/');
    }
  }, []);

  return {
    // Current URL state
    urlState: getUrlState(),
    // URL manipulation
    updateUrl,
  };
}


