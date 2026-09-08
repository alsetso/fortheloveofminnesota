/**
 * Tool credit price list — same economics as apps/ios.
 * UI + future API charges share this source of truth.
 *
 * Paid external lookups are flat **1 credit** each. Free actions stay at 0.
 * Cached repeats also charge 0 (enforced server-side when wired).
 */
export const TOOL_CREDIT_COSTS = {
  /** Match against our own accounts DB — no external call. */
  peopleAccountLookup: 0,
  /** RapidAPI skip-trace public records pull. */
  peoplePublicRecords: 1,
  /** RapidAPI skip-trace deep person detail. */
  peopleDetailPull: 1,
  /** RapidAPI Zillow property details. */
  realEstateProperty: 1,
  /** RapidAPI skip-trace by address — owner / people. */
  realEstateOwner: 1,
  /** Metro Transit public API. */
  transit: 0,
} as const;

export type ToolCreditKey = keyof typeof TOOL_CREDIT_COSTS;

export function formatCredits(credits: number): string {
  if (credits === 0) return 'Free';
  return `${credits} credit${credits === 1 ? '' : 's'}`;
}
