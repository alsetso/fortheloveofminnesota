import type { Map as MapboxMap } from 'mapbox-gl';

export type BuildingExtrusionOptions = {
  /** Opacity (0–1). Default: 0.78 */
  opacity?: number;
  /** Minimum zoom to show buildings. Default: 13 */
  minzoom?: number;
  /** Cast shadows. Default: true */
  castShadows?: boolean;
};

const LAYER_ID = '3d-buildings';

/**
 * Classic Mapbox styles (outdoors / streets-v12 / light / dark) expose buildings via
 * the `composite` → `building` source-layer. Mapbox Standard does not — skip there.
 */
export function addBuildingExtrusions(
  map: MapboxMap,
  options: BuildingExtrusionOptions = {},
): void {
  if (!map.isStyleLoaded()) {
    map.once('style.load', () => addBuildingExtrusions(map, options));
    return;
  }
  addLayer(map, options);
}

export function removeBuildingExtrusions(map: MapboxMap): void {
  try {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  } catch {
    /* layer gone with style */
  }
}

function addLayer(map: MapboxMap, options: BuildingExtrusionOptions): void {
  const { opacity = 0.78, minzoom = 13, castShadows = true } = options;

  try {
    if (map.getLayer(LAYER_ID)) return;
    if (!map.getSource('composite')) return;

    const layers = map.getStyle()?.layers ?? [];
    let beforeId: string | undefined;
    for (const layer of layers) {
      if (
        layer.id.toLowerCase().includes('building') ||
        ('source-layer' in layer && layer['source-layer'] === 'building')
      ) {
        beforeId = layer.id;
        break;
      }
    }
    if (!beforeId) {
      for (const layer of layers) {
        const id = layer.id.toLowerCase();
        if (id.includes('label') || id.includes('place') || id.includes('poi')) {
          beforeId = layer.id;
          break;
        }
      }
    }

    map.addLayer(
      {
        id: LAYER_ID,
        source: 'composite',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom,
        filter: ['==', ['get', 'extrude'], 'true'],
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'height'],
            0,
            '#c9b9a0',
            40,
            '#a89478',
            90,
            '#86735a',
            180,
            '#655440',
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            minzoom,
            0,
            minzoom + 1,
            ['coalesce', ['get', 'height'], 8],
          ],
          'fill-extrusion-base': [
            'interpolate',
            ['linear'],
            ['zoom'],
            minzoom,
            0,
            minzoom + 1,
            ['coalesce', ['get', 'min_height'], 0],
          ],
          'fill-extrusion-opacity': opacity,
          'fill-extrusion-cast-shadows': castShadows,
        },
      },
      beforeId,
    );
  } catch (err) {
    console.warn('[addBuildingExtrusions]', err);
  }
}
