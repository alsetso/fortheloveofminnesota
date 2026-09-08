/**
 * Hit test the camera-facing placement plane (hover / click target).
 *
 * Uses a padded bounding-box query (collect radius) so items that appear
 * small or distant are still tappable — just like real-world proximity logic.
 */

import type { Map as MapboxMap, MapboxGeoJSONFeature, PointLike } from 'mapbox-gl';
import {
  isMapStyleReady,
  safeGetLayer,
} from '@/map/engine/mapStyleGuard';
import {
  WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID,
  WORLD_PLACEMENTS_SOURCE_ID,
} from '@/features/map/game/world/catalog';
import {
  pointXY,
  rankFeaturesByScreenDistance,
} from '@/features/map/territory/hitTestPadding';

/**
 * Tap collect radius in screen pixels.
 * Large enough that a model in the distance is still an easy tap target.
 * Apple HIG comfortable touch = 44px; we expand a bit for depth-pitched maps.
 */
export const WORLD_PLACEMENT_COLLECT_RADIUS_PX = 52;

export type WorldPlacementHit = {
  featureId: string | number;
  feature: MapboxGeoJSONFeature;
};

export function queryWorldPlacementAtPoint(
  map: MapboxMap,
  point: PointLike,
): WorldPlacementHit | null {
  if (
    !isMapStyleReady(map) ||
    !safeGetLayer(map, WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID)
  ) {
    return null;
  }
  try {
    const { x, y } = pointXY(point);
    const r = WORLD_PLACEMENT_COLLECT_RADIUS_PX;
    // Padded bbox: picks up placements whose billboard overlaps anywhere in the radius.
    const bbox: [PointLike, PointLike] = [
      [x - r, y - r],
      [x + r, y + r],
    ];
    const hits = map.queryRenderedFeatures(bbox, {
      layers: [WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID],
    });
    if (!hits.length) return null;
    // Among candidates return the one whose anchor is closest to the tap.
    const ranked = rankFeaturesByScreenDistance(map, hits, point);
    const feature = ranked[0];
    if (!feature) return null;
    const featureId = feature.id ?? feature.properties?.id;
    if (featureId == null) return null;
    return { featureId, feature };
  } catch {
    return null;
  }
}

export function setWorldPlacementFeatureState(
  map: MapboxMap,
  featureId: string | number,
  state: { hover?: boolean; active?: boolean },
): void {
  if (!isMapStyleReady(map)) return;
  try {
    map.setFeatureState(
      { source: WORLD_PLACEMENTS_SOURCE_ID, id: featureId },
      state,
    );
  } catch {
    /* ignore */
  }
}

export function clearWorldPlacementFeatureState(
  map: MapboxMap,
  featureId: string | number | null,
): void {
  if (featureId == null || !isMapStyleReady(map)) return;
  try {
    map.removeFeatureState({
      source: WORLD_PLACEMENTS_SOURCE_ID,
      id: featureId,
    });
  } catch {
    /* ignore */
  }
}
