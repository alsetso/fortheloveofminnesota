/**
 * Placement priority engine — pure functions, no side effects.
 *
 * When a player's unlocked CTU scope returns more placements than the
 * safety budget, this module decides which ones win. The invariant is
 * simple: the nearest, most-relevant collectibles always load first.
 *
 * Priority order:
 *   1. Distance from user (closest wins, always)
 *   2. Per-slug guaranteed quotas (hearts before coins before chests)
 *   3. Remaining budget filled by any slug, still distance-ordered
 *
 * All functions operate on plain objects — safe to import in both
 * Next.js API routes and client components.
 */

import {
  PLACEMENT_COMMUNITY_BUDGET,
  PLACEMENT_SLUG_BUDGETS,
  PLACEMENT_TOTAL_BUDGET,
} from '@/features/map/game/world/placementBudget';

/** Minimum shape required by the priority engine. */
export type PrioritizablePoint = {
  lat: number;
  lng: number;
  slug: string;
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Haversine great-circle distance in metres between two WGS-84 points. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a =
    sinDLat * sinDLat +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ---------------------------------------------------------------------------
// Annotation
// ---------------------------------------------------------------------------

type Annotated<T> = T & { _distanceM: number };

/** Return a new array with `_distanceM` attached to every item. */
export function annotateDistance<T extends PrioritizablePoint>(
  placements: T[],
  originLat: number,
  originLng: number,
): Annotated<T>[] {
  return placements.map((p) => ({
    ...p,
    _distanceM: haversineMeters(originLat, originLng, p.lat, p.lng),
  }));
}

// ---------------------------------------------------------------------------
// Slot allocation
// ---------------------------------------------------------------------------

/**
 * Fill per-slug budget buckets from a pre-sorted (closest-first) list.
 *
 * Returns `[selected, overflow]`:
 *   selected — items that claimed a guaranteed slug slot
 *   overflow — items whose slug either has no quota or whose quota is full;
 *              these fill the remaining general budget in arrival order
 */
function allocateSlots<T extends PrioritizablePoint>(
  sorted: Annotated<T>[],
): [Annotated<T>[], Annotated<T>[]] {
  const slugCounts: Record<string, number> = {};
  const selected: Annotated<T>[] = [];
  const overflow: Annotated<T>[] = [];

  for (const p of sorted) {
    const quota = PLACEMENT_SLUG_BUDGETS[p.slug] ?? 0;
    const filled = slugCounts[p.slug] ?? 0;
    if (quota > 0 && filled < quota) {
      selected.push(p);
      slugCounts[p.slug] = filled + 1;
    } else {
      overflow.push(p);
    }
  }

  return [selected, overflow];
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Return up to `PLACEMENT_TOTAL_BUDGET` placements, prioritised so that
 * the closest hearts → coins → chests → everything else are always
 * included before any distant row.
 *
 * Community post placements (slugs prefixed `community-`) are capped at
 * `PLACEMENT_COMMUNITY_BUDGET` nearest-first before the general budget
 * is applied, keeping the game map clear when a CTU has many contributors.
 *
 * When the total count is already within budget the list is returned as-is
 * in distance order (no allocation overhead).
 */
export function prioritizePlacements<T extends PrioritizablePoint>(
  placements: T[],
  originLat: number,
  originLng: number,
): T[] {
  if (placements.length === 0) return [];

  const annotated = annotateDistance(placements, originLat, originLng);
  annotated.sort((a, b) => a._distanceM - b._distanceM);

  // Apply community-* sub-budget before the general pipeline.
  let filtered = annotated;
  const communityCount = annotated.filter((p) => p.slug.startsWith('community-')).length;
  if (communityCount > PLACEMENT_COMMUNITY_BUDGET) {
    let communitySlots = 0;
    filtered = annotated.filter((p) => {
      if (!p.slug.startsWith('community-')) return true;
      if (communitySlots < PLACEMENT_COMMUNITY_BUDGET) {
        communitySlots++;
        return true;
      }
      return false;
    });
  }

  if (filtered.length <= PLACEMENT_TOTAL_BUDGET) {
    return filtered.map(({ _distanceM: _d, ...rest }) => rest as unknown as T);
  }

  const [selected, overflow] = allocateSlots(filtered);

  const remaining = PLACEMENT_TOTAL_BUDGET - selected.length;
  if (remaining > 0) {
    // overflow is already in distance order; merge back and re-sort so the
    // final list is globally closest-first rather than quotas-first.
    selected.push(...overflow.slice(0, remaining));
    selected.sort((a, b) => a._distanceM - b._distanceM);
  }

  return selected
    .slice(0, PLACEMENT_TOTAL_BUDGET)
    .map(({ _distanceM: _d, ...rest }) => rest as unknown as T);
}
