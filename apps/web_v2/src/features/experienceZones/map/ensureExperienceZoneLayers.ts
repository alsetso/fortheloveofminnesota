/**
 * Mapbox fill + line for the active experience zone boundary.
 * Violet to match ExperienceZoneBanner; Standard `top` slot so the outline
 * stays visible above basemap ground (models still read clearly on top).
 */

import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';

export const EXPERIENCE_ZONE_SOURCE_ID = 'ftlomn-experience-zone';
/** v3 — remount after v2 style-race “layer does not exist” on setPaintProperty. */
export const EXPERIENCE_ZONE_FILL_LAYER_ID = 'ftlomn-experience-zone-fill-v3';
export const EXPERIENCE_ZONE_LINE_LAYER_ID = 'ftlomn-experience-zone-line-v3';
const LEGACY_ZONE_LAYER_IDS = [
  'ftlomn-experience-zone-fill',
  'ftlomn-experience-zone-line',
  'ftlomn-experience-zone-fill-v2',
  'ftlomn-experience-zone-line-v2',
] as const;

export type ExperienceZoneBoundaryProps = {
  id: string;
  slug: string;
  name: string;
};

export type ExperienceZoneBoundaryFeature = Feature<
  Polygon | MultiPolygon,
  ExperienceZoneBoundaryProps
>;

const EMPTY: FeatureCollection<Polygon | MultiPolygon, ExperienceZoneBoundaryProps> = {
  type: 'FeatureCollection',
  features: [],
};

function slotProps(map: MapboxMap) {
  return mapUsesMapboxStandard(map) ? { slot: 'top' as const } : {};
}

export function ensureExperienceZoneLayers(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;

  if (!safeGetSource(map, EXPERIENCE_ZONE_SOURCE_ID)) {
    try {
      map.addSource(EXPERIENCE_ZONE_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY,
        promoteId: 'id',
      });
    } catch {
      /* style race */
      return;
    }
  }

  const sp = slotProps(map);

  for (const id of LEGACY_ZONE_LAYER_IDS) {
    if (safeGetLayer(map, id)) {
      try {
        map.removeLayer(id);
      } catch {
        /* raced */
      }
    }
  }

  if (!safeGetLayer(map, EXPERIENCE_ZONE_FILL_LAYER_ID)) {
    try {
      map.addLayer({
        id: EXPERIENCE_ZONE_FILL_LAYER_ID,
        type: 'fill',
        source: EXPERIENCE_ZONE_SOURCE_ID,
        paint: {
          'fill-color': '#8B5CF6',
          'fill-opacity': 0.22,
          'fill-antialias': true,
        },
        ...sp,
      });
    } catch {
      /* raced */
    }
  }

  if (!safeGetLayer(map, EXPERIENCE_ZONE_LINE_LAYER_ID)) {
    try {
      map.addLayer({
        id: EXPERIENCE_ZONE_LINE_LAYER_ID,
        type: 'line',
        source: EXPERIENCE_ZONE_SOURCE_ID,
        paint: {
          'line-color': '#A78BFA',   // violet-400 — matches radar minimap
          'line-width': 2.25,
          'line-opacity': 0.95,
        },
        ...sp,
      });
    } catch {
      /* raced */
    }
  }
}

export function syncExperienceZoneBoundaryData(
  map: MapboxMap,
  features: ExperienceZoneBoundaryFeature[],
): void {
  ensureExperienceZoneLayers(map);
  const fc: FeatureCollection<Polygon | MultiPolygon, ExperienceZoneBoundaryProps> = {
    type: 'FeatureCollection',
    features,
  };
  try {
    const src = map.getSource(EXPERIENCE_ZONE_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(fc);
  } catch {
    /* style race */
  }
}

export function clearExperienceZoneBoundary(map: MapboxMap): void {
  syncExperienceZoneBoundaryData(map, []);
}

/** Purple fill is for approach / presence preview — hide once Explore Zone starts. */
export function setExperienceZoneFillVisible(
  map: MapboxMap,
  visible: boolean,
): void {
  ensureExperienceZoneLayers(map);
  if (!safeGetLayer(map, EXPERIENCE_ZONE_FILL_LAYER_ID)) return;
  try {
    map.setPaintProperty(
      EXPERIENCE_ZONE_FILL_LAYER_ID,
      'fill-opacity',
      visible ? 0.22 : 0,
    );
  } catch {
    /* style race */
  }
}

export function removeExperienceZoneLayers(map: MapboxMap): void {
  for (const id of [EXPERIENCE_ZONE_LINE_LAYER_ID, EXPERIENCE_ZONE_FILL_LAYER_ID]) {
    try {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    } catch {
      /* ignore */
    }
  }
  try {
    if (safeGetSource(map, EXPERIENCE_ZONE_SOURCE_ID)) {
      map.removeSource(EXPERIENCE_ZONE_SOURCE_ID);
    }
  } catch {
    /* ignore */
  }
}
