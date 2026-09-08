/**
 * Object Radar service — push basemap darker; punch roads + labels.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import {
  OBJECT_RADAR_LAND_COLOR,
  OBJECT_RADAR_ROAD_COLOR,
  OBJECT_RADAR_WATER_COLOR,
} from '@/features/map/game/objectRadar/constants';

function trySetPaint(map: MapboxMap, id: string, prop: string, value: unknown) {
  if (!map.getLayer(id)) return;
  try {
    // Style layer paint keys vary by basemap revision.
    (map as MapboxMap).setPaintProperty(id, prop as never, value as never);
  } catch {
    // style revision variance
  }
}

export function darkenObjectRadarStyle(map: MapboxMap): void {
  if (!map.getStyle()) return;

  trySetPaint(map, 'background', 'background-color', OBJECT_RADAR_LAND_COLOR);

  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = layer.id;
    const key = id.toLowerCase();

    if (layer.type === 'background') {
      trySetPaint(map, id, 'background-color', OBJECT_RADAR_LAND_COLOR);
      continue;
    }

    if (layer.type === 'fill') {
      if (/water|ocean|river|lake/.test(key)) {
        trySetPaint(map, id, 'fill-color', OBJECT_RADAR_WATER_COLOR);
        trySetPaint(map, id, 'fill-opacity', 1);
      } else if (/land|park|grass|sand|hillshade|landuse|landcover/.test(key)) {
        trySetPaint(map, id, 'fill-color', OBJECT_RADAR_LAND_COLOR);
        trySetPaint(map, id, 'fill-opacity', 1);
      }
      continue;
    }

    if (layer.type === 'line') {
      if (/road|street|path|bridge|tunnel|motorway|trunk|primary|secondary|tertiary|track|service/.test(key)) {
        trySetPaint(map, id, 'line-color', OBJECT_RADAR_ROAD_COLOR);
        trySetPaint(map, id, 'line-opacity', 1);
        const width = map.getPaintProperty(id, 'line-width');
        if (typeof width === 'number') {
          trySetPaint(map, id, 'line-width', Math.max(width * 1.35, 1.6));
        }
      } else if (/water/.test(key)) {
        trySetPaint(map, id, 'line-color', OBJECT_RADAR_WATER_COLOR);
      }
      continue;
    }

    if (layer.type === 'symbol') {
      if (/road|street|highway|shield|number/.test(key)) {
        trySetPaint(map, id, 'text-color', '#c8c8d0');
        trySetPaint(map, id, 'text-halo-color', '#050608');
        trySetPaint(map, id, 'text-halo-width', 1.25);
      }
    }
  }
}
