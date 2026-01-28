import type { AccountFeatureEntitlement } from '@/contexts/BillingEntitlementsContext';

/**
 * Canonical feature slug for map limits
 * 
 * INVARIANT: This is the single canonical feature slug for map limits.
 * All map limit checks must use this slug - no fallbacks allowed.
 */
export const MAP_FEATURE_SLUG = 'custom_maps' as const;

/**
 * Server-side feature limit type (from RPC function)
 */
type ServerFeatureLimit = {
  has_feature: boolean;
  limit_value: number | null;
  limit_type: 'count' | 'storage_mb' | 'boolean' | 'unlimited' | null;
  is_unlimited: boolean;
};

/**
 * Calculate map limit state from owned maps count and feature entitlement
 * 
 * This is the single source of truth for map limit calculations.
 * Used by both UI components and API enforcement.
 * 
 * @param ownedMapsCount - Number of maps owned by the account (from owned maps array)
 * @param feature - Feature entitlement from billing context (null if not available)
 * @returns Limit state with canCreate, isAtLimit, and display text
 */
export function calculateMapLimitState(
  ownedMapsCount: number,
  feature: AccountFeatureEntitlement | null
): {
  canCreate: boolean;
  isAtLimit: boolean;
  displayText: string;
} {
  // No feature = no access
  if (!feature) {
    return {
      canCreate: false,
      isAtLimit: true,
      displayText: 'Not available',
    };
  }

  // Check if unlimited
  const isUnlimited = feature.is_unlimited || feature.limit_type === 'unlimited';
  
  if (isUnlimited) {
    return {
      canCreate: true,
      isAtLimit: false,
      displayText: `${ownedMapsCount} maps (unlimited)`,
    };
  }

  // Count limit
  if (feature.limit_type === 'count' && feature.limit_value !== null) {
    const isAtLimit = ownedMapsCount >= feature.limit_value;
    return {
      canCreate: !isAtLimit,
      isAtLimit,
      displayText: `${ownedMapsCount} / ${feature.limit_value} maps`,
    };
  }

  // Fallback: has feature but no limit specified
  return {
    canCreate: true,
    isAtLimit: false,
    displayText: `${ownedMapsCount} maps`,
  };
}

/**
 * Server-side map limit check (for API routes)
 * 
 * Uses the same logic as calculateMapLimitState but accepts server-side feature limit format.
 * Enforces invariant: owned maps count is single source of truth.
 * 
 * @param ownedMapsCount - Number of maps owned by the account (must be from actual count query)
 * @param featureLimit - Feature limit from get_account_feature_limit RPC (null if not available)
 * @returns Limit check result with canCreate flag and error message if blocked
 */
export function checkMapLimitServer(
  ownedMapsCount: number,
  featureLimit: ServerFeatureLimit | null
): {
  canCreate: boolean;
  errorMessage?: string;
} {
  // No feature = no access
  if (!featureLimit || !featureLimit.has_feature) {
    return {
      canCreate: false,
      errorMessage: 'Map creation is not available on your current plan. Upgrade to create maps.',
    };
  }

  // Check if unlimited
  if (featureLimit.is_unlimited || featureLimit.limit_type === 'unlimited') {
    return { canCreate: true };
  }

  // Count limit
  if (featureLimit.limit_type === 'count' && featureLimit.limit_value !== null) {
    if (ownedMapsCount >= featureLimit.limit_value) {
      return {
        canCreate: false,
        errorMessage: `Map limit reached. You have ${ownedMapsCount}/${featureLimit.limit_value} maps. Upgrade your plan to create more maps.`,
      };
    }
    return { canCreate: true };
  }

  // Fallback: has feature but no limit specified - allow
  return { canCreate: true };
}
