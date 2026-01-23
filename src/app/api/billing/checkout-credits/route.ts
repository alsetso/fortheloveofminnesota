import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * Create Stripe Checkout Session for One-Time Credits Purchase
 * 
 * POST /api/billing/checkout-credits
 * 
 * Creates a Stripe checkout session for a one-time purchase of credits
 * 
 * Security:
 * - Rate limited: 60 requests/minute (strict)
 * - Request size limit: 1MB
 * - Requires authentication
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

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || user.id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        // Get active account ID from cookie
        const activeAccountIdCookie = request.cookies.get('active_account_id');
        const activeAccountId = activeAccountIdCookie?.value || null;

        let account;
        if (activeAccountId) {
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('id', activeAccountId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (error || !data) {
            return NextResponse.json(
              { error: 'Account not found' },
              { status: 404 }
            );
          }
          account = data;
        } else {
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          
          if (error || !data) {
            return NextResponse.json(
              { error: 'Account not found' },
              { status: 404 }
            );
          }
          account = data;
        }

        // Ensure Stripe customer exists
        let customerId = account.stripe_customer_id;

        if (!customerId) {
          try {
            if (!user.email) {
              return NextResponse.json(
                { error: 'User email is required' },
                { status: 400 }
              );
            }

            const customer = await stripe.customers.create({
              email: user.email,
              metadata: {
                userId: user.id,
                accountId: account.id,
              },
            });

            customerId = customer.id;

            const { error: updateError } = await supabase
              .from('accounts')
              .update({ stripe_customer_id: customer.id })
              .eq('id', account.id);

            if (updateError) {
              return NextResponse.json(
                { error: 'Failed to save customer ID' },
                { status: 500 }
              );
            }
          } catch (error) {
            console.error('Error creating Stripe customer:', error);
            return NextResponse.json(
              { error: 'Failed to create customer' },
              { status: 500 }
            );
          }
        }

        // Credits price ID from environment or use provided one
        const creditsPriceId = process.env.STRIPE_CREDITS_PRICE_ID || 'price_1Ss5F5RxPcmTLDu9ygiUQpKw';
        
        // Get base URL for success/cancel redirects
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const successUrl = `${baseUrl}/billing?credits=success`;
        const cancelUrl = `${baseUrl}/billing?credits=canceled`;

        // Create checkout session for one-time payment
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'payment', // One-time payment, not subscription
          line_items: [
            {
              price: creditsPriceId,
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            accountId: account.id,
            userId: user.id,
            purchaseType: 'credits',
          },
        });

        if (!session.url) {
          return NextResponse.json(
            { error: 'Failed to create checkout session URL' },
            { status: 500 }
          );
        }

        // Log checkout session creation to stripe_events table
        try {
          const serviceSupabase = createServiceClient();
          
          const eventId = `checkout_credits_${session.id}`;
          
          const { error: eventError } = await (serviceSupabase as any)
            .from('stripe_events')
            .insert({
              stripe_event_id: eventId,
              event_type: 'checkout.session.created',
              account_id: account.id,
              stripe_customer_id: customerId,
              event_data: {
                id: eventId,
                type: 'checkout.session.created',
                object: 'event',
                created: Math.floor(Date.now() / 1000),
                data: {
                  object: session,
                },
                livemode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') || false,
              },
              processed: false, // Will be processed when payment succeeds via webhook
            });

          if (eventError) {
            console.error('[checkout-credits] Failed to log to stripe_events:', eventError);
            // Don't fail the request - checkout URL is more important
          } else {
            console.log('[checkout-credits] Checkout event logged to stripe_events:', {
              eventId,
              sessionId: session.id,
              accountId: account.id,
              customerId,
            });
          }
        } catch (error) {
          console.error('[checkout-credits] Error logging to stripe_events:', error);
          // Don't fail the request
        }

        return NextResponse.json({
          url: session.url,
        });
      } catch (error: any) {
        console.error('Error creating credits checkout session:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to create checkout session' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
