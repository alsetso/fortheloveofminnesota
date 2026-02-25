/**
 * Check if user has Contributor, Professional, or Business plan (client-side)
 * 
 * @param account - Account object from auth state
 * @returns true if user has contributor/professional/business plan with active subscription
 */
export function hasContributorOrHigherAccessClient(account: { plan: string; subscription_status: string | null } | null | undefined): boolean {
  if (!account) {
    return false;
  }

  // Check if user has Contributor plan (paid tier)
  const hasContributorAccess = account.plan === 'contributor';

  // Check if subscription is active
  const isActive = 
    account.subscription_status === 'active' || 
    account.subscription_status === 'trialing';

  return hasContributorAccess && isActive;
}
