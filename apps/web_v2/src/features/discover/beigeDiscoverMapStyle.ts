/**
 * Own Discover / Place inline maps — warm beige basemap (matches `#f7f5f1`).
 */

import type { Map as MapboxMap } from 'mapbox-gl';

export const DISCOVER_MAP_BEIGE = '#f7f5f1';
export const DISCOVER_MAP_BEIGE_DEEP = '#ebe6dc';
export const DISCOVER_MAP_WATER = '#d4cfc4';
export const DISCOVER_MAP_ROAD = '#c4bdb0';
export const DISCOVER_MAP_LABEL = '#6a6358';
export const DISCOVER_MAP_LABEL_HALO = '#f7f5f1';
/** Territory stamp fill — lake blue on beige. */
export const DISCOVER_MAP_TERRITORY = '#2a6f8f';

export const DISCOVER_MAP_STYLE = 'mapbox://styles/mapbox/light-v11';

function trySetPaint(map: MapboxMap, id: string, prop: string, value: unknown) {
  if (!map.getLayer(id)) return;
  try {
    (map as MapboxMap).setPaintProperty(id, prop as never, value as never);
  } catch {
    /* style revision variance */
  }
}

/** Recolor light basemap land/water/roads to Own beige. */
export function applyBeigeDiscoverMapStyle(map: MapboxMap): void {
  if (!map.getStyle()) return;

  trySetPaint(map, 'background', 'background-color', DISCOVER_MAP_BEIGE);

  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = layer.id;
    const key = id.toLowerCase();

    if (layer.type === 'background') {
      trySetPaint(map, id, 'background-color', DISCOVER_MAP_BEIGE);
      continue;
    }

    if (layer.type === 'fill') {
      if (/water|ocean|river|lake/.test(key)) {
        trySetPaint(map, id, 'fill-color', DISCOVER_MAP_WATER);
        trySetPaint(map, id, 'fill-opacity', 1);
      } else if (/land|park|grass|sand|hillshade|landuse|landcover|national-park/.test(key)) {
        trySetPaint(map, id, 'fill-color', DISCOVER_MAP_BEIGE);
        trySetPaint(map, id, 'fill-opacity', 1);
      } else if (/building/.test(key)) {
        trySetPaint(map, id, 'fill-color', DISCOVER_MAP_BEIGE_DEEP);
        trySetPaint(map, id, 'fill-opacity', 0.55);
      }
      continue;
    }

    if (layer.type === 'line') {
      if (/road|street|path|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|track|service/.test(key)) {
        trySetPaint(map, id, 'line-color', DISCOVER_MAP_ROAD);
        trySetPaint(map, id, 'line-opacity', 0.85);
      } else if (/water/.test(key)) {
        trySetPaint(map, id, 'line-color', DISCOVER_MAP_WATER);
      } else if (/boundary|admin|border/.test(key)) {
        trySetPaint(map, id, 'line-color', DISCOVER_MAP_ROAD);
        trySetPaint(map, id, 'line-opacity', 0.35);
      }
      continue;
    }

    if (layer.type === 'symbol') {
      trySetPaint(map, id, 'text-color', DISCOVER_MAP_LABEL);
      trySetPaint(map, id, 'text-halo-color', DISCOVER_MAP_LABEL_HALO);
      trySetPaint(map, id, 'text-halo-width', 1.2);
      if (/icon/.test(key) || layer.layout?.['icon-image']) {
        trySetPaint(map, id, 'icon-opacity', 0.35);
      }
    }
  }
}
