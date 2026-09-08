/**
 * Object Radar — Range math + camera fit.
 * Range is a ground circle around the player; MiniMap/Object Map project it.
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import {
  OBJECT_RADAR_DEFAULT_RANGE_M,
  OBJECT_RADAR_RANGE_MAX_M,
  OBJECT_RADAR_RANGE_MIN_M,
} from '@/features/map/game/objectRadar/constants';
import type { ObjectRadarOrigin } from '@/features/map/game/objectRadar/types';

export type RangeOrigin = Pick<ObjectRadarOrigin, 'lng' | 'lat'>;

export function clampRangeM(meters: number): number {
  if (!Number.isFinite(meters)) return OBJECT_RADAR_DEFAULT_RANGE_M;
  return Math.min(
    OBJECT_RADAR_RANGE_MAX_M,
    Math.max(OBJECT_RADAR_RANGE_MIN_M, Math.round(meters)),
  );
}

export function formatRangeM(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function distanceMeters(a: RangeOrigin, b: RangeOrigin): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(from: RangeOrigin, to: RangeOrigin): number {
  const toRad = Math.PI / 180;
  const φ1 = from.lat * toRad;
  const φ2 = to.lat * toRad;
  const Δλ = (to.lng - from.lng) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Fit camera so a geographic viewport footprint fills the dial (Scout).
 * Always pitch 0 / bearing north-up — surface-down peek of what the main
 * map camera currently covers, not a player-range circle.
 */
export function fitCameraToViewportBounds(
  map: MapboxMap,
  bounds: { west: number; south: number; east: number; north: number },
  opts: { duration?: number } = {},
): void {
  if (!map.getStyle()) return;
  const { west, south, east, north } = bounds;
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    east <= west ||
    north <= south
  ) {
    return;
  }

  const duration = opts.duration ?? 0;
  const camera = {
    bounds: [
      [west, south],
      [east, north],
    ] as [[number, number], [number, number]],
    padding: 4,
    bearing: 0,
    pitch: 0,
    maxZoom: 18,
    duration,
    essential: true as const,
  };
  if (duration > 0) {
    map.fitBounds(camera.bounds, camera);
  } else {
    map.fitBounds(camera.bounds, { ...camera, duration: 0 });
  }
}

export type FitRangeOpts = {
  bearing?: number;
  duration?: number;
};

/**
 * Fit camera so the Range circle (Object Map dashed ring) fills the viewport.
 * Uses mercator meters-per-pixel — stable for the 84px dial after relocate.
 */
export function fitCameraToRange(
  map: MapboxMap,
  center: RangeOrigin,
  rangeM: number,
  opts: FitRangeOpts = {},
): void {
  if (!map.getStyle()) return;
  const el = map.getContainer();
  const size = Math.min(
    el.clientWidth || el.offsetWidth || 0,
    el.clientHeight || el.offsetHeight || 0,
  );
  if (size <= 0 || !(rangeM > 0)) return;

  const bearing = opts.bearing ?? 0;
  const duration = opts.duration ?? 0;
  // Keep a little chrome padding so the Range disc sits inside the round bezel.
  const pad = Math.max(4, Math.round(size * 0.1));
  const diameterPx = Math.max(8, size - 2 * pad);
  const metersPerPixel = (2 * rangeM) / diameterPx;
  const latRad = (center.lat * Math.PI) / 180;
  // Mapbox GL world size uses 512px tiles.
  const zoom = Math.log2(
    (40_075_016.686 * Math.max(0.05, Math.cos(latRad))) /
      (512 * metersPerPixel),
  );
  const z = Math.min(20, Math.max(11, zoom));

  const camera = {
    center: [center.lng, center.lat] as [number, number],
    zoom: z,
    bearing,
    pitch: 0,
  };
  if (duration > 0) {
    map.easeTo({ ...camera, duration, essential: true });
  } else {
    map.jumpTo(camera);
  }
}
