/**
 * Hook to preload Mapbox GL JS library and styles early
 * Call this on app mount or route prefetch to improve map initialization performance
 */

import { useEffect } from 'react';
import { preloadMapboxGL, preloadMapboxCSS } from '@/features/map/utils/mapboxLoader';
import { mapStylePreloader } from '@/features/map/services/mapStylePreloader';

interface UseMapboxPreloadOptions {
  /** Preload Mapbox GL JS library (default: true) */
  preloadLibrary?: boolean;
  /** Preload Mapbox CSS (default: true) */
  preloadCSS?: boolean;
  /** Preload map styles (default: true) */
  preloadStyles?: boolean;
  /** Delay before preloading (ms) - allows critical resources to load first (default: 0) */
  delay?: number;
}

/**
 * Preload Mapbox resources early to improve map initialization performance
 * 
 * What gets cached:
 * - Mapbox GL JS library: Browser module cache (automatic)
 * - Mapbox CSS: Browser cache (automatic)
 * - Style JSON: localStorage (7-day TTL, managed by mapStylePreloader)
 * - Vector tiles: Browser cache (12-hour TTL, managed by Mapbox)
 * 
 * Usage:
 * ```tsx
 * // In your root layout or main page component
 * useMapboxPreload({ delay: 1000 }); // Wait 1s after mount
 * ```
 */
export function useMapboxPreload(options: UseMapboxPreloadOptions = {}): void {
  const {
    preloadLibrary = true,
    preloadCSS = true,
    preloadStyles = true,
    delay = 0,
  } = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preload = () => {
      const promises: Promise<any>[] = [];

      if (preloadLibrary) {
        promises.push(preloadMapboxGL().catch((err) => {
          console.debug('[useMapboxPreload] Library preload failed:', err);
        }));
      }

      if (preloadCSS) {
        promises.push(preloadMapboxCSS().catch((err) => {
          console.debug('[useMapboxPreload] CSS preload failed:', err);
        }));
      }

      if (preloadStyles) {
        promises.push(mapStylePreloader.preloadAllStyles().catch((err) => {
          console.debug('[useMapboxPreload] Style preload failed:', err);
        }));
      }

      // Don't await - let it run in background
      Promise.all(promises).catch(() => {
        // Errors already logged above
      });
    };

    if (delay > 0) {
      const timeoutId = setTimeout(preload, delay);
      return () => clearTimeout(timeoutId);
    } else {
      preload();
      return undefined;
    }
  }, [preloadLibrary, preloadCSS, preloadStyles, delay]);
}
