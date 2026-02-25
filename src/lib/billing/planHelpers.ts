/**
 * Billing plan helper functions
 */

/**
 * Check if a plan is a paid subscription tier
 * Based on billing schema: hobby ($0) is free, all others are paid
 */
export function isPaidPlan(plan: string | null | undefined): boolean {
  if (!plan) return false;
  
  // Paid plans in billing schema: contributor only (professional, business, plus archived)
  // Free plan: hobby
  const paidPlans = ['contributor'];
  return paidPlans.includes(plan.toLowerCase());
}

/**
 * Get gold border classes for paid plans
 */
export function getPaidPlanBorderClasses(plan: string | null | undefined): string {
  return isPaidPlan(plan)
    ? 'p-[2px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600'
    : 'border border-gray-200';
}
