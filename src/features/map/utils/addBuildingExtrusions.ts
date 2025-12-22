import type { MapboxMapInstance } from '@/types/mapbox-events';

export interface BuildingExtrusionOptions {
  /** Opacity (0-1). Default: 0.6 */
  opacity?: number;
  /** Color: hex string or gradient array. Default: height-based grayscale */
  color?: string | Array<number | string>;
  /** Minimum zoom to show buildings. Default: 14 */
  minzoom?: number;
  /** Use height-based color gradient. Default: true */
  useHeightGradient?: boolean;
  /** Cast shadows. Default: false (shadows disabled) */
  castShadows?: boolean;
}

/**
 * Adds 3D building extrusions using Mapbox's native building data
 * Data source: 'composite' source with 'building' source-layer (built into Mapbox styles)
 */
export function addBuildingExtrusions(
  map: MapboxMapInstance,
  options: BuildingExtrusionOptions = {}
): void {
  const mapboxMap = map as any;

  if (mapboxMap.getLayer('3d-buildings')) return;

  if (!mapboxMap.isStyleLoaded()) {
    mapboxMap.once('style.load', () => addLayer(mapboxMap, options));
    return;
  }

  addLayer(mapboxMap, options);
}

function addLayer(mapboxMap: any, options: BuildingExtrusionOptions = {}): void {
  const {
    opacity = 0.6,
    color,
    minzoom = 14,
    useHeightGradient = true,
    castShadows = false,
  } = options;

  try {
    const style = mapboxMap.getStyle();
    const layers = style?.layers || [];
    
    let beforeId: string | undefined;
    for (const layer of layers) {
      if (layer.id?.toLowerCase().includes('building') || layer['source-layer'] === 'building') {
        beforeId = layer.id;
        break;
      }
    }
    if (!beforeId) {
      for (const layer of layers) {
        if (layer.id?.toLowerCase().includes('label') || layer.id?.toLowerCase().includes('water')) {
          beforeId = layer.id;
          break;
        }
      }
    }
    
    const fillColor = color 
      ? (typeof color === 'string' ? color : color)
      : useHeightGradient
      ? ['interpolate', ['linear'], ['get', 'height'], 0, '#aaa', 50, '#888', 100, '#666', 200, '#444']
      : '#888';

    mapboxMap.addLayer({
      id: '3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom,
      paint: {
        'fill-extrusion-color': fillColor,
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], minzoom, 0, minzoom + 1, ['get', 'height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], minzoom, 0, minzoom + 1, ['get', 'min_height']],
        'fill-extrusion-opacity': opacity,
        'fill-extrusion-cast-shadows': castShadows,
      },
    }, beforeId);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[addBuildingExtrusions] Error:', error);
    }
  }
}

/**
 * Removes 3D building extrusions from a Mapbox map
 */
export function removeBuildingExtrusions(map: MapboxMapInstance): void {
  const mapboxMap = map as any;
  
  try {
    if (mapboxMap.getLayer('3d-buildings')) {
      mapboxMap.removeLayer('3d-buildings');
    }
  } catch (error) {
    // Layer might not exist, ignore
  }
}
