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
