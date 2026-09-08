/**
 * Mapbox layers for world placements:
 * one GeoJSON source + one model layer per needed catalog slug +
 * ground pulse ring + camera-facing transparent hit plane + zoom-out LOD dots.
 * Source is always created before any layer that references it.
 */

import type { FeatureCollection, Point } from 'geojson';
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapboxMap,
} from 'mapbox-gl';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
} from '@/map/engine/mapStyleGuard';
import {
  WORLD_COLLECTIBLE_SPIN_PERIOD_MS,
  WORLD_LOD_CIRCLE_LAYER_ID,
  WORLD_LOD_3D_MIN_ZOOM,
  WORLD_PLACEMENT_HIT_BILLBOARD,
  WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_ID,
  WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_PX,
  WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID,
  WORLD_PLACEMENT_HIT_LAYER_ID,
  WORLD_PLACEMENT_PULSE,
  WORLD_PLACEMENTS_SOURCE_ID,
  worldModelLayerId,
  worldModelRuntimeId,
  type WorldModelSpec,
} from '@/features/map/game/world/catalog';
import {
  BLOCK_GRID_DEBUG_LAYER_ID,
  BLOCK_GRID_DEBUG_SOURCE_ID,
  buildBlockGridGeoJSON,
} from '@/features/map/game/world/worldGrid';
import { getWorldCatalog, getWorldModel } from '@/features/map/game/world/catalogStore';
import { resolveModelVerb } from '@/features/map/game/world/modelVerbs';
import {
  buildPulseFillExpression,
  buildPulseStrokeExpression,
} from '@/features/map/game/world/elementTypes';
import { getElementTypeColorMap } from '@/features/map/game/world/elementTypesStore';
import {
  getWorldPlacementsSnapshot,
  type WorldPlacementFeatureProps,
} from '@/features/map/game/world/placementsStore';

const EMPTY: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
};

let pulseRaf: number | null = null;
let pulseMap: MapboxMap | null = null;
let lastSpinApplied = -1;

/** Layers we successfully added — survives getLayer races during multi-ensure. */
const addedModelLayerIds = new WeakMap<MapboxMap, Set<string>>();
/** Ground pulse + billboard hit — same race as models; Mapbox logs before addLayer throws. */
const hitLayersAdded = new WeakMap<MapboxMap, boolean>();
let ensureInFlight = false;
let ensureQueued: { map: MapboxMap; data: FeatureCollection<Point> } | null = null;

function styleHasLayer(map: MapboxMap, layerId: string): boolean {
  try {
    return Boolean(map.getStyle()?.layers?.some((l) => l.id === layerId));
  } catch {
    return false;
  }
}

/** Mapbox console-errors (often without throwing) if a layer's source is missing. */
function hasPlacementSource(map: MapboxMap): boolean {
  return Boolean(safeGetSource(map, WORLD_PLACEMENTS_SOURCE_ID));
}

function rememberedModelLayers(map: MapboxMap): Set<string> {
  let set = addedModelLayerIds.get(map);
  if (!set) {
    set = new Set();
    addedModelLayerIds.set(map, set);
  }
  return set;
}

function modelLayerExists(map: MapboxMap, layerId: string): boolean {
  if (rememberedModelLayers(map).has(layerId)) return true;
  if (safeGetLayer(map, layerId)) {
    rememberedModelLayers(map).add(layerId);
    return true;
  }
  try {
    const layers = map.getStyle()?.layers;
    if (layers?.some((l) => l.id === layerId)) {
      rememberedModelLayers(map).add(layerId);
      return true;
    }
  } catch {
    /* style race */
  }
  return false;
}

/** Models required by current features (plus catalog match when present). */
function modelsForData(data: FeatureCollection<Point>): WorldModelSpec[] {
  const bySlug = new Map<string, WorldModelSpec>();
  for (const f of data.features) {
    const props = f.properties as { slug?: string; kind?: string; modelId?: string } | null;
    const slug = String(props?.slug || props?.kind || '');
    if (!slug || bySlug.has(slug)) continue;
    const known = getWorldModel(slug);
    if (known) {
      bySlug.set(slug, known);
      continue;
    }
    bySlug.set(slug, {
      id: typeof props?.modelId === 'string' && props.modelId
        ? props.modelId
        : worldModelRuntimeId(slug),
      url: `/models/props/${slug}.glb`,
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
      label: slug,
      slug,
      category: 'prop',
      tags: [],
      active: true,
      available: true,
      allowUserScale: true,
      sortOrder: 0,
    });
  }
  return [...bySlug.values()];
}

function registerModels(map: MapboxMap, specs: WorldModelSpec[]): void {
  if (typeof map.addModel !== 'function') return;
  for (const spec of specs) {
    try {
      if (!map.hasModel?.(spec.id)) {
        map.addModel(spec.id, spec.url);
      }
    } catch {
      /* already registered / style race */
    }
  }
}

function unregisterModels(map: MapboxMap, specs: WorldModelSpec[]): void {
  if (typeof map.removeModel !== 'function') return;
  for (const spec of specs) {
    try {
      if (map.hasModel?.(spec.id)) map.removeModel(spec.id);
    } catch {
      /* ignore */
    }
  }
}

function isHotExpression(): ExpressionSpecification {
  return [
    'any',
    ['boolean', ['feature-state', 'hover'], false],
    ['boolean', ['feature-state', 'active'], false],
  ];
}

/** Nearly-clear RGBA plane — alpha>0 so Mapbox still hit-tests the pixels. */
function ensureHitBillboardImage(map: MapboxMap): void {
  try {
    if (map.hasImage(WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_ID)) return;
  } catch {
    return;
  }
  const size = WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_PX;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const o = i * 4;
    data[o] = 255;
    data[o + 1] = 255;
    data[o + 2] = 255;
    data[o + 3] = 1; // 1/255 — invisible, still queryable
  }
  try {
    map.addImage(
      WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_ID,
      { width: size, height: size, data },
      { pixelRatio: 1 },
    );
  } catch {
    /* style race / already present */
  }
}

/**
 * icon-size scales the 128px hit plane so it visually matches the model silhouette.
 *
 * We need size ∝ 2^zoom, but Mapbox GL has no power operator. The trick:
 * `['interpolate', ['exponential', 2], ['zoom'], z0, v0]`
 * produces v0 * 2^(zoom-z0) — exactly a 2× size per zoom level, matching
 * how Mapbox projects world-meters into screen-pixels.
 *
 * anchor_size_at_z14 = hitSizeMeters * 2^14 / (metersPerPixelZoom0 * imagePx)
 */
function hitBillboardIconSizeExpression(): ExpressionSpecification {
  const { metersPerPixelZoom0, minIconSize, defaultMeters } =
    WORLD_PLACEMENT_HIT_BILLBOARD;
  const imagePx = WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_PX;
  const ANCHOR_ZOOM = 14;
  // scale_at_anchor = hitSizeMeters / (mpp(14) * imagePx)
  // mpp(z) = metersPerPixelZoom0 / 2^z  →  mpp(14) = metersPerPixelZoom0 / 2^14
  const mppAtAnchor = metersPerPixelZoom0 / Math.pow(2, ANCHOR_ZOOM);
  const pixelsPerMeterAtAnchor = 1 / (mppAtAnchor * imagePx);
  // Per-feature anchor size driven by hitSizeMeters property
  const anchorSize: ExpressionSpecification = [
    'max',
    minIconSize,
    ['*', ['coalesce', ['get', 'hitSizeMeters'], defaultMeters], pixelsPerMeterAtAnchor],
  ];
  // Exponential base-2 interpolation doubles size per zoom level — equivalent to 2^(z-14)
  return [
    'interpolate',
    ['exponential', 2],
    ['zoom'],
    ANCHOR_ZOOM,
    anchorSize,
  ];
}

/**
 * Vertical offset so the hit plane center sits at ~50% of the model height.
 * icon-offset units are pixels at the icon's native size (before icon-size scaling),
 * so we shift up by half the image height (64px for a 128px image).
 * Negative Y = up in Mapbox screen-space.
 */
function hitBillboardOffsetExpression(): ExpressionSpecification {
  const halfImagePx = WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_PX / 2;
  return ['literal', [0, -halfImagePx]] as unknown as ExpressionSpecification;
}

/** Live paint from world.element_types — safe to call after layer exists or types hydrate. */
export function applyElementTypeColorsToMap(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  const colors = getElementTypeColorMap();
  const fill = buildPulseFillExpression(colors);

  if (
    safeGetLayer(map, WORLD_PLACEMENT_HIT_LAYER_ID) ||
    styleHasLayer(map, WORLD_PLACEMENT_HIT_LAYER_ID)
  ) {
    const baseColor = buildPulseStrokeExpression(colors);
    const hot = isHotExpression();
    try {
      map.setPaintProperty(
        WORLD_PLACEMENT_HIT_LAYER_ID,
        'circle-stroke-color',
        baseColor,
      );
      map.setPaintProperty(WORLD_PLACEMENT_HIT_LAYER_ID, 'circle-color', [
        'case',
        hot,
        fill,
        'transparent',
      ] as ExpressionSpecification);
    } catch {
      /* mid style swap */
    }
  }

  if (
    safeGetLayer(map, WORLD_LOD_CIRCLE_LAYER_ID) ||
    styleHasLayer(map, WORLD_LOD_CIRCLE_LAYER_ID)
  ) {
    try {
      map.setPaintProperty(WORLD_LOD_CIRCLE_LAYER_ID, 'circle-color', fill);
    } catch {
      /* mid style swap */
    }
  }
}

function ensurePulseLayer(map: MapboxMap): void {
  if (!hasPlacementSource(map)) return;
  if (
    safeGetLayer(map, WORLD_PLACEMENT_HIT_LAYER_ID) ||
    styleHasLayer(map, WORLD_PLACEMENT_HIT_LAYER_ID)
  ) {
    applyElementTypeColorsToMap(map);
    return;
  }

  const hot = isHotExpression();
  const colors = getElementTypeColorMap();
  const baseColor = buildPulseStrokeExpression(colors);

  // Stroke opacity: props with no interaction are always very faint (no hover response)
  const isNonInteractiveProp: ExpressionSpecification = [
    'all',
    ['==', ['get', 'category'], 'prop'],
    ['any', ['==', ['get', 'interaction'], 'none'], ['==', ['get', 'interaction'], 'see']],
    ['!', ['boolean', ['get', 'collectible'], false]],
  ];

  const layer = {
    id: WORLD_PLACEMENT_HIT_LAYER_ID,
    type: 'circle' as const,
    source: WORLD_PLACEMENTS_SOURCE_ID,
    paint: {
      'circle-radius': WORLD_PLACEMENT_PULSE.radiusPx,
      'circle-color': [
        'case',
        hot,
        buildPulseFillExpression(colors),
        'transparent',
      ] as ExpressionSpecification,
      'circle-opacity': [
        'case',
        // non-interactive props: never fill
        isNonInteractiveProp, 0,
        hot, WORLD_PLACEMENT_PULSE.hoverFillOpacity,
        0,
      ] as ExpressionSpecification,
      'circle-stroke-width': [
        'case',
        hot, WORLD_PLACEMENT_PULSE.hoverStrokeWidth,
        isNonInteractiveProp, 1.25,
        WORLD_PLACEMENT_PULSE.strokeWidth,
      ] as ExpressionSpecification,
      'circle-stroke-color': baseColor,
      'circle-stroke-opacity': [
        'case',
        isNonInteractiveProp, WORLD_PLACEMENT_PULSE.opacityMin,
        hot, WORLD_PLACEMENT_PULSE.hoverStrokeOpacity,
        WORLD_PLACEMENT_PULSE.opacityMin,
      ] as ExpressionSpecification,
      'circle-pitch-alignment': 'map' as const,
    },
    ...(mapUsesMapboxStandard(map) ? { slot: 'top' as const } : {}),
  };

  try {
    map.addLayer(layer);
  } catch {
    /* raced ensure */
  }
}

function ensureHitBillboardLayer(map: MapboxMap): void {
  if (!hasPlacementSource(map)) return;
  ensureHitBillboardImage(map);
  if (
    safeGetLayer(map, WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID) ||
    styleHasLayer(map, WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID)
  ) {
    return;
  }

  const layer = {
    id: WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID,
    type: 'symbol' as const,
    source: WORLD_PLACEMENTS_SOURCE_ID,
    layout: {
      'icon-image': WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_ID,
      'icon-size': hitBillboardIconSizeExpression(),
      // 'center' anchor — plane straddles the model vertically.
      // Offset upward by half the icon height in pixels so the center aligns
      // with the model's visual midpoint (~50% up from ground).
      'icon-anchor': 'center' as const,
      'icon-offset': hitBillboardOffsetExpression(),
      'icon-pitch-alignment': 'viewport' as const,
      'icon-rotation-alignment': 'viewport' as const,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-z-elevate': true,
    },
    paint: {
      // Keep optically clear; pixel alpha already ~0.
      'icon-opacity': 0.02,
    },
    ...(mapUsesMapboxStandard(map) ? { slot: 'top' as const } : {}),
  };

  try {
    map.addLayer(layer);
  } catch {
    /* raced ensure */
  }
}

// ── Dev block-grid overlay ────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Draws an 8 m world-grid overlay covering the current map viewport.
 * Called from tickPulse so the lines stay current as the user pans.
 * No-ops in production.
 */
function tickBlockGridOverlay(map: MapboxMap): void {
  if (!IS_DEV) return;
  if (!isMapStyleReady(map)) return;

  const bounds = map.getBounds();
  if (!bounds) return;

  const pad = 0.0005; // ~55 m buffer so lines don't pop at edges
  const geojson = buildBlockGridGeoJSON(
    bounds.getSouth() - pad,
    bounds.getNorth() + pad,
    bounds.getWest()  - pad,
    bounds.getEast()  + pad,
  );

  try {
    const existing = map.getSource(BLOCK_GRID_DEBUG_SOURCE_ID) as
      | import('mapbox-gl').GeoJSONSource
      | undefined;
    if (existing) {
      existing.setData(geojson);
    } else {
      map.addSource(BLOCK_GRID_DEBUG_SOURCE_ID, { type: 'geojson', data: geojson });
    }
  } catch {
    /* style race */
  }

  if (
    !safeGetLayer(map, BLOCK_GRID_DEBUG_LAYER_ID) &&
    !styleHasLayer(map, BLOCK_GRID_DEBUG_LAYER_ID)
  ) {
    try {
      map.addLayer({
        id: BLOCK_GRID_DEBUG_LAYER_ID,
        type: 'line',
        source: BLOCK_GRID_DEBUG_SOURCE_ID,
        paint: {
          'line-color': '#FF00CC',
          'line-opacity': 0.35,
          'line-width': 1,
          'line-dasharray': [3, 4],
        },
        ...(mapUsesMapboxStandard(map) ? { slot: 'top' as const } : {}),
      });
    } catch {
      /* raced */
    }
  }
}

function ensureHitLayer(map: MapboxMap): void {
  if (hitLayersAdded.get(map)) return;
  ensurePulseLayer(map);
  ensureHitBillboardLayer(map);
  if (
    (safeGetLayer(map, WORLD_PLACEMENT_HIT_LAYER_ID) ||
      styleHasLayer(map, WORLD_PLACEMENT_HIT_LAYER_ID)) &&
    (safeGetLayer(map, WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID) ||
      styleHasLayer(map, WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID))
  ) {
    hitLayersAdded.set(map, true);
  }
}

function ensureModelLayers(map: MapboxMap, specs: WorldModelSpec[]): void {
  if (!hasPlacementSource(map)) return;
  const remembered = rememberedModelLayers(map);
  for (const spec of specs) {
    const layerId = worldModelLayerId(spec.slug);
    if (modelLayerExists(map, layerId)) continue;
    const layer = {
      id: layerId,
      type: 'model' as const,
      source: WORLD_PLACEMENTS_SOURCE_ID,
      filter: ['==', ['get', 'modelId'], spec.id] as ExpressionSpecification,
      layout: {
        'model-id': spec.id,
      },
      paint: {
        'model-type': 'common-3d' as const,
        'model-scale': ['get', 'modelScale'] as unknown as [number, number, number],
        'model-rotation': ['get', 'modelRotation'] as unknown as [
          number,
          number,
          number,
        ],
        'model-translation': ['get', 'modelTranslation'] as unknown as [
          number,
          number,
          number,
        ],
        'model-elevation-reference': 'ground' as const,
      },
      ...(mapUsesMapboxStandard(map) ? { slot: 'middle' as const } : {}),
    };
    try {
      map.addLayer(layer);
      remembered.add(layerId);
    } catch {
      // Mapbox may have added it in a parallel ensure — remember if present now.
      if (safeGetLayer(map, layerId)) remembered.add(layerId);
    }
  }
}

function applyCollectibleSpin(map: MapboxMap, now: number): void {
  if (typeof document !== 'undefined' && document.hidden) return;

  // ~30fps — paint updates (setData array props are ignored by model layers)
  const quantized = Math.floor(now / 33);
  if (quantized === lastSpinApplied) return;
  lastSpinApplied = quantized;

  const spin =
    ((now % WORLD_COLLECTIBLE_SPIN_PERIOD_MS) / WORLD_COLLECTIBLE_SPIN_PERIOD_MS) *
    360;

  const data = getWorldPlacementsSnapshot();
  const collectibleSlugs = new Set<string>();
  for (const f of data.features) {
    const props = f.properties as WorldPlacementFeatureProps | null;
    if (props?.collectible && props.slug) collectibleSlugs.add(props.slug);
  }
  if (collectibleSlugs.size === 0) {
    // Catalog may mark interaction=collect even when props lag a rebuild
    for (const spec of getWorldCatalog()) {
      if (resolveModelVerb(spec.interaction) === 'collect') collectibleSlugs.add(spec.slug);
    }
  }

  for (const slug of collectibleSlugs) {
    const layerId = worldModelLayerId(slug);
    if (!safeGetLayer(map, layerId)) continue;
    try {
      map.setPaintProperty(layerId, 'model-rotation', [
        0,
        0,
        ['+', ['coalesce', ['get', 'baseRotationZ'], 0], spin],
      ] as unknown as [number, number, number]);
    } catch {
      try {
        map.setPaintProperty(layerId, 'model-rotation', [0, 0, spin]);
      } catch {
        /* unsupported */
      }
    }
  }
}

function tickPulse(now: number): void {
  const map = pulseMap;
  if (
    !map ||
    !isMapStyleReady(map) ||
    !safeGetLayer(map, WORLD_PLACEMENT_HIT_LAYER_ID)
  ) {
    pulseRaf = null;
    return;
  }

  const {
    periodMs,
    opacityMin,
    opacityMax,
    radiusPx,
    hoverRadiusPx,
    hoverStrokeOpacity,
  } = WORLD_PLACEMENT_PULSE;
  const phase = ((now % periodMs) / periodMs) * Math.PI * 2;
  const wave = 0.5 + 0.5 * Math.sin(phase);
  const idleOpacity = opacityMin + (opacityMax - opacityMin) * wave;
  const idleRadius = radiusPx * (0.92 + 0.16 * wave);
  const hot = isHotExpression();

  try {
    map.setPaintProperty(
      WORLD_PLACEMENT_HIT_LAYER_ID,
      'circle-stroke-opacity',
      // Non-interactive props stay at a fixed faint opacity independent of pulse
      ['case',
        ['all',
          ['==', ['get', 'category'], 'prop'],
          ['any', ['==', ['get', 'interaction'], 'none'], ['==', ['get', 'interaction'], 'see']],
          ['!', ['boolean', ['get', 'collectible'], false]],
        ], opacityMin,
        hot, hoverStrokeOpacity,
        idleOpacity,
      ] as ExpressionSpecification,
    );
    map.setPaintProperty(
      WORLD_PLACEMENT_HIT_LAYER_ID,
      'circle-radius',
      ['case', hot, hoverRadiusPx, idleRadius] as ExpressionSpecification,
    );
  } catch {
    /* mid style swap */
  }

  applyCollectibleSpin(map, now);
  tickBlockGridOverlay(map);

  pulseRaf = requestAnimationFrame(tickPulse);
}

export function startWorldPlacementPulse(map: MapboxMap): void {
  pulseMap = map;
  if (pulseRaf != null) return;
  pulseRaf = requestAnimationFrame(tickPulse);
}

export function stopWorldPlacementPulse(): void {
  if (pulseRaf != null) {
    cancelAnimationFrame(pulseRaf);
    pulseRaf = null;
  }
  pulseMap = null;
}

/**
 * Apply zoom-range LOD to all model layers in the current catalog.
 * Called inside ensureWorldPlacementLayers so it fires every time layers
 * are established (including after style.load). No-op if catalog is empty.
 */
function applyModelLayerLod(map: MapboxMap): void {
  try {
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
      if (typeof layer.id === 'string' && layer.id.startsWith('ftlomn-world-model-')) {
        map.setLayerZoomRange(layer.id, WORLD_LOD_3D_MIN_ZOOM, 24);
      }
    }
  } catch {
    /* style race */
  }
}

/**
 * 2D dots below WORLD_LOD_3D_MIN_ZOOM. Source must already be on the style —
 * Mapbox logs `source "ftlomn-world-placements" not found` (and does not throw)
 * if addLayer runs first.
 */
export function ensureLodCircleLayer(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  if (!hasPlacementSource(map)) return;

  const fill = buildPulseFillExpression(getElementTypeColorMap());
  if (
    safeGetLayer(map, WORLD_LOD_CIRCLE_LAYER_ID) ||
    styleHasLayer(map, WORLD_LOD_CIRCLE_LAYER_ID)
  ) {
    try {
      map.setPaintProperty(WORLD_LOD_CIRCLE_LAYER_ID, 'circle-color', fill);
    } catch {
      /* mid style swap */
    }
    return;
  }

  try {
    map.addLayer({
      id: WORLD_LOD_CIRCLE_LAYER_ID,
      type: 'circle',
      source: WORLD_PLACEMENTS_SOURCE_ID,
      maxzoom: WORLD_LOD_3D_MIN_ZOOM,
      paint: {
        'circle-radius': 6,
        'circle-color': fill,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.9,
      },
      ...(mapUsesMapboxStandard(map) ? { slot: 'top' as const } : {}),
    });
  } catch {
    /* raced / style swap */
  }
}

export function ensureWorldPlacementLayers(
  map: MapboxMap,
  data: FeatureCollection<Point> = EMPTY,
): void {
  if (!isMapStyleReady(map)) return;

  // Serialize — React can fire mount + catalog + data ensures in one tick;
  // parallel addLayer calls log "already exists" for heart/coin/chest.
  if (ensureInFlight) {
    ensureQueued = { map, data };
    return;
  }
  ensureInFlight = true;
  try {
    const specs = modelsForData(data);
    registerModels(map, specs);

    if (!safeGetSource(map, WORLD_PLACEMENTS_SOURCE_ID)) {
      // Style wipe / first run — remembered layer ids are stale.
      rememberedModelLayers(map).clear();
      hitLayersAdded.delete(map);
      try {
        map.addSource(WORLD_PLACEMENTS_SOURCE_ID, {
          type: 'geojson',
          data,
          promoteId: 'id',
        });
      } catch {
        /* style race — retry on next ensure */
        return;
      }
    } else {
      const src = map.getSource(WORLD_PLACEMENTS_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      try {
        src?.setData(data);
      } catch {
        /* ignore */
      }
    }

    // Source is on the style from here — every dependent layer goes through this gate.
    if (!hasPlacementSource(map)) return;

    ensureModelLayers(map, specs);
    ensureHitLayer(map);
    ensureLodCircleLayer(map);
    applyElementTypeColorsToMap(map);
    applyModelLayerLod(map);
    if (data.features.length > 0) startWorldPlacementPulse(map);
    else stopWorldPlacementPulse();
  } finally {
    ensureInFlight = false;
    const queued = ensureQueued;
    ensureQueued = null;
    if (queued) ensureWorldPlacementLayers(queued.map, queued.data);
  }
}

export function syncWorldPlacementSourceData(
  map: MapboxMap,
  data: FeatureCollection<Point>,
): void {
  ensureWorldPlacementLayers(map, data);
}

export function removeWorldPlacementLayers(map: MapboxMap): void {
  stopWorldPlacementPulse();
  rememberedModelLayers(map).clear();
  hitLayersAdded.delete(map);
  if (!isMapStyleReady(map)) return;
  const specs = modelsForData(EMPTY);
  // Remove every world model layer we may have added (catalog + stubs).
  const layerIds = new Set([
    ...getWorldCatalog().map((m) => worldModelLayerId(m.slug)),
    ...specs.map((m) => worldModelLayerId(m.slug)),
  ]);
  for (const id of layerIds) {
    try {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    } catch {
      /* ignore */
    }
  }
  for (const id of [
    BLOCK_GRID_DEBUG_LAYER_ID,
    WORLD_LOD_CIRCLE_LAYER_ID,
    WORLD_PLACEMENT_HIT_BILLBOARD_LAYER_ID,
    WORLD_PLACEMENT_HIT_LAYER_ID,
  ]) {
    try {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    } catch {
      /* ignore */
    }
  }
  for (const imgId of [WORLD_PLACEMENT_HIT_BILLBOARD_IMAGE_ID]) {
    try {
      if (map.hasImage(imgId)) map.removeImage(imgId);
    } catch {
      /* ignore */
    }
  }
  try {
    if (safeGetSource(map, BLOCK_GRID_DEBUG_SOURCE_ID)) {
      map.removeSource(BLOCK_GRID_DEBUG_SOURCE_ID);
    }
  } catch {
    /* ignore */
  }
  try {
    if (safeGetSource(map, WORLD_PLACEMENTS_SOURCE_ID)) {
      map.removeSource(WORLD_PLACEMENTS_SOURCE_ID);
    }
  } catch {
    /* ignore */
  }
  unregisterModels(map, [...specs, ...getWorldCatalog()]);
}
