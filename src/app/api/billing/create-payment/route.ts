import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabaseServer';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * Create One-Time Payment with Payment Method
 * 
 * POST /api/billing/create-payment
 * 
 * Creates a one-time payment for credits purchase
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const body = await req.json();
        const { paymentMethodId, customerId } = body;

        if (!paymentMethodId || !customerId) {
          return NextResponse.json(
            { error: 'Payment method ID and customer ID are required' },
            { status: 400 }
          );
        }

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

        // Verify customer belongs to user's account
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

        // Verify customer ID matches
        if (account.stripe_customer_id !== customerId) {
          return NextResponse.json(
            { error: 'Customer ID mismatch' },
            { status: 403 }
          );
        }

        // Get credits price ID from environment
        const creditsPriceId = process.env.STRIPE_CREDITS_PRICE_ID || 'price_1Ss5F5RxPcmTLDu9ygiUQpKw';

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });

        // Get price details to get amount
        const price = await stripe.prices.retrieve(creditsPriceId);
        const amount = price.unit_amount || 100; // Default to $1.00 if not found

        // Create payment intent for one-time payment
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          customer: customerId,
          payment_method: paymentMethodId,
          confirmation_method: 'manual',
          confirm: true,
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/billing?credits=success`,
        });

        // If payment requires action (3D Secure), return client secret
        if (paymentIntent.status === 'requires_action') {
          return NextResponse.json({
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
            requiresAction: true,
            clientSecret: paymentIntent.client_secret,
          });
        }

        // If payment succeeded, log to stripe_events
        if (paymentIntent.status === 'succeeded') {
          try {
            const serviceSupabase = createServiceClient();
            
            // Create synthetic event for one-time payment
            const eventId = `api_payment_${paymentIntent.id}_${Date.now()}`;
            
            const eventData = {
              id: eventId,
              type: 'payment_intent.succeeded',
              object: 'event',
              api_version: '2025-09-30.clover',
              created: Math.floor(Date.now() / 1000),
              data: {
                object: paymentIntent,
              },
              livemode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') || false,
            };

            const { error: eventError } = await (serviceSupabase as any)
              .from('stripe_events')
              .insert({
                stripe_event_id: eventId,
                event_type: 'payment_intent.succeeded',
                account_id: account.id,
                stripe_customer_id: customerId,
                event_data: eventData,
                processed: true,
                processed_at: new Date().toISOString(),
              });

            if (eventError) {
              if (process.env.NODE_ENV === 'development') {
                console.error('[create-payment] Failed to log to stripe_events:', eventError);
              }
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log('[create-payment] Payment logged to stripe_events:', {
                  eventId,
                  accountId: account.id,
                  paymentIntentId: paymentIntent.id,
                  customerId,
                });
              }
            }
          } catch (eventErr) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[create-payment] Error logging to stripe_events:', eventErr);
            }
          }
        }

        return NextResponse.json({
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          requiresAction: false,
        });
      } catch (error: any) {
        // Always log errors, but don't expose sensitive details in production
        if (process.env.NODE_ENV === 'development') {
          console.error('Error creating payment:', error);
        } else {
          console.error('Error creating payment:', error.message || 'Unknown error');
        }
        return NextResponse.json(
          { error: error.message || 'Failed to create payment' },
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
