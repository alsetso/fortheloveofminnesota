/**
 * What the basemap knows about one screen point, from both places it hides.
 *
 * Lane 1 — `streets`: our own Mapbox Streets v8 query layers. Full v8 schema,
 * so this is where road `class`, waterway `class`, landuse `class` and building
 * `type` come from. See streetsMetaQuerySource.
 *
 * Lane 2 — `basemap`: the featuresets a Mapbox Standard import publishes. Named
 * POIs, place labels and building heights, with their own smaller property set
 * (`name`, `class`, `maki`, `group`, `height`).
 *
 * Both lanes are synchronous reads out of tiles already in memory, so this is
 * safe on a gesture. Neither is a network call.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import { isMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  streetsMetaQueryLayerIds,
  streetsMetaSourceLayerOf,
} from '@/map/meta/streetsMetaQuerySource';

export type MapMetaLane = 'streets' | 'basemap';

export type MapMetaFeature = {
  lane: MapMetaLane;
  /**
   * Streets v8 source-layer (`road`, `water`, `landuse`, …) on the `streets`
   * lane, or the Standard featureset id (`poi`, `buildings`, `place-labels`)
   * on the `basemap` lane.
   */
  set: string;
  id: string | number | null;
  geometryType: string;
  /** Every raw property, untouched — describeMapMeta decides what matters. */
  properties: Record<string, unknown>;
};

/** Mapbox Standard mounts itself under this import id. */
const BASEMAP_IMPORT_ID = 'basemap';

/** Documented Standard featuresets, used when runtime discovery isn't available. */
const KNOWN_BASEMAP_FEATURESETS = ['poi', 'place-labels', 'buildings'] as const;

type FeaturesetCapableMap = MapboxMap & {
  getFeaturesetDescriptors?: (
    importId?: string,
  ) => Array<{ featuresetId: string; importId?: string }>;
};

/**
 * Featuresets this style actually publishes.
 *
 * Discovery is experimental in GL JS, so it's opportunistic: when it answers we
 * use it, which means a Standard release that adds a featureset flows through
 * without a code change. Otherwise we ask for the three documented sets and let
 * the misses throw harmlessly.
 */
function basemapFeaturesetIds(map: MapboxMap): string[] {
  try {
    const described = (map as FeaturesetCapableMap).getFeaturesetDescriptors?.(
      BASEMAP_IMPORT_ID,
    );
    const ids = (described ?? [])
      .map((d) => d?.featuresetId)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) return ids;
  } catch {
    /* not supported in this build — fall through */
  }
  return [...KNOWN_BASEMAP_FEATURESETS];
}

function toProperties(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...(value as object) } : {};
}

/** Our Streets v8 hit layers — the only lane with the full v8 schema. */
function queryStreetsLane(
  map: MapboxMap,
  screenPoint: [number, number],
): MapMetaFeature[] {
  const layers = streetsMetaQueryLayerIds(map);
  if (layers.length === 0) return [];

  try {
    return map
      .queryRenderedFeatures(screenPoint, { layers })
      .flatMap((feature) => {
        const set =
          streetsMetaSourceLayerOf(feature.layer?.id) ?? feature.sourceLayer ?? null;
        if (!set) return [];
        return [
          {
            lane: 'streets' as const,
            set,
            id: feature.id ?? null,
            geometryType: feature.geometry?.type ?? 'Unknown',
            properties: toProperties(feature.properties),
          },
        ];
      });
  } catch {
    return [];
  }
}

/** Standard's published featuresets — named POIs, places, building heights. */
function queryBasemapLane(
  map: MapboxMap,
  screenPoint: [number, number],
): MapMetaFeature[] {
  const out: MapMetaFeature[] = [];

  for (const featuresetId of basemapFeaturesetIds(map)) {
    try {
      const hits = map.queryRenderedFeatures(screenPoint, {
        target: { featuresetId, importId: BASEMAP_IMPORT_ID },
      });
      for (const feature of hits) {
        out.push({
          lane: 'basemap',
          set: featuresetId,
          id: feature.id ?? null,
          geometryType: feature.geometry?.type ?? 'Unknown',
          properties: toProperties(feature.properties),
        });
      }
    } catch {
      // Featureset absent from this style (every classic style, and any
      // Standard version that hasn't published it) — nothing to read.
    }
  }

  return out;
}

/**
 * Everything the basemap can say about `screenPoint`, richest lane first.
 *
 * Returns an empty array rather than throwing: a callout with no meta is a
 * normal outcome (zoomed out past a layer's data, or a style with neither lane
 * available) and must never break the gesture that asked.
 */
export function queryMapMetaFeatures(
  map: MapboxMap,
  screenPoint: [number, number],
): MapMetaFeature[] {
  if (!isMapStyleReady(map)) return [];
  return [...queryStreetsLane(map, screenPoint), ...queryBasemapLane(map, screenPoint)];
}
