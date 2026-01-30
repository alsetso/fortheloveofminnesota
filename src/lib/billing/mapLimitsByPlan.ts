/**
 * Map limits derived from accounts.plan (server-side).
 * Single source of truth for settings/maps page and any server logic that needs plan-based map limits.
 */

export type PlanSlug = 'hobby' | 'contributor' | 'plus' | 'professional' | 'business' | 'gov';

/** Map limit per plan: hobby=1, contributor=5. Other plans use 5 or higher. */
const MAP_LIMIT_BY_PLAN: Record<PlanSlug, number> = {
  hobby: 1,
  contributor: 5,
  plus: 5,
  professional: 10,
  business: 10,
  gov: 10,
};

const DEFAULT_MAP_LIMIT = 1;

/**
 * Returns the map limit for an account plan (server-side).
 * Use this for settings/maps page and any server-rendered limit display.
 */
export function getMapLimitByPlan(plan: string | null | undefined): number {
  if (!plan || typeof plan !== 'string') return DEFAULT_MAP_LIMIT;
  const normalized = plan.toLowerCase() as PlanSlug;
  return MAP_LIMIT_BY_PLAN[normalized] ?? DEFAULT_MAP_LIMIT;
}
