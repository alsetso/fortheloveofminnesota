import { MAP_CONFIG } from '@/map/config';
import type { UserCoords } from '@/map/location/device/geolocation';

/**
 * isInMinnesota — v1 boundary check.
 *
 * Implementation: axis-aligned BOUNDING BOX, not the true state polygon.
 * This is a deliberate approximation:
 *   - It is dependency-free, O(1), and safe to call from frame loops.
 *   - It matches MAP_CONFIG.MINNESOTA_BOUNDS exactly — the same box the map
 *     uses for `maxBounds` — so the avatar and camera can never disagree
 *     about what counts as "inside".
 *   - The box over-includes strips of WI / IA / SD / ND: a user just across
 *     the border resolves as in-state. That errs on the generous side, which
 *     is the right failure mode for a Minnesota-first product.
 * Upgrade path: swap the body for a point-in-polygon test against the true
 * state boundary (turf `booleanPointInPolygon` is already a dependency) —
 * every caller goes through this one function.
 */
export function isInMinnesota(lat: number, lng: number): boolean {
  const b = MAP_CONFIG.MINNESOTA_BOUNDS;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

/** Coords-shaped convenience wrapper — same axis-aligned MN gate. */
export function isWithinMinnesota({ lat, lng }: UserCoords): boolean {
  return isInMinnesota(lat, lng);
}

/**
 * Clamp a point to the Minnesota bounding box (with a hair of inset so a
 * clamped avatar never sits exactly on `maxBounds` where the camera stalls).
 * Free Mode clamps at the border rather than roaming: the map camera cannot
 * leave MINNESOTA_BOUNDS, so an unclamped avatar could walk somewhere the
 * camera physically cannot follow.
 */
export function clampToMinnesota(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const b = MAP_CONFIG.MINNESOTA_BOUNDS;
  const inset = 0.0005;
  return {
    lat: Math.min(b.north - inset, Math.max(b.south + inset, lat)),
    lng: Math.min(b.east - inset, Math.max(b.west + inset, lng)),
  };
}
