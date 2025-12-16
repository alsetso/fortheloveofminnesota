import { MAP_CONFIG } from '../config';

/**
 * Validate coordinate values
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Validate coordinate object
 */
export function validateCoordinateObject(coordinates: { lat: number; lng: number }): boolean {
  return validateCoordinates(coordinates.lat, coordinates.lng);
}

/**
 * Check if coordinates are within Minnesota bounds
 */
export function isWithinBounds(lat: number, lng: number): boolean {
  return (
    lat >= MAP_CONFIG.MINNESOTA_BOUNDS.south &&
    lat <= MAP_CONFIG.MINNESOTA_BOUNDS.north &&
    lng >= MAP_CONFIG.MINNESOTA_BOUNDS.west &&
    lng <= MAP_CONFIG.MINNESOTA_BOUNDS.east
  );
}

/**
 * Validate Mapbox token configuration
 */
export function validateMapConfig(): { valid: boolean; error?: string } {
  if (!MAP_CONFIG.MAPBOX_TOKEN) {
    return { valid: false, error: 'Mapbox token missing' };
  }
  if (MAP_CONFIG.MAPBOX_TOKEN === 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw') {
    return { valid: false, error: 'Mapbox token not configured' };
  }
  return { valid: true };
}
