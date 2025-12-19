/**
 * Dynamic import for Mapbox GL JS
 * Prevents loading Mapbox until needed
 */
let mapboxgl: typeof import('mapbox-gl').default | null = null;

export async function loadMapboxGL(): Promise<typeof import('mapbox-gl').default> {
  if (!mapboxgl) {
    const mapboxModule = await import('mapbox-gl');
    mapboxgl = mapboxModule.default;
  }
  return mapboxgl;
}

/**
 * Dynamic import for Mapbox Draw
 */
let mapboxDraw: typeof import('@mapbox/mapbox-gl-draw').default | null = null;

export async function loadMapboxDraw(): Promise<typeof import('@mapbox/mapbox-gl-draw').default> {
  if (!mapboxDraw) {
    const drawModule = await import('@mapbox/mapbox-gl-draw');
    mapboxDraw = drawModule.default;
    // Also import CSS
    await import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css');
  }
  return mapboxDraw;
}

/**
 * Ensure Mapbox GL is loaded before proceeding
 */
export async function ensureMapboxLoaded(): Promise<typeof import('mapbox-gl').default> {
  return loadMapboxGL();
}



