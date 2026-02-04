'use client';

/**
 * Client component to preload Mapbox resources early
 * This improves map initialization performance by:
 * - Preloading Mapbox GL JS library (browser module cache)
 * - Preloading Mapbox CSS (browser cache)
 * - Preloading and caching style JSON (localStorage, 7-day TTL)
 * 
 * Vector tiles are automatically cached by Mapbox (12-hour TTL)
 */
import { useMapboxPreload } from '@/hooks/useMapboxPreload';

export default function MapboxPreloader() {
  // Preload Mapbox resources after a short delay to allow critical resources to load first
  // The delay ensures we don't compete with critical path resources
  useMapboxPreload({
    preloadLibrary: true,
    preloadCSS: true,
    preloadStyles: true,
    delay: 1000, // Wait 1 second after mount
  });

  return null; // This component doesn't render anything
}
