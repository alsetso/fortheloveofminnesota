let mapboxgl: typeof import('mapbox-gl').default | null = null;
let loadPromise: Promise<typeof import('mapbox-gl').default> | null = null;

/** Dynamic Mapbox GL import — keeps the shell SSR-safe. CSS is loaded via globals.css. */
export async function loadMapboxGL(): Promise<typeof import('mapbox-gl').default> {
  if (mapboxgl) return mapboxgl;
  if (!loadPromise) {
    loadPromise = import('mapbox-gl').then((mod) => {
      mapboxgl = mod.default;
      loadPromise = null;
      return mapboxgl;
    });
  }
  return loadPromise;
}
