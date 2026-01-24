import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { z } from 'zod';
import type { BillingPlan } from '@/lib/billing/types';

/**
 * Create Stripe Checkout Session
 * 
 * POST /api/billing/checkout
 * 
 * Creates a Stripe checkout session and returns the payment URL
 * 
 * Security:
 * - Rate limited: 60 requests/minute (strict) - prevent abuse
 * - Request size limit: 1MB
 * - Requires authentication
 * - Sensitive operation - payment processing
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
            },
          },
        );

        // userId is guaranteed from security middleware
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || user.id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

    // Get active account ID from cookie (set by client when switching accounts)
    // This ensures we use the account the user has selected, not just any account
    const activeAccountIdCookie = request.cookies.get('active_account_id');
    const activeAccountId = activeAccountIdCookie?.value || null;

    let account, accountError;
    
    if (activeAccountId) {
      // Verify the active account belongs to this user before using it
      const { data, error } = await supabase
        .from('accounts')
        .select('id, stripe_customer_id')
        .eq('id', activeAccountId)
        .eq('user_id', user.id)
        .maybeSingle();
      account = data;
      accountError = error;
    } else {
      // Fallback to first account if no active account ID in cookie
      const { data, error } = await supabase
        .from('accounts')
        .select('id, stripe_customer_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      account = data;
      accountError = error;
    }

    if (accountError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching account:', accountError);
      }
      return NextResponse.json(
        { error: 'Failed to fetch account data' },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found. Please complete your account setup first.' },
        { status: 404 }
      );
    }

    // Ensure Stripe customer exists
    let customerId = account.stripe_customer_id;

    if (!customerId) {
      try {
        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            userId: user.id,
            accountId: account.id,
          },
        });

        // Save customer ID to accounts table
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ stripe_customer_id: customer.id })
          .eq('id', account.id);

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error updating account with Stripe customer ID:', updateError);
          }
          return NextResponse.json(
            { error: 'Failed to save customer ID' },
            { status: 500 }
          );
        }

        customerId = customer.id;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error creating Stripe customer:', error);
        }
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to create customer' },
          { status: 500 }
        );
      }
    }

    // Get plan and billing period from request body
    const body = await req.json().catch(() => ({}));
    const planSlug = body.plan || 'contributor'; // Default to contributor for backward compatibility
    const billingPeriod = body.period || 'monthly'; // 'monthly' or 'yearly'
    
    // Fetch plan from database to get price ID
    const supabaseWithAuth = await createServerClientWithAuth(cookies());
    const { data: plan, error: planError } = await supabaseWithAuth
      .from('billing_plans')
      .select('stripe_price_id_monthly, stripe_price_id_yearly, slug, name')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .maybeSingle()
      .returns<Pick<BillingPlan, 'stripe_price_id_monthly' | 'stripe_price_id_yearly' | 'slug' | 'name'>>();
    
    if (planError || !plan) {
      return NextResponse.json(
        { error: `Plan '${planSlug}' not found or inactive` },
        { status: 404 }
      );
    }
    
    // Get the appropriate price ID based on billing period
    const priceId = billingPeriod === 'yearly' 
      ? plan.stripe_price_id_yearly 
      : plan.stripe_price_id_monthly;
    
    if (!priceId) {
      return NextResponse.json(
        { 
          error: `Price ID not configured for ${plan.name} (${billingPeriod})`,
          plan: planSlug,
          period: billingPeriod,
        },
        { status: 400 }
      );
    }

    // Get base URL for success/cancel redirects
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/?upgrade=success`;
    const cancelUrl = `${baseUrl}/?upgrade=canceled`;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        accountId: account.id,
        userId: user.id,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session URL' },
        { status: 500 }
      );
    }

        return NextResponse.json({
          url: session.url,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error creating checkout session:', error);
        }
        return NextResponse.json(
          { error: 'Failed to create checkout session' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict', // 10 requests/minute - prevent abuse of payment endpoint
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
