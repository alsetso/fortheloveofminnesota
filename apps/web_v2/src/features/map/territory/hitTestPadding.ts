import type { Map as MapboxMap, MapboxGeoJSONFeature, PointLike } from 'mapbox-gl';

/** Apple HIG minimum comfortable tap target radius, in px (~44px diameter). */
const MIN_TOUCH_PADDING_PX = 22;

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return y0 + t * (y1 - y0);
}

/**
 * Zoom-scaled touch padding for hitTest queries.
 * Mirrors community-pin hit paint curve (5→12, 12→16, 16→22), floored for fingers.
 */
export function getHitTestPaddingPx(zoom: number): number {
  let paintRadius: number;
  if (zoom <= 12) {
    paintRadius = lerp(zoom, 5, 12, 5, 12);
  } else if (zoom <= 16) {
    paintRadius = lerp(zoom, 12, 16, 12, 16);
  } else {
    paintRadius = lerp(zoom, 16, 22, 16, 22);
  }
  return Math.max(paintRadius, MIN_TOUCH_PADDING_PX);
}

export function pointXY(point: PointLike): { x: number; y: number } {
  if (Array.isArray(point)) return { x: point[0], y: point[1] };
  return { x: point.x, y: point.y };
}

/** Screen-space distance from tap to a Point feature; polygons → Infinity. */
export function screenDistance(
  map: MapboxMap,
  feature: MapboxGeoJSONFeature,
  point: PointLike,
): number {
  const geom = feature.geometry;
  if (!geom || geom.type !== 'Point') return Number.POSITIVE_INFINITY;
  const coords = geom.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return Number.POSITIVE_INFINITY;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return Number.POSITIVE_INFINITY;
  const px = map.project([lng, lat]);
  const { x, y } = pointXY(point);
  return Math.hypot(px.x - x, px.y - y);
}

/** Closest Point feature wins when a padded query returns several. */
export function rankFeaturesByScreenDistance(
  map: MapboxMap,
  features: MapboxGeoJSONFeature[],
  point: PointLike,
): MapboxGeoJSONFeature[] {
  return [...features].sort(
    (a, b) => screenDistance(map, a, point) - screenDistance(map, b, point),
  );
}
