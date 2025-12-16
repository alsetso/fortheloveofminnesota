import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '../config';
import { validateMapConfig } from '../utils/mapValidation';
import { loadMapboxGL } from '../utils/mapboxLoader';

export interface InitializeMapOptions {
  container: HTMLElement;
  onLoad?: (map: MapboxMap) => void;
}

export interface MapInitializationResult {
  map: MapboxMap;
  cleanup: () => void;
}

/**
 * Initialize Mapbox map instance
 */
export async function initializeMap(
  options: InitializeMapOptions
): Promise<MapboxMap> {
  const { container, onLoad } = options;

  // Validate config
  const configValidation = validateMapConfig();
  if (!configValidation.valid) {
    throw new Error(configValidation.error || 'Map configuration invalid');
  }

  // Load Mapbox GL
  const mapbox = await loadMapboxGL();
  mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;

  // Ensure container has dimensions before creating map
  // Wait for container to have proper dimensions
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    // Wait for next frame to ensure container is sized
    await new Promise(resolve => {
      const checkDimensions = () => {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          resolve(undefined);
        } else {
          requestAnimationFrame(checkDimensions);
        }
      };
      requestAnimationFrame(checkDimensions);
    });
  }

  // Create map instance
  const map = new mapbox.Map({
    container,
    style: MAP_CONFIG.MAPBOX_STYLE,
    center: MAP_CONFIG.DEFAULT_CENTER,
    zoom: MAP_CONFIG.DEFAULT_ZOOM,
    maxZoom: MAP_CONFIG.MAX_ZOOM,
    maxBounds: [
      [MAP_CONFIG.MINNESOTA_BOUNDS.west, MAP_CONFIG.MINNESOTA_BOUNDS.south],
      [MAP_CONFIG.MINNESOTA_BOUNDS.east, MAP_CONFIG.MINNESOTA_BOUNDS.north],
    ],
  });

  // Prevent multiple load handlers
  let loadHandlerCalled = false;
  map.on('load', () => {
    if (loadHandlerCalled) return;
    loadHandlerCalled = true;

    // Resize map to ensure proper centering and sizing
    map.resize();

    // Call onLoad callback
    onLoad?.(map);
  });

  // Handle container resize after initial load
  if (container.offsetWidth === 0 || container.offsetHeight === 0) {
    setTimeout(() => {
      if (map && !map.removed) {
        map.resize();
      }
    }, 100);
  }

  return map;
}

/**
 * Destroy map instance and cleanup
 */
export function destroyMap(map: MapboxMap | null): void {
  if (!map) return;
  
  try {
    if (!map.removed) {
      map.remove();
    }
  } catch (error) {
    console.error('Error destroying map:', error);
  }
}

/**
 * Resize map instance
 */
export function resizeMap(map: MapboxMap | null): void {
  if (!map || map.removed) return;
  
  try {
    map.resize();
  } catch (error) {
    console.error('Error resizing map:', error);
  }
}


