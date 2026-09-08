import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map as MapboxMap, PaddingOptions } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { mapDataStore } from '@/map/data/MapDataStore';
import {
  boundsToMapbox,
  geometryLngLatBounds,
} from '@/map/geo/geometryLngLatBounds';
import {
  MAP_DOCK_HALF_HEIGHT_VH,
  mapDockVhPx,
} from '@/features/map/dockCore/core/mapDockTokens';
import { applyScoutZoomLimits } from '@/map/location/camera/scoutMapGestures';
import { getPresenceMode } from '@/map/location/positionMode/positionModeStore';

export type TerritoryFocusPadding = PaddingOptions;

/** Padding so the feature sits in the visible map above the half dock. */
export function territoryFocusPadding(map: MapboxMap): PaddingOptions {
  const bleed = MAP_CONFIG.BLEED_BOTTOM_PX;
  const hFull = map.getContainer().clientHeight || window.innerHeight;
  const h = Math.max(1, hFull - bleed);
  const w = map.getContainer().clientWidth || window.innerWidth;
  const dockBottom = mapDockVhPx(MAP_DOCK_HALF_HEIGHT_VH, h);
  return {
    top: Math.max(48, Math.round(h * 0.06)),
    left: Math.max(28, Math.round(w * 0.04)),
    right: Math.max(28, Math.round(w * 0.04)),
    // Bleed is below the clip — pad from the GL canvas bottom through it.
    bottom: Math.max(dockBottom + 16, Math.round(h * 0.42)) + bleed,
  };
}

export function findTerritoryFeature(
  sourceId: string,
  featureId: string,
): Feature<Geometry> | null {
  const fc = mapDataStore.get(sourceId) as FeatureCollection;
  const match = fc.features.find((f) => {
    const id = f.id ?? f.properties?.id;
    return id != null && String(id) === featureId;
  });
  return (match as Feature<Geometry> | undefined) ?? null;
}

export type FocusTerritoryOptions = {
  duration?: number;
  padding?: PaddingOptions;
  /** Sibling / drill-down: shorter ease, no dramatic reset. */
  reposition?: boolean;
  /** Cap zoom for small geometries (points / building sites). */
  maxZoom?: number;
  /**
   * Floor used when locking/clearing minZoom — Explore passes
   * `EXPLORE_MAP_CONFIG.MIN_ZOOM` so selection never re-locks to Game's 18.
   */
  floorMinZoom?: number;
  /** Cancel token — ignore lock if a newer focus started. */
  generation?: number;
  isCurrent?: (generation: number) => boolean;
};

/**
 * Light padding for the zoom-out floor — keeps the full boundary visible on the
 * map, without the dock-heavy inset used for the initial frame.
 */
function territoryFloorPadding(map: MapboxMap): PaddingOptions {
  const bleed = MAP_CONFIG.BLEED_BOTTOM_PX;
  const hFull = map.getContainer().clientHeight || window.innerHeight;
  const h = Math.max(1, hFull - bleed);
  const w = map.getContainer().clientWidth || window.innerWidth;
  return {
    top: Math.max(32, Math.round(h * 0.04)),
    left: Math.max(24, Math.round(w * 0.04)),
    right: Math.max(24, Math.round(w * 0.04)),
    bottom: Math.max(32, Math.round(h * 0.04)) + bleed,
  };
}

/**
 * Frame a territory feature above the dock, then lock minZoom to a *loose*
 * fit of that same boundary (full map, light padding).
 *
 * That still blocks zooming out past the selected shape, but does not pin
 * minZoom to the dock-tight frame zoom — which made every zoom-out a no-op
 * right after selection.
 */
export function focusTerritoryCameraOnFeature(
  map: MapboxMap,
  feature: Feature<Geometry>,
  options?: FocusTerritoryOptions,
): boolean {
  if (!feature?.geometry) return false;

  const box = geometryLngLatBounds(feature.geometry);
  if (!box) return false;

  const bounds = boundsToMapbox(box);
  const padding = options?.padding ?? territoryFocusPadding(map);
  const reposition = options?.reposition === true;
  const duration = options?.duration ?? (reposition ? 420 : 650);
  const generation = options?.generation ?? 0;
  const isCurrent = options?.isCurrent ?? (() => true);
  const maxZoom = options?.maxZoom;
  const floorMinZoom = options?.floorMinZoom ?? MAP_CONFIG.MIN_ZOOM;

  // Free any prior lock so the ease can run (avoids a flash when the next
  // feature needs a different minZoom than the current view).
  try {
    map.setMinZoom(floorMinZoom);
  } catch {
    return false;
  }

  const frameCamera = map.cameraForBounds(bounds, {
    padding,
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    ...(maxZoom != null ? { maxZoom } : {}),
  });

  // Floor = how far out you may go while the boundary still fills the map.
  // No maxZoom cap — small sites still get a sensible zoom-out range.
  const floorCamera = map.cameraForBounds(bounds, {
    padding: territoryFloorPadding(map),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  });

  const zoom = frameCamera?.zoom;
  const center = frameCamera?.center;
  const floorZoom = floorCamera?.zoom;
  if (zoom == null || center == null || !Number.isFinite(zoom)) return false;

  const lockMinZoom = () => {
    if (!isCurrent(generation)) return;
    try {
      const floor =
        floorZoom != null && Number.isFinite(floorZoom) ? floorZoom : zoom;
      // Never lock above the framed zoom (would block all zoom-out from the frame).
      map.setMinZoom(Math.max(floorMinZoom, Math.min(floor, zoom)));
    } catch {
      /* map removed */
    }
  };

  map.stop();
  map.easeTo({
    center,
    zoom,
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    duration,
    essential: true,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  if (duration <= 0) {
    lockMinZoom();
  } else {
    map.once('moveend', lockMinZoom);
  }

  return true;
}

export function focusTerritoryCamera(
  map: MapboxMap,
  sourceId: string,
  featureId: string,
  options?: FocusTerritoryOptions,
): boolean {
  const feature = findTerritoryFeature(sourceId, featureId);
  if (!feature) return false;
  return focusTerritoryCameraOnFeature(map, feature, options);
}

/** Restore global min zoom after leaving territory focus. */
export function clearTerritoryCameraLock(
  map: MapboxMap,
  floorMinZoom: number = MAP_CONFIG.MIN_ZOOM,
): void {
  try {
    if (getPresenceMode() === 'scout') {
      applyScoutZoomLimits(map);
      return;
    }
    map.setMinZoom(floorMinZoom);
  } catch {
    /* map removed */
  }
}
