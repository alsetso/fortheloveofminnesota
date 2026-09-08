/**
 * Placement priority budgets.
 *
 * Single source of truth for how many placements of each type are
 * kept in the active store when a player's unlocked CTU scope returns
 * more rows than the safety ceiling.
 *
 * Budget hierarchy:
 *   Hearts  — primary collectible, largest guaranteed share
 *   Coins   — secondary collectible
 *   Chests  — rare, small fixed reserve
 *   Others  — env / decorative; share whatever remains
 *
 * Tiers define how the 3D object layer and radar treat proximity.
 */

/** Hard cap on placements shipped to the client in one response. */
export const PLACEMENT_TOTAL_BUDGET = 1000;

/**
 * Maximum community post placements (community-* slugs) included in any
 * one response. Nearest-first within this sub-budget. Keeps the game map
 * from flooding with post objects when a CTU has many contributors.
 */
export const PLACEMENT_COMMUNITY_BUDGET = 50;

/**
 * Guaranteed per-slug minimums filled before the remaining budget is
 * opened to other slugs in distance order.
 *
 * Slugs not listed here share the leftover slots after quotas are met.
 * Total of all values must be ≤ PLACEMENT_TOTAL_BUDGET.
 */
export const PLACEMENT_SLUG_BUDGETS: Readonly<Record<string, number>> = {
  'heart-quaternius': 600,
  'coin-quaternius': 280,
  'treasure-chest-safayan': 80,
  // Remaining 40 slots go to env / decorative / future slugs
} as const;

/**
 * Distance from the player within which placements render at full
 * fidelity — 3D model layer on the game map + full radar dots.
 */
export const PLACEMENT_TIER_A_RADIUS_M = 5_000;

/**
 * Distance for "direction-only" candidates shown as rim ticks on the
 * MiniMap compass. Beyond Tier A, no 3D model is expected.
 */
export const PLACEMENT_TIER_B_RADIUS_M = 20_000;

/**
 * Minimum distance the player must move before a new priority-sorted
 * fetch is triggered. Prevents hammering the API on every GPS tick.
 */
export const PLACEMENT_MOVE_REFRESH_THRESHOLD_M = 300;
