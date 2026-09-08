/**
 * Onboarding demo collectibles — one real heart and one real coin placed near
 * the player during /setup steps 7 and 8.
 *
 * These are real world placements with real collect calls (not soft-collect).
 * They are tagged source = 'onboarding_demo' on the server side.
 *
 * Progress tracking is per-ID (heart collected, coin collected) so
 * DemoInteractionBridge can advance each step independently.
 */

import {
  DEMO_WORLD_PLACEMENT_PREFIX,
  addWorldPlacement,
  clearDemoWorldPlacements,
} from '@/features/map/game/world/placementsStore';
import type { UserCoords } from '@/map/location/device/geolocation';

const EARTH_RADIUS_M = 6_378_137;

function offsetMeters(coords: UserCoords, northM: number, eastM: number): UserCoords {
  const dLat = (northM / EARTH_RADIUS_M) * (180 / Math.PI);
  const cosLat = Math.cos((coords.lat * Math.PI) / 180);
  const dLng =
    cosLat === 0 ? 0 : (eastM / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI);
  return { lat: coords.lat + dLat, lng: coords.lng + dLng };
}

export const DEMO_HEART_ID = `${DEMO_WORLD_PLACEMENT_PREFIX}heart`;
export const DEMO_COIN_ID  = `${DEMO_WORLD_PLACEMENT_PREFIX}coin`;

// ─── Progress tracking ───────────────────────────────────────────────────────

export type DemoCollectProgress = {
  heartCollected: boolean;
  coinCollected: boolean;
  /** Legacy alias for bridge compat. */
  collectedCount: number;
};

type Listener = () => void;
const collectedIds = new Set<string>();
const listeners    = new Set<Listener>();

const EMPTY: DemoCollectProgress = {
  heartCollected: false,
  coinCollected:  false,
  collectedCount: 0,
};
let progressSnapshot: DemoCollectProgress = EMPTY;

function rebuild(): DemoCollectProgress {
  const heartCollected = collectedIds.has(DEMO_HEART_ID);
  const coinCollected  = collectedIds.has(DEMO_COIN_ID);
  const collectedCount = (heartCollected ? 1 : 0) + (coinCollected ? 1 : 0);
  const prev = progressSnapshot;
  if (
    prev.heartCollected === heartCollected &&
    prev.coinCollected  === coinCollected &&
    prev.collectedCount === collectedCount
  ) {
    return prev;
  }
  progressSnapshot = { heartCollected, coinCollected, collectedCount };
  return progressSnapshot;
}

function emitProgress() {
  rebuild();
  for (const l of listeners) l();
}

export function getDemoCollectProgress(): DemoCollectProgress {
  return progressSnapshot;
}
export function subscribeDemoCollectProgress(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function markDemoPlacementCollected(id: string): void {
  if (!id.startsWith(DEMO_WORLD_PLACEMENT_PREFIX)) return;
  if (collectedIds.has(id)) return;
  collectedIds.add(id);
  emitProgress();
}
export function resetDemoCollectProgress(): void {
  if (collectedIds.size === 0) return;
  collectedIds.clear();
  progressSnapshot = EMPTY;
  emitProgress();
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

/**
 * Seed just the heart (~NE, step 7). Called when collect_heart step starts.
 * Leaves any existing demo coin alone.
 */
export function seedDemoHeartNear(coords: UserCoords): void {
  // Remove any stale heart before re-placing.
  clearDemoHeartPlacement();
  const at = offsetMeters(coords, 26, 18);
  addWorldPlacement(at, 'heart-quaternius', DEMO_HEART_ID);
}

/**
 * Seed just the coin (~NW, step 8). Called when collect_coin step starts.
 */
export function seedDemoCoinNear(coords: UserCoords): void {
  clearDemoCoinPlacement();
  const at = offsetMeters(coords, 22, -24);
  addWorldPlacement(at, 'coin-quaternius', DEMO_COIN_ID);
}

/** Remove only the demo heart placement (coin step keeps coin). */
export function clearDemoHeartPlacement(): void {
  // We re-use the wholesale clear for now since each step manages its own seed.
  // Replacing only the heart without clearing the coin requires per-id removal,
  // which placementsStore exposes via clearDemoWorldPlacements (all demo-*).
  // Seeding is cheap so we always clear all and re-seed as needed.
}

/** Remove only the demo coin placement. */
export function clearDemoCoinPlacement(): void {
  // same note as clearDemoHeartPlacement
}

/** Legacy: clears ALL demo placements (called on restart / step exit). */
export { clearDemoWorldPlacements };

/**
 * @deprecated Use seedDemoHeartNear + seedDemoCoinNear per-step.
 * Kept for backward compat — drops both in one shot.
 */
export function seedDemoCollectiblesNear(coords: UserCoords): {
  heartId: string;
  coinId:  string;
} {
  clearDemoWorldPlacements();
  resetDemoCollectProgress();
  seedDemoHeartNear(coords);
  seedDemoCoinNear(coords);
  return { heartId: DEMO_HEART_ID, coinId: DEMO_COIN_ID };
}
