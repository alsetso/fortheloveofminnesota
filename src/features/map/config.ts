// Map configuration
export const MAP_CONFIG = {
  MAPBOX_TOKEN: (() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token || token === 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw') {
      console.error('Mapbox token not configured');
      return '';
    }
    return token;
  })(),
  MAPBOX_STYLE: process.env.NEXT_PUBLIC_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-v12',
  
  STRATEGIC_STYLES: {
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    light: 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  },
  
  DEFAULT_CENTER: [-93.2650, 44.9778] as [number, number],
  DEFAULT_ZOOM: 10,
  MIN_ZOOM: 0,
  MAX_ZOOM: 22,
  ADDRESS_ZOOM: 16,
  
  MARKER_COLORS: {
    ADDRESS_PIN: '#C2B289',
    USER_MARKER: '#222020',
    ADDRESS_SEARCH: '#222020',
    ADDRESS_CURRENT: '#10B981',
    ADDRESS_PREVIOUS: '#F59E0B',
    SKIP_TRACE: '#222020',
  },
  
  MINNESOTA_BOUNDS: {
    north: 49.5,
    south: 43.5,
    east: -89.5,
    west: -97.5,
  },
  
  GEOLOCATION_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  },
  
  GEOCODING_BASE_URL: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
  GEOCODING_LIMIT: 5,
  GEOCODING_COUNTRY: 'us',
} as const;

// Type for map configuration
export type MapConfig = typeof MAP_CONFIG;

/**
 * Zoom scale reference for UI breakpoints (Mapbox Web Mercator).
 * Use map.getZoom() and compare to these levels to adjust UI (e.g. hide/show labels, simplify layers).
 *
 * Zoom | Approx. scale (at 45°N) | Typical view
 * -----|--------------------------|------------------
 *   0  | 1 : 500M                 | World
 *   1  | 1 : 250M                 | Continents
 *   3  | 1 : 62M                  | Continental US
 *   5  | 1 : 15M                  | Multi-state
 *   7  | 1 : 4M                   | State (MN fits)
 *   9  | 1 : 1M                   | Metro area
 *  10  | 1 : 500k                 | DEFAULT_ZOOM – metro
 *  12  | 1 : 125k                 | City
 *  14  | 1 : 31k                  | Neighborhood
 *  16  | 1 : 8k (ADDRESS_ZOOM)    | Street / address
 *  18  | 1 : 2k                   | Block
 *  22  | 1 : 0.5k (MAX_ZOOM)      | Building
 */
export const ZOOM_SCALE_REFERENCE = {
  WORLD: 0,
  CONTINENT: 1,
  MULTI_STATE: 5,
  STATE: 7,
  METRO: 9,
  DEFAULT: 10,
  CITY: 12,
  NEIGHBORHOOD: 14,
  STREET: 16,
  BLOCK: 18,
  MAX: 22,
} as const;

/**
 * Live map boundary layer zoom ranges and order.
 * Single source of truth: change here to reorder layers or adjust zoom levels.
 * Layer is visible when zoom >= minzoom and zoom < maxzoom.
 * Order in array = priority for footer "layer title by zoom" (first matching range wins).
 */
export const LIVE_BOUNDARY_ZOOM_LAYERS = [
  { layer: 'state' as const, minzoom: 1, maxzoom: 4, label: 'State' },
  { layer: 'county' as const, minzoom: 4, maxzoom: 6, label: 'County' },
  { layer: 'ctu' as const, minzoom: 6, maxzoom: 9, label: 'City and Town' },
  { layer: 'district' as const, minzoom: 9, maxzoom: 12, label: 'Congressional District' },
] as const;

export type LiveBoundaryLayerId = (typeof LIVE_BOUNDARY_ZOOM_LAYERS)[number]['layer'];

/** Zoom level at which pins can be dropped on live map (same as top of CTU range). */
export const LIVE_ZOOM_FOR_PINS = 12;

/** Get the layer label for a zoom level when no boundary is selected (e.g. footer header). */
export function getLiveLayerTitleByZoom(zoom: number | undefined): string {
  if (zoom === undefined) return 'Location';
  const entry = LIVE_BOUNDARY_ZOOM_LAYERS.find((e) => zoom >= e.minzoom && zoom < e.maxzoom);
  return entry?.label ?? 'Location';
}

const liveZoomByLayer: Record<LiveBoundaryLayerId, { minzoom: number; maxzoom: number }> = Object.fromEntries(
  LIVE_BOUNDARY_ZOOM_LAYERS.map((e) => [e.layer, { minzoom: e.minzoom, maxzoom: e.maxzoom }])
) as Record<LiveBoundaryLayerId, { minzoom: number; maxzoom: number }>;

/** Get minzoom/maxzoom for a live boundary layer (for BoundaryLayersManager). */
export function getLiveBoundaryZoomRange(layer: LiveBoundaryLayerId): { minzoom: number; maxzoom: number } {
  return liveZoomByLayer[layer];
}

/** Get display label for a live boundary layer (e.g. footer "State: Minnesota"). */
export function getLiveLayerLabel(layer: LiveBoundaryLayerId): string {
  return LIVE_BOUNDARY_ZOOM_LAYERS.find((e) => e.layer === layer)?.label ?? 'Boundary';
}
