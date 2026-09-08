import { NextRequest, NextResponse } from 'next/server';
import {
  CONTRIBUTOR_ENTITLEMENT_ID,
  CONTRIBUTOR_PRODUCT_ID,
  REVENUECAT_PURCHASES_ENABLED,
} from '@/lib/despia/revenueCat';
import { getCreditPackByProductId } from '@/features/tools/wallet/creditPacks';
import { getPublicServiceDb } from '@/lib/wallet/walletDb';
import { recordToolCreditTransaction } from '@/lib/wallet/walletLedger';

/**
 * RevenueCat → ios-2 webhook.
 *
 * V1 is earn-only — when `REVENUECAT_PURCHASES_ENABLED` is false this route
 * acknowledges and ignores events so a misconfigured dashboard cannot credit packs.
 *
 * Configured in the RevenueCat dashboard (project `ios`) to POST here on every
 * entitlement + purchase event: https://ios.fortheloveofminnesota.com/api/revenuecat/webhook
 * Auth: `Authorization: Bearer ${REVENUECAT_WEBHOOK_SECRET}`
 * Docs: https://setup.despia.com/best-practices/backend/revenuecat/webhooks.md
 *
 * Two purchasable things flow through here (post-V1):
 * - Contributor subscription (`contributor_monthly`) → accounts.plan / subscription_status
 * - Tool-credit packs (`tool_credits_25/100/250`, consumables) → wallet.transactions
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[];
  environment?: string;
  store?: string;
  [key: string]: unknown;
};

type RevenueCatWebhookBody = {
  api_version?: string;
  event?: RevenueCatEvent;
};

/** Grants stay active — no state change needed beyond marking the plan/status. */
const SUBSCRIPTION_ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

/** Access ends immediately. */
const SUBSCRIPTION_REVOKE_EVENTS = new Set(['EXPIRATION', 'REFUND']);

/** Grace period — keep access, flag billing trouble. */
const SUBSCRIPTION_GRACE_EVENTS = new Set(['BILLING_ISSUE']);

/** One-time consumable purchases (tool-credit packs). */
const CONSUMABLE_PURCHASE_EVENTS = new Set(['NON_RENEWING_PURCHASE', 'INITIAL_PURCHASE']);

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error('[revenuecat/webhook] REVENUECAT_WEBHOOK_SECRET is not set');
    return false;
  }
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === secret;
}

function isContributorProduct(event: RevenueCatEvent): boolean {
  if (event.product_id === CONTRIBUTOR_PRODUCT_ID) return true;
  return (event.entitlement_ids ?? []).includes(CONTRIBUTOR_ENTITLEMENT_ID);
}

async function setSubscriptionState(
  accountId: string,
  plan: 'contributor' | 'hobby',
  subscriptionStatus: 'active' | 'trialing' | 'inactive' | 'past_due',
): Promise<void> {
  const db = getPublicServiceDb();
  const { error } = await db
    .from('accounts')
    .update({
      plan,
      subscription_status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);
  if (error) {
    throw new Error(`accounts update failed: ${error.message}`);
  }
}

async function creditPackPurchase(accountId: string, event: RevenueCatEvent): Promise<boolean> {
  const pack = getCreditPackByProductId(event.product_id ?? '');
  if (!pack) return false;

  await recordToolCreditTransaction({
    accountId,
    amount: pack.credits,
    type: 'purchase',
    product: 'tool-credits',
    action: pack.id,
    description: `App Store purchase · ${pack.label} (${pack.credits} credits)`,
    // RC event ids aren't guaranteed UUIDs — dedupe via idempotency_key, not reference_id.
    idempotencyKey: `revenuecat:${event.id ?? `${accountId}:${event.product_id}:${event.purchased_at_ms ?? ''}`}`,
  });
  return true;
}

export async function POST(req: NextRequest) {
  if (!REVENUECAT_PURCHASES_ENABLED) {
    return NextResponse.json({
      received: true,
      handled: false,
      reason: 'earn_only_v1',
      note: 'IAP / RevenueCat purchases are disabled for this app version.',
    });
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: RevenueCatWebhookBody;
  try {
    body = (await req.json()) as RevenueCatWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = body.event ?? {};
  const type = event.type ?? 'UNKNOWN';
  const accountId = event.app_user_id || event.original_app_user_id || null;

  if (!accountId) {
    console.error('[revenuecat/webhook] missing app_user_id', { type, productId: event.product_id });
    return NextResponse.json({ received: true, handled: false, reason: 'no_app_user_id' });
  }

  try {
    const pack = getCreditPackByProductId(event.product_id ?? '');

    if (pack && CONSUMABLE_PURCHASE_EVENTS.has(type)) {
      await creditPackPurchase(accountId, event);
    } else if (isContributorProduct(event)) {
      if (SUBSCRIPTION_ACTIVE_EVENTS.has(type)) {
        await setSubscriptionState(accountId, 'contributor', 'active');
      } else if (SUBSCRIPTION_GRACE_EVENTS.has(type)) {
        // Apple grants a grace period — keep Contributor access, flag billing trouble.
        await setSubscriptionState(accountId, 'contributor', 'past_due');
      } else if (SUBSCRIPTION_REVOKE_EVENTS.has(type)) {
        await setSubscriptionState(accountId, 'hobby', 'inactive');
      }
      // CANCELLATION: auto-renew turned off but access continues until `expiration_at_ms` —
      // no state change here; EXPIRATION fires separately when it actually lapses.
    } else {
      console.info('[revenuecat/webhook] unhandled product/event', {
        type,
        productId: event.product_id,
      });
    }
  } catch (err) {
    console.error('[revenuecat/webhook] processing failed', {
      type,
      accountId,
      productId: event.product_id,
      err: err instanceof Error ? err.message : err,
    });
    // Non-2xx so RevenueCat retries — this is likely a transient DB error.
    return NextResponse.json({ received: true, handled: false }, { status: 500 });
  }

  return NextResponse.json({ received: true, handled: true, type });
}
