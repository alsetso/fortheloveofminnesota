/**
 * Mapbox Streets v8, mounted in our own root style so the basemap's metadata
 * stays reachable from a tap.
 *
 * Mapbox Standard ships the basemap as a style *import*, and a query only
 * inspects root-style layers plus the *featuresets* an import publishes — never
 * the import's own layers. Standard publishes featuresets for POIs, place
 * labels and buildings, and nothing for roads, water or landuse. So the only
 * way to read a road class or a lake name is to mount the tileset ourselves.
 *
 * The layers here draw nothing. Mapbox excludes only `visibility: "none"` and
 * out-of-zoom-range layers from a query, so alpha-0 paint stays hittable while
 * staying invisible. Line width and circle radius are the finger tolerance —
 * a road centerline is one pixel wide and unhittable without it.
 *
 * Classic styles (outdoors, streets) already carry this tileset as `composite`,
 * so we bind to that when it exists rather than paying for the same tiles
 * twice. Mounting our own source does cost tile requests, which is why this is
 * installed per-surface by the feature that needs it, not globally.
 *
 * Schema: https://docs.mapbox.com/data/tilesets/reference/mapbox-streets-v8/
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
} from '@/map/engine/mapStyleGuard';

const OWN_SOURCE_ID = 'ftlomn-streets-meta';
const OWN_SOURCE_URL = 'mapbox://mapbox.mapbox-streets-v8';
const LAYER_PREFIX = 'ftlomn-streets-meta-';

/** Bundled tileset on classic styles — same v8 source-layers, already paid for. */
const COMPOSITE_SOURCE_ID = 'composite';

/** Fingertip tolerance for line and point hit tests, in screen pixels. */
const HIT_PX = 14;

/**
 * Reach for `natural_label`, which labels a whole lake from a single point that
 * can sit a long way from where you tapped. Being generous here is safe because
 * a name from this layer is only trusted when the tap also landed inside a
 * `water` polygon — see describeMapMeta.
 */
const LABEL_SEEK_PX = 64;

/** The v8 source-layers we read at a point. */
export type StreetsMetaSourceLayer =
  | 'road'
  | 'waterway'
  | 'water'
  | 'landuse'
  | 'landuse_overlay'
  | 'building'
  | 'natural_label'
  | 'poi_label';

/**
 * A query layer only sees the geometry its own type renders: `fill` finds
 * polygons, `line` finds lines, `circle` finds points. The type here is chosen
 * per source-layer to match the geometry that carries the metadata we want.
 *
 * `road` also holds junction *points* and `natural_label` also holds lines;
 * both are ignored on purpose — the line and point halves are what label a
 * place.
 */
const QUERY_SPECS: ReadonlyArray<{
  sourceLayer: StreetsMetaSourceLayer;
  type: 'fill' | 'line' | 'circle';
  /** Hit size in screen pixels. Ignored for fills, which are point-in-polygon. */
  hitPx?: number;
}> = [
  { sourceLayer: 'road', type: 'line' },
  { sourceLayer: 'waterway', type: 'line' },
  { sourceLayer: 'water', type: 'fill' },
  { sourceLayer: 'landuse', type: 'fill' },
  { sourceLayer: 'landuse_overlay', type: 'fill' },
  { sourceLayer: 'building', type: 'fill' },
  { sourceLayer: 'natural_label', type: 'circle', hitPx: LABEL_SEEK_PX },
  { sourceLayer: 'poi_label', type: 'circle' },
];

export function streetsMetaLayerId(sourceLayer: StreetsMetaSourceLayer): string {
  return `${LAYER_PREFIX}${sourceLayer}`;
}

/** Reverse of {@link streetsMetaLayerId} — null for any layer that isn't ours. */
export function streetsMetaSourceLayerOf(
  layerId: string | null | undefined,
): StreetsMetaSourceLayer | null {
  if (!layerId?.startsWith(LAYER_PREFIX)) return null;
  const sourceLayer = layerId.slice(LAYER_PREFIX.length) as StreetsMetaSourceLayer;
  return QUERY_SPECS.some((s) => s.sourceLayer === sourceLayer) ? sourceLayer : null;
}

function isAlreadyExistsError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /already exists/i.test(message);
}

/** Paint that renders nothing but still answers a hit test. */
function hitPaint(
  type: 'fill' | 'line' | 'circle',
  hitPx = HIT_PX,
): Record<string, unknown> {
  if (type === 'line') return { 'line-opacity': 0, 'line-width': hitPx };
  if (type === 'circle') return { 'circle-opacity': 0, 'circle-radius': hitPx };
  return { 'fill-opacity': 0 };
}

/**
 * Bind to the style's bundled tileset when it has one, else mount our own.
 * Returns null when neither is available yet.
 */
function ensureMetaSource(map: MapboxMap): string | null {
  if (safeGetSource(map, COMPOSITE_SOURCE_ID)) return COMPOSITE_SOURCE_ID;
  if (safeGetSource(map, OWN_SOURCE_ID)) return OWN_SOURCE_ID;

  try {
    map.addSource(OWN_SOURCE_ID, { type: 'vector', url: OWN_SOURCE_URL });
    return OWN_SOURCE_ID;
  } catch (err) {
    if (isAlreadyExistsError(err)) return OWN_SOURCE_ID;
    if (process.env.NODE_ENV === 'development') {
      console.warn('[streetsMeta] source', err);
    }
    return null;
  }
}

/**
 * Idempotent — safe to call on every `style.load` and `idle`. A style swap
 * wipes our layers along with everything else, so callers re-run rather than
 * tracking what survived.
 */
export function ensureStreetsMetaQueryLayers(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;

  const source = ensureMetaSource(map);
  if (!source) return;

  // Standard rejects unslotted custom layers in some stacking positions; the
  // bottom slot keeps these below every painted layer, where invisible
  // geometry belongs.
  const slot = mapUsesMapboxStandard(map) ? { slot: 'bottom' as const } : {};

  for (const spec of QUERY_SPECS) {
    const id = streetsMetaLayerId(spec.sourceLayer);
    if (safeGetLayer(map, id)) continue;

    try {
      map.addLayer({
        id,
        type: spec.type,
        source,
        'source-layer': spec.sourceLayer,
        paint: hitPaint(spec.type, spec.hitPx),
        ...slot,
      } as never);
    } catch (err) {
      if (!isAlreadyExistsError(err) && process.env.NODE_ENV === 'development') {
        console.warn(`[streetsMeta] layer ${id}`, err);
      }
    }
  }
}

/**
 * The query layers that exist right now.
 *
 * Always pass this to `queryRenderedFeatures` rather than the full id list:
 * naming a layer the style doesn't have throws, and mid style-swap none of
 * them exist.
 */
export function streetsMetaQueryLayerIds(map: MapboxMap): string[] {
  if (!isMapStyleReady(map)) return [];
  return QUERY_SPECS.map((spec) => streetsMetaLayerId(spec.sourceLayer)).filter((id) =>
    Boolean(safeGetLayer(map, id)),
  );
}

export function removeStreetsMetaQueryLayers(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;

  for (const spec of QUERY_SPECS) {
    const id = streetsMetaLayerId(spec.sourceLayer);
    try {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    } catch {
      /* gone with the style */
    }
  }
  try {
    if (safeGetSource(map, OWN_SOURCE_ID)) map.removeSource(OWN_SOURCE_ID);
  } catch {
    /* still referenced, or gone with the style */
  }
}
