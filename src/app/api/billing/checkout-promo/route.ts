import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import type { BillingPlan } from '@/lib/billing/types';

/**
 * Create Stripe Checkout Session with Promo Code
 * 
 * POST /api/billing/checkout-promo
 * 
 * Creates a Stripe checkout session with a specific promotion code applied
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
        // We need to get user email for Stripe, but userId is already validated
        // Get user email from Supabase auth (we still need the email, but don't need to verify auth)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          return NextResponse.json(
            { error: 'Failed to fetch user data' },
            { status: 500 }
          );
        }

        // Ensure user has an email (required for Stripe customer creation)
        if (!user.email) {
          return NextResponse.json(
            { error: 'User email is required for checkout' },
            { status: 400 }
          );
        }

        // No promo code needed - direct Contributor subscription checkout

        // Get active account ID from cookie (set by client when switching accounts)
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
          console.error('Error fetching account:', accountError);
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

        // Ensure Stripe customer exists and is saved to Supabase
        let customerId = account.stripe_customer_id;

        // If customer ID exists, verify it's valid in Stripe
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (customer.deleted) {
              customerId = null;
            }
          } catch {
            customerId = null;
          }
        }

        // Create customer if it doesn't exist
        // NOTE: User authentication is already verified above - this is safe
        if (!customerId) {
          try {
            // Step 1: Create Stripe customer (user.email is guaranteed to exist from check above)
            const customer = await stripe.customers.create({
              email: user.email,
              metadata: {
                userId: user.id,
                accountId: account.id,
              },
            });

            customerId = customer.id;

            // Step 2: Save customer ID to Supabase BEFORE creating checkout
            const { error: updateError } = await supabase
              .from('accounts')
              .update({ stripe_customer_id: customer.id })
              .eq('id', account.id);

            if (updateError) {
              console.error('[checkout-promo] Error updating account with Stripe customer ID:', updateError);
              // Customer was created in Stripe but failed to save to Supabase
              // This is a critical error - we have an orphaned customer
              return NextResponse.json(
                { error: 'Failed to save customer ID to database' },
                { status: 500 }
              );
            }

            // Step 3: Verify the save was successful by re-fetching
            const { data: verifyAccount, error: verifyError } = await supabase
              .from('accounts')
              .select('stripe_customer_id')
              .eq('id', account.id)
              .single();

            if (verifyError || !verifyAccount || verifyAccount.stripe_customer_id !== customerId) {
              console.error('[checkout-promo] Failed to verify customer ID was saved:', {
                verifyError,
                verifyAccount,
                expectedCustomerId: customerId,
                actualCustomerId: verifyAccount?.stripe_customer_id,
              });
              return NextResponse.json(
                { error: 'Failed to verify customer ID was saved' },
                { status: 500 }
              );
            }

            // Customer ID is now guaranteed to be saved in Supabase
          } catch (error) {
            console.error('[checkout-promo] Error creating Stripe customer:', error);
            return NextResponse.json(
              { error: error instanceof Error ? error.message : 'Failed to create customer' },
              { status: 500 }
            );
          }
        }

        // At this point, customerId is guaranteed to exist and be saved in Supabase

        // Get plan and billing period from request body
        const body = await req.json().catch(() => ({}));
        const planSlug = body.plan || 'contributor';
        const billingPeriod = body.period || 'monthly';
        
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

        // Create checkout session for Contributor subscription (no discounts)
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
          billing_address_collection: 'auto',
          allow_promotion_codes: true, // Allow users to enter promo codes manually if they have one
          metadata: {
            accountId: account.id,
            userId: user.id,
            planSlug: planSlug,
            billingPeriod: billingPeriod,
          },
        });

        if (!session.url) {
          return NextResponse.json(
            { error: 'Failed to create checkout session URL' },
            { status: 500 }
          );
        }

        // Log checkout session creation to stripe_events table
        // Use service client to bypass RLS (similar to webhook handler)
        try {
          const serviceSupabase = await createServiceClient();
          
          // Use checkout session ID as event identifier (prefixed to distinguish from webhook events)
          const eventId = `checkout_${session.id}`;
          
          const { error: eventError } = await (serviceSupabase as any)
            .from('stripe_events')
            .insert({
              stripe_event_id: eventId,
              event_type: 'checkout.session.created',
              account_id: account.id,
              stripe_customer_id: customerId,
              event_data: session,
              processed: true, // Mark as processed since we're just tracking initiation
            });

          if (eventError) {
            // Log error but don't fail the request - checkout URL is more important
            if (process.env.NODE_ENV === 'development') {
              console.error('[checkout-promo] Failed to log checkout event:', eventError);
            }
          }
        } catch (error) {
          // Don't fail the request if event logging fails
          if (process.env.NODE_ENV === 'development') {
            console.error('[checkout-promo] Error logging checkout event:', error);
          }
        }

        return NextResponse.json({
          url: session.url,
        });
      } catch (error: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[checkout-promo] Error creating checkout session with promo:', error);
        }

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
          if (error.code === 'resource_missing' && error.param?.includes('coupon')) {
            return NextResponse.json(
              { 
                error: 'Promo code not found',
                message: `The promo code "${error.param}" does not exist in Stripe. Please create it in your Stripe dashboard.`,
                details: error.message,
              },
              { status: 400 }
            );
          }
        }

        return NextResponse.json(
          { 
            error: 'Failed to create checkout session',
            message: error.message || 'An error occurred while creating the checkout session',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
          },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict', // 60 requests/minute - prevent abuse of payment endpoint
      requireAuth: true, // REQUIRED: Must be authenticated to create checkout or save customer ID
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
