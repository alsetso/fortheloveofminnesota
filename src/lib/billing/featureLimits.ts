import { createServerClientWithAuth } from '@/lib/supabaseServer';
import type { FeatureLimit } from './types';

/**
 * Check if an account has access to a feature and get its limit
 */
export async function getAccountFeatureLimit(
  accountId: string,
  featureSlug: string
): Promise<FeatureLimit> {
  const supabase = await createServerClientWithAuth();

  const { data, error } = await (supabase.rpc as any)('get_account_feature_limit', {
    account_id: accountId,
    feature_slug: featureSlug,
  });

  const normalizeLimitType = (t: unknown): FeatureLimit['limit_type'] => {
    if (t === 'count' || t === 'storage_mb' || t === 'boolean' || t === 'unlimited') return t;
    return null;
  };

  if (error || !data || !Array.isArray(data) || (data as any[]).length === 0) {
    return {
      has_feature: false,
      limit_value: null,
      limit_type: null,
      is_unlimited: false,
    };
  }

  const row = (data[0] ?? null) as
    | {
        has_feature?: unknown;
        limit_value?: unknown;
        limit_type?: unknown;
        is_unlimited?: unknown;
      }
    | null;
  return {
    has_feature: Boolean(row?.has_feature),
    limit_value: typeof row?.limit_value === 'number' ? row.limit_value : null,
    limit_type: normalizeLimitType(row?.limit_type),
    is_unlimited: Boolean(row?.is_unlimited),
  };
}

/**
 * Check if an account can perform an action based on current usage and limits
 * 
 * @example
 * const canCreate = await canAccountPerformAction(accountId, 'groups', currentGroupCount);
 * if (!canCreate.allowed) {
 *   throw new Error(canCreate.message);
 * }
 */
export async function canAccountPerformAction(
  accountId: string,
  featureSlug: string,
  currentCount: number
): Promise<{ allowed: boolean; message: string; limit: number | null }> {
  const featureLimit = await getAccountFeatureLimit(accountId, featureSlug);

  // User doesn't have the feature
  if (!featureLimit.has_feature) {
    return {
      allowed: false,
      message: `You need to upgrade your plan to access ${featureSlug}`,
      limit: null,
    };
  }

  // Feature is unlimited
  if (featureLimit.is_unlimited) {
    return {
      allowed: true,
      message: 'Unlimited',
      limit: null,
    };
  }

  // Check count limit
  if (featureLimit.limit_type === 'count' && featureLimit.limit_value !== null) {
    if (currentCount >= featureLimit.limit_value) {
      return {
        allowed: false,
        message: `You've reached your limit of ${featureLimit.limit_value} ${featureSlug}. Upgrade to get more.`,
        limit: featureLimit.limit_value,
      };
    }
    return {
      allowed: true,
      message: `${currentCount}/${featureLimit.limit_value} used`,
      limit: featureLimit.limit_value,
    };
  }

  // Boolean feature (just yes/no access)
  if (featureLimit.limit_type === 'boolean') {
    return {
      allowed: true,
      message: 'Feature enabled',
      limit: 1,
    };
  }

  // Default: allow if has feature
  return {
    allowed: true,
    message: 'Allowed',
    limit: featureLimit.limit_value,
  };
}

/**
 * Get usage display text for a feature
 * 
 * @example
 * const usage = await getFeatureUsageDisplay(accountId, 'groups', 3);
 * // Returns: "3 / 5 groups" or "3 groups (unlimited)"
 */
export async function getFeatureUsageDisplay(
  accountId: string,
  featureSlug: string,
  currentCount: number
): Promise<string> {
  const featureLimit = await getAccountFeatureLimit(accountId, featureSlug);

  if (!featureLimit.has_feature) {
    return 'Not available';
  }

  if (featureLimit.is_unlimited) {
    return `${currentCount} ${featureSlug} (unlimited)`;
  }

  if (featureLimit.limit_type === 'count' && featureLimit.limit_value !== null) {
    return `${currentCount} / ${featureLimit.limit_value} ${featureSlug}`;
  }

  if (featureLimit.limit_type === 'storage_mb' && featureLimit.limit_value !== null) {
    const usedMB = currentCount;
    const limitMB = featureLimit.limit_value;
    return `${usedMB} MB / ${limitMB} MB`;
  }

  return `${currentCount} ${featureSlug}`;
}
