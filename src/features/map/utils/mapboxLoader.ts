/**
 * Dynamic import for Mapbox GL JS
 * Prevents loading Mapbox until needed
 * 
 * Performance optimizations:
 * - Preloads library on app mount (via preloadMapboxGL)
 * - Browser module cache handles subsequent loads
 */
let mapboxgl: typeof import('mapbox-gl').default | null = null;
let preloadPromise: Promise<typeof import('mapbox-gl').default> | null = null;

export async function loadMapboxGL(): Promise<typeof import('mapbox-gl').default> {
  if (mapboxgl) {
    return mapboxgl;
  }
  
  // If preload is in progress, wait for it
  if (preloadPromise) {
    return preloadPromise;
  }
  
  // Otherwise, load now
  const mapboxModule = await import('mapbox-gl');
  mapboxgl = mapboxModule.default;
  return mapboxgl;
}

/**
 * Preload Mapbox GL JS library early (e.g., on app mount or route prefetch)
 * This allows the browser to download and cache the library before it's needed
 */
export function preloadMapboxGL(): Promise<typeof import('mapbox-gl').default> {
  if (mapboxgl) {
    return Promise.resolve(mapboxgl);
  }
  
  if (!preloadPromise) {
    preloadPromise = import('mapbox-gl').then((module) => {
      mapboxgl = module.default;
      preloadPromise = null;
      return mapboxgl;
    });
  }
  
  return preloadPromise;
}

/**
 * Preload Mapbox CSS early
 */
export function preloadMapboxCSS(): Promise<void> {
  return import('mapbox-gl/dist/mapbox-gl.css').then(() => {});
}

/**
 * Inject Mapbox Draw CSS via link tag (avoids webpack CSS extraction issues)
 * Uses a CDN fallback or copies CSS to public folder in production
 */
function injectMapboxDrawCSS(): void {
  if (typeof document === 'undefined') return; // SSR guard
  
  const linkId = 'mapbox-gl-draw-css';
  if (document.getElementById(linkId)) return; // Already injected
  
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  // Use CDN or ensure CSS is copied to public folder during build
  // For now, try to load from unpkg CDN as fallback
  link.href = 'https://unpkg.com/@mapbox/mapbox-gl-draw@1.5.1/dist/mapbox-gl-draw.css';
  document.head.appendChild(link);
}

/**
 * Dynamic import for Mapbox Draw
 */
let mapboxDraw: typeof import('@mapbox/mapbox-gl-draw').default | null = null;

export async function loadMapboxDraw(): Promise<typeof import('@mapbox/mapbox-gl-draw').default> {
  if (!mapboxDraw) {
    const drawModule = await import('@mapbox/mapbox-gl-draw');
    mapboxDraw = drawModule.default;
    // Inject CSS via link tag instead of webpack import to avoid build errors
    injectMapboxDrawCSS();
  }
  return mapboxDraw;
}

/**
 * Ensure Mapbox GL is loaded before proceeding
 */
export async function ensureMapboxLoaded(): Promise<typeof import('mapbox-gl').default> {
  return loadMapboxGL();
}



