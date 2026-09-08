/**
 * Object Radar layers — Range ring + player puck (Object Map only).
 */

import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { OBJECT_RADAR_DEFAULT_RANGE_M } from '@/features/map/game/objectRadar/constants';
import type { ObjectRadarOrigin } from '@/features/map/game/objectRadar/types';

export const OBJECT_RADAR_PLAYER_SOURCE = 'object-radar-player';
export const OBJECT_RADAR_RANGE_SOURCE = 'object-radar-range';

const RANGE_FILL = 'object-radar-range-fill';
const RANGE_LINE = 'object-radar-range-line';
const PLAYER_DOT = 'object-radar-player-dot';
const PLAYER_ARROW = 'object-radar-player-arrow';

function circlePolygon(
  lng: number,
  lat: number,
  rangeM: number,
  steps = 64,
): Feature<Polygon> {
  const coords: [number, number][] = [];
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const dLng = (rangeM * Math.cos(angle)) / (111_320 * Math.max(0.2, cosLat));
    const dLat = (rangeM * Math.sin(angle)) / 110_540;
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

function ensureArrowImage(map: MapboxMap) {
  if (map.hasImage('object-radar-heading-arrow')) return;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(14, 18);
  ctx.lineTo(0, 10);
  ctx.lineTo(-14, 18);
  ctx.closePath();
  ctx.fillStyle = '#5BA3FF';
  ctx.strokeStyle = '#050608';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  map.addImage('object-radar-heading-arrow', ctx.getImageData(0, 0, size, size), {
    pixelRatio: 2,
  });
}

function setVisible(map: MapboxMap, id: string, visible: boolean) {
  if (!map.getLayer(id)) return;
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export type ObjectRadarPlayerLayerOpts = {
  showRangeRing?: boolean;
  showPlayerMarker?: boolean;
};

export function syncObjectRadarPlayerLayers(
  map: MapboxMap,
  origin: ObjectRadarOrigin | null,
  rangeM: number = OBJECT_RADAR_DEFAULT_RANGE_M,
  opts: ObjectRadarPlayerLayerOpts = {},
): void {
  if (!map.getStyle()) return;

  const showRangeRing = opts.showRangeRing === true;
  const showPlayerMarker = opts.showPlayerMarker === true;
  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };

  if (!origin) {
    (map.getSource(OBJECT_RADAR_RANGE_SOURCE) as GeoJSONSource | undefined)?.setData(empty);
    (map.getSource(OBJECT_RADAR_PLAYER_SOURCE) as GeoJSONSource | undefined)?.setData(empty);
    return;
  }

  if (showPlayerMarker) ensureArrowImage(map);

  const rangeFc: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: showRangeRing
      ? [circlePolygon(origin.lng, origin.lat, rangeM)]
      : [],
  };
  const pointFc: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: showPlayerMarker
      ? [
          {
            type: 'Feature',
            properties: { bearing: origin.bearing },
            geometry: {
              type: 'Point',
              coordinates: [origin.lng, origin.lat],
            },
          },
        ]
      : [],
  };

  const rangeSrc = map.getSource(OBJECT_RADAR_RANGE_SOURCE) as GeoJSONSource | undefined;
  const pointSrc = map.getSource(OBJECT_RADAR_PLAYER_SOURCE) as GeoJSONSource | undefined;

  if (!rangeSrc) {
    map.addSource(OBJECT_RADAR_RANGE_SOURCE, { type: 'geojson', data: rangeFc });
    map.addLayer({
      id: RANGE_FILL,
      type: 'fill',
      source: OBJECT_RADAR_RANGE_SOURCE,
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#5BA3FF', 'fill-opacity': 0 },
    });
    map.addLayer({
      id: RANGE_LINE,
      type: 'line',
      source: OBJECT_RADAR_RANGE_SOURCE,
      layout: { visibility: showRangeRing ? 'visible' : 'none' },
      paint: {
        'line-color': '#5BA3FF',
        'line-opacity': 0.75,
        'line-width': 1.75,
        'line-dasharray': [1.6, 1.4],
      },
    });
  } else {
    rangeSrc.setData(rangeFc);
    setVisible(map, RANGE_FILL, false);
    setVisible(map, RANGE_LINE, showRangeRing);
  }

  if (!pointSrc) {
    map.addSource(OBJECT_RADAR_PLAYER_SOURCE, { type: 'geojson', data: pointFc });
    map.addLayer({
      id: PLAYER_DOT,
      type: 'circle',
      source: OBJECT_RADAR_PLAYER_SOURCE,
      layout: { visibility: showPlayerMarker ? 'visible' : 'none' },
      paint: {
        'circle-radius': 5.5,
        'circle-color': '#5BA3FF',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#050608',
      },
    });
    map.addLayer({
      id: PLAYER_ARROW,
      type: 'symbol',
      source: OBJECT_RADAR_PLAYER_SOURCE,
      layout: {
        visibility: showPlayerMarker ? 'visible' : 'none',
        'icon-image': 'object-radar-heading-arrow',
        'icon-size': 0.55,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  } else {
    pointSrc.setData(pointFc);
    setVisible(map, PLAYER_DOT, showPlayerMarker);
    setVisible(map, PLAYER_ARROW, showPlayerMarker);
  }
}
