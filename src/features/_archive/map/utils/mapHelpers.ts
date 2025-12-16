import { MAP_CONFIG } from '../config';
import type { Map as MapboxMap } from 'mapbox-gl';

/**
 * Fly to coordinates with optional zoom
 */
export function flyTo(
  map: MapboxMap,
  coordinates: { lat: number; lng: number },
  zoom?: number
): void {
  map.flyTo({
    center: [coordinates.lng, coordinates.lat],
    zoom: zoom || MAP_CONFIG.ADDRESS_ZOOM,
    duration: 1000,
  });
}

/**
 * Fit map to bounds
 */
export function fitBounds(
  map: MapboxMap,
  bounds: [[number, number], [number, number]],
  options?: { padding?: number; duration?: number }
): void {
  map.fitBounds(bounds, {
    padding: options?.padding || 50,
    duration: options?.duration || 1000,
  });
}

/**
 * Zoom to specific level
 */
export function zoomTo(map: MapboxMap, zoom: number, duration?: number): void {
  map.zoomTo(zoom, { duration: duration || 1000 });
}

/**
 * Pan to coordinates
 */
export function panTo(
  map: MapboxMap,
  coordinates: { lat: number; lng: number },
  duration?: number
): void {
  map.panTo([coordinates.lng, coordinates.lat], { duration: duration || 1000 });
}

/**
 * Calculate center point from coordinates array
 */
export function calculateCenter(
  coordinates: Array<[number, number]>
): { lat: number; lng: number } {
  const lngs = coordinates.map(c => c[0]);
  const lats = coordinates.map(c => c[1]);
  
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
}

/**
 * Calculate bounding box from coordinates array
 */
export function calculateBounds(
  coordinates: Array<[number, number]>
): [[number, number], [number, number]] {
  const lngs = coordinates.map(c => c[0]);
  const lats = coordinates.map(c => c[1]);
  
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/**
 * Calculate optimal zoom level for bounds
 */
export function calculateZoom(
  bounds: [[number, number], [number, number]],
  containerWidth: number,
  containerHeight: number
): number {
  const [sw, ne] = bounds;
  const latDiff = ne[1] - sw[1];
  const lngDiff = ne[0] - sw[0];
  
  const latZoom = Math.log2(360 / latDiff);
  const lngZoom = Math.log2(360 / lngDiff);
  
  return Math.min(latZoom, lngZoom, MAP_CONFIG.MAX_ZOOM);
}



