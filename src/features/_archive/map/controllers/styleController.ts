import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '../config';

/**
 * Change map style while preserving center and zoom
 */
export async function changeMapStyle(
  map: MapboxMap,
  styleKey: keyof typeof MAP_CONFIG.STRATEGIC_STYLES
): Promise<void> {
  if (!map || map.removed) {
    throw new Error('Map not initialized');
  }

  const styleUrl = MAP_CONFIG.STRATEGIC_STYLES[styleKey];
  if (!styleUrl) {
    throw new Error(`Invalid style key: ${styleKey}`);
  }

  // Preserve current state
  const currentCenter = map.getCenter();
  const currentZoom = map.getZoom();

  return new Promise((resolve, reject) => {
    try {
      // Set new style
      map.setStyle(styleUrl);

      // Wait for style to load
      map.once('styledata', () => {
        if (map && !map.removed) {
          // Restore center and zoom
          map.setCenter(currentCenter);
          map.setZoom(currentZoom);
          resolve();
        }
      });

      // Handle errors
      map.once('error', (e) => {
        reject(
          new Error(`Failed to load style: ${e.error?.message || 'Unknown error'}`)
        );
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get available map styles
 */
export function getAvailableStyles(): Array<{
  key: keyof typeof MAP_CONFIG.STRATEGIC_STYLES;
  url: string;
}> {
  return Object.entries(MAP_CONFIG.STRATEGIC_STYLES).map(([key, url]) => ({
    key: key as keyof typeof MAP_CONFIG.STRATEGIC_STYLES,
    url,
  }));
}

/**
 * Preserve map state during style change
 */
export function preserveMapState(map: MapboxMap): {
  center: { lat: number; lng: number };
  zoom: number;
  bearing: number;
  pitch: number;
} {
  const center = map.getCenter();
  return {
    center: { lat: center.lat, lng: center.lng },
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

/**
 * Restore map state after style change
 */
export function restoreMapState(
  map: MapboxMap,
  state: {
    center: { lat: number; lng: number };
    zoom: number;
    bearing?: number;
    pitch?: number;
  }
): void {
  if (!map || map.removed) return;

  map.setCenter([state.center.lng, state.center.lat]);
  map.setZoom(state.zoom);
  if (state.bearing !== undefined) {
    map.setBearing(state.bearing);
  }
  if (state.pitch !== undefined) {
    map.setPitch(state.pitch);
  }
}



