/**
 * Usage-limit notifications
 *
 * After a limit-consuming action (e.g. create map), optionally create one in-app
 * notification when the account is at or near its plan limit. Uses the same
 * feature limits as enforcement (get_account_feature_limit) and dedupe_key so
 * we don't spam (at most one per account per feature per 24h via create_alert).
 */

import { getAccountFeatureLimit } from '@/lib/billing/featureLimits';
import { createNotification } from '@/lib/notifications/notificationService';

/** Threshold: warn when usage >= this fraction of limit (e.g. 0.9 = 90%). */
const WARN_AT_RATIO = 0.9;

/** Human-readable feature names for notification copy. */
const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  custom_maps: 'maps',
  // add more as we add usage warnings for other features
};

/**
 * If the account has a count-based limit and current usage is at or above the
 * warning threshold, create a single in-app notification. Never throws; failures
 * are logged and do not affect the caller.
 *
 * Call this only after a successful create (so count is already updated).
 *
 * @param accountId - Account that just consumed more usage
 * @param featureSlug - Billing feature slug (e.g. MAP_FEATURE_SLUG)
 * @param currentCountAfterWrite - Count after the write (e.g. ownedMapsCount + 1)
 */
export async function maybeSendUsageLimitNotification(
  accountId: string,
  featureSlug: string,
  currentCountAfterWrite: number
): Promise<void> {
  try {
    const limit = await getAccountFeatureLimit(accountId, featureSlug);

    if (!limit.has_feature || limit.is_unlimited) return;
    if (limit.limit_type !== 'count' || limit.limit_value === null) return;

    const max = limit.limit_value;
    const atOrOverThreshold = currentCountAfterWrite >= Math.ceil(max * WARN_AT_RATIO);
    if (!atOrOverThreshold) return;

    const displayName = FEATURE_DISPLAY_NAMES[featureSlug] ?? featureSlug;
    const title =
      currentCountAfterWrite >= max
        ? `${displayName.charAt(0).toUpperCase() + displayName.slice(1)} limit reached`
        : `Approaching your ${displayName} limit`;
    const message =
      currentCountAfterWrite >= max
        ? `You've used all ${max} ${displayName}. Upgrade to create more.`
        : `You're at ${currentCountAfterWrite}/${max} ${displayName}. Upgrade to get more.`;

    await createNotification({
      account_id: accountId,
      event_type: 'system',
      title,
      message,
      action_url: '/settings/billing',
      action_label: 'Manage plan',
      priority: currentCountAfterWrite >= max ? 'high' : 'normal',
      channels: ['in_app'],
      dedupe_key: `usage_warning:${featureSlug}:${accountId}`,
      metadata: { feature_slug: featureSlug, current: currentCountAfterWrite, limit: max },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[usageWarning] Failed to create usage notification:', err);
    }
  }
}
