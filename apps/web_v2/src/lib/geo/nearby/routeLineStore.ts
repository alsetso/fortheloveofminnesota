import type { FeatureCollection, LineString, MultiLineString } from 'geojson';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function setRouteGeometry(
  geometry: LineString | MultiLineString,
): void {
  mapDataStore.set(MAP_SOURCE_IDS.route, {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry,
      },
    ],
  });
}

export function clearRouteGeometry(): void {
  mapDataStore.set(MAP_SOURCE_IDS.route, EMPTY);
}
