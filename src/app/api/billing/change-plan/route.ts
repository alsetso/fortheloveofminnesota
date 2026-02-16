import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

/**
 * Change or create subscription plan
 *
 * POST /api/billing/change-plan
 *
 * - If an active subscription exists: swaps the price (upgrade/downgrade).
 * - If no subscription but customer has a payment method on file: creates a new subscription.
 * - DB updates happen via the customer.subscription.* webhooks.
 *
 * Security:
 * - Rate limited: strict (10 req/min) — payment-sensitive
 * - Requires authentication
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      try {
        const body = await req.json().catch(() => ({}));
        const planSlug: string | undefined = body.plan;
        const period: 'monthly' | 'yearly' = body.period === 'yearly' ? 'yearly' : 'monthly';

        if (!planSlug) {
          return NextResponse.json({ error: 'Missing required field: plan' }, { status: 400 });
        }

        if (!accountId) {
          return NextResponse.json({ error: 'Account not found' }, { status: 401 });
        }

        const supabase = await createServerClientWithAuth(cookies()) as any;

        // 1. Get account
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('id, stripe_customer_id, plan, subscription_status')
          .eq('id', accountId)
          .single();

        if (accountError || !account) {
          return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        if (!account.stripe_customer_id) {
          return NextResponse.json(
            { error: 'No Stripe customer on file. Complete a checkout first.' },
            { status: 400 }
          );
        }

        // 2. Look up the target plan's price ID
        const { data: targetPlan, error: planError } = await supabase
          .from('billing_plans')
          .select('slug, name, stripe_price_id_monthly, stripe_price_id_yearly, display_order')
          .eq('slug', planSlug)
          .eq('is_active', true)
          .single();

        if (planError || !targetPlan) {
          return NextResponse.json(
            { error: `Plan '${planSlug}' not found or inactive` },
            { status: 404 }
          );
        }

        const newPriceId = period === 'yearly'
          ? targetPlan.stripe_price_id_yearly
          : targetPlan.stripe_price_id_monthly;

        if (!newPriceId) {
          return NextResponse.json(
            { error: `No ${period} price configured for ${targetPlan.name}` },
            { status: 400 }
          );
        }

        // 3. Check for existing subscription
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('subscription_id, price_id, status')
          .eq('stripe_customer_id', account.stripe_customer_id)
          .maybeSingle();

        // --- Path A: existing active subscription → swap price ---
        if (sub && ['active', 'trialing'].includes(sub.status)) {
          if (sub.price_id === newPriceId) {
            return NextResponse.json(
              { error: 'You are already on this plan and billing period' },
              { status: 400 }
            );
          }

          const stripeSub = await stripe.subscriptions.retrieve(sub.subscription_id);
          const currentItem = stripeSub.items.data[0];

          if (!currentItem) {
            return NextResponse.json(
              { error: 'Subscription has no line items — contact support' },
              { status: 500 }
            );
          }

          const updated = await stripe.subscriptions.update(sub.subscription_id, {
            items: [{ id: currentItem.id, price: newPriceId }],
            proration_behavior: 'create_prorations',
          });

          // Optimistic DB update (webhook is authoritative reconciliation)
          await supabase
            .from('accounts')
            .update({ plan: targetPlan.slug, subscription_status: updated.status })
            .eq('id', account.id);

          await supabase
            .from('subscriptions')
            .update({ price_id: newPriceId, status: updated.status })
            .eq('subscription_id', sub.subscription_id);

          return NextResponse.json({
            success: true,
            action: 'changed',
            subscription_id: updated.id,
            status: updated.status,
            new_price_id: newPriceId,
            plan: targetPlan.slug,
          });
        }

        // --- Path B: no active subscription → create with existing payment method ---
        const paymentMethods = await stripe.customers.listPaymentMethods(
          account.stripe_customer_id,
          { type: 'card', limit: 1 }
        );

        if (paymentMethods.data.length === 0) {
          return NextResponse.json(
            { error: 'no_payment_method', message: 'No payment method on file. Please complete checkout.' },
            { status: 400 }
          );
        }

        const defaultPm = paymentMethods.data[0].id;

        // 7-day free trial for contributor only
        const trialDays = planSlug === 'contributor' ? 7 : undefined;

        const created = await stripe.subscriptions.create({
          customer: account.stripe_customer_id,
          items: [{ price: newPriceId }],
          default_payment_method: defaultPm,
          ...(trialDays != null && { trial_period_days: trialDays }),
          metadata: {
            accountId: account.id,
            planSlug: targetPlan.slug,
          },
        });

        // Optimistic DB update (webhook is authoritative reconciliation)
        await supabase
          .from('accounts')
          .update({ plan: targetPlan.slug, subscription_status: created.status })
          .eq('id', account.id);

        return NextResponse.json({
          success: true,
          action: 'created',
          subscription_id: created.id,
          status: created.status,
          new_price_id: newPriceId,
          plan: targetPlan.slug,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[change-plan] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    {
      rateLimit: 'strict',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
