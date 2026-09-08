import type { Map as MapboxMap } from 'mapbox-gl';
import { safeGetSource } from '@/map/engine/mapStyleGuard';

/**
 * Paint-only selection via setFeatureState — avoids re-ingesting GeoJSON on click.
 * Distilled from v1 boundary selection patterns.
 */
export function setFeatureSelected(
  map: MapboxMap,
  sourceId: string,
  featureId: string | number | null,
  selectedId: string | number | null,
): void {
  if (!safeGetSource(map, sourceId)) return;

  if (selectedId != null) {
    try {
      map.setFeatureState({ source: sourceId, id: selectedId }, { selected: false });
    } catch {
      /* feature may not exist yet */
    }
  }

  if (featureId != null) {
    try {
      map.setFeatureState({ source: sourceId, id: featureId }, { selected: true });
    } catch {
      /* ignore */
    }
  }
}

export function clearFeatureState(
  map: MapboxMap,
  sourceId: string,
  featureId: string | number,
): void {
  if (!safeGetSource(map, sourceId)) return;
  try {
    map.removeFeatureState({ source: sourceId, id: featureId });
  } catch {
    /* ignore */
  }
}
