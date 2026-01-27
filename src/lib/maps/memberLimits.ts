import { getAccountFeatureLimit } from '@/lib/billing/featureLimits';
import type { MapSettings } from '@/types/map';

/**
 * Get the effective member limit for a map
 * Returns the minimum of:
 * 1. Owner's max_members setting (if set)
 * 2. Plan's map_members limit (if set)
 * 
 * @param mapOwnerAccountId - Account ID of the map owner
 * @param mapSettings - Map settings object
 * @param currentMemberCount - Current number of members on the map
 * @returns Object with effective limit and whether adding a member is allowed
 */
export async function getEffectiveMemberLimit(
  mapOwnerAccountId: string,
  mapSettings: MapSettings,
  currentMemberCount: number
): Promise<{
  effectiveLimit: number | null; // null = unlimited
  canAddMember: boolean;
  reason?: string;
}> {
  // Get plan limit
  const planLimit = await getAccountFeatureLimit(mapOwnerAccountId, 'map_members');
  
  // Owner's setting (from map.settings.membership.max_members)
  const ownerSetting = mapSettings.membership?.max_members;
  
  // Determine effective limit
  let effectiveLimit: number | null = null;
  
  if (planLimit.is_unlimited) {
    // Plan allows unlimited, so owner setting is the only constraint
    effectiveLimit = ownerSetting ?? null;
  } else if (planLimit.limit_type === 'count' && planLimit.limit_value !== null) {
    // Plan has a count limit
    if (ownerSetting !== undefined && ownerSetting !== null) {
      // Owner set a limit - use the minimum of owner setting and plan limit
      effectiveLimit = Math.min(ownerSetting, planLimit.limit_value);
    } else {
      // Owner didn't set a limit - use plan limit
      effectiveLimit = planLimit.limit_value;
    }
  } else {
    // Plan doesn't have the feature or has no limit
    effectiveLimit = ownerSetting ?? null;
  }
  
  // Check if we can add a member
  if (effectiveLimit === null) {
    // Unlimited
    return {
      effectiveLimit: null,
      canAddMember: true,
    };
  }
  
  if (currentMemberCount >= effectiveLimit) {
    return {
      effectiveLimit,
      canAddMember: false,
      reason: `Map has reached the maximum member limit of ${effectiveLimit}. ${ownerSetting !== undefined && ownerSetting !== null && ownerSetting < planLimit.limit_value! ? 'Owner limit reached.' : 'Plan limit reached. Upgrade to increase the limit.'}`,
    };
  }
  
  return {
    effectiveLimit,
    canAddMember: true,
  };
}
