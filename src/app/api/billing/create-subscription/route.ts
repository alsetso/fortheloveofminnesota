import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient, createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import type { BillingPlan } from '@/lib/billing/types';

/**
 * Create Subscription with Payment Method
 * 
 * POST /api/billing/create-subscription
 * 
 * Attaches payment method to customer and creates subscription
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const body = await req.json();
        const { paymentMethodId, customerId, plan: planSlug = 'contributor', period: billingPeriod = 'monthly' } = body;

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

        // userId and accountId are guaranteed from security middleware
        // Use accountId from context (already validated)
        let account;
        if (accountId) {
          // Verify the account belongs to this user (defensive check)
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('id', accountId)
            .eq('user_id', userId)
            .maybeSingle();
          
          if (error || !data) {
            return NextResponse.json(
              { error: 'Account not found' },
              { status: 404 }
            );
          }
          account = data;
        } else {
          // Fallback to first account
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('user_id', userId)
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

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });

        // Set as default payment method
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        // Create subscription with immediate payment
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [
            {
              price: priceId,
            },
          ],
          default_payment_method: paymentMethodId,
          expand: ['latest_invoice.payment_intent'],
        });

        // Log subscription creation for debugging (dev only)
        if (process.env.NODE_ENV === 'development') {
          console.log('[create-subscription] Subscription created:', {
            subscriptionId: subscription.id,
            status: subscription.status,
            customerId: customerId,
          });
        }

        // Check invoice and payment status
        const invoice = subscription.latest_invoice;
        let requiresAction = false;
        let clientSecret = null;
        let paymentStatus = 'unknown';

        if (invoice && typeof invoice === 'object') {
          // Retrieve full invoice to check status
          const fullInvoice = typeof invoice === 'string' 
            ? await stripe.invoices.retrieve(invoice)
            : invoice;

          if (process.env.NODE_ENV === 'development') {
            console.log('[create-subscription] Invoice status:', {
              invoiceId: fullInvoice.id,
              status: fullInvoice.status,
              paymentIntent: (fullInvoice as any).payment_intent,
            });
          }

          const paymentIntentValue = (fullInvoice as any).payment_intent;
          if (paymentIntentValue) {
            const paymentIntentId = typeof paymentIntentValue === 'string' 
              ? paymentIntentValue 
              : paymentIntentValue.id;
            
            if (paymentIntentId) {
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                paymentStatus = paymentIntent.status;
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('[create-subscription] Payment intent status:', {
                    paymentIntentId,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount,
                  });
                }
                
                // If payment requires confirmation, confirm it
                if (paymentIntent.status === 'requires_confirmation') {
                  const confirmed = await stripe.paymentIntents.confirm(paymentIntentId);
                  paymentStatus = confirmed.status;
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[create-subscription] Payment confirmed, new status:', confirmed.status);
                  }
                }
                
                // If payment requires action (3D Secure), return client secret
                if (paymentIntent.status === 'requires_action') {
                  requiresAction = true;
                  clientSecret = paymentIntent.client_secret;
                }
              } catch (error: any) {
                console.error('[create-subscription] Error processing payment intent:', error);
                throw new Error(`Payment processing failed: ${error.message}`);
              }
            }
          }
        }

        // If subscription is incomplete, there was a payment issue
        if (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired') {
          console.error('[create-subscription] Subscription is incomplete:', {
            subscriptionId: subscription.id,
            status: subscription.status,
            paymentStatus,
          });
          return NextResponse.json(
            { 
              error: 'Payment failed. Please check your card details and try again.',
              subscriptionId: subscription.id,
              status: subscription.status,
            },
            { status: 402 } // Payment Required
          );
        }

        // Immediately update account status in database (don't wait for webhook)
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          try {
            const { error: updateError } = await supabase
              .from('accounts')
              .update({
                subscription_status: subscription.status === 'trialing' ? 'trialing' : 'active',
                plan: planSlug,
                billing_mode: subscription.status === 'trialing' ? 'trial' : 'standard',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_customer_id', customerId);

            if (updateError) {
              console.error('[create-subscription] Failed to update account status:', updateError);
              // Don't fail the request - webhook will update it
            } else {
              if (process.env.NODE_ENV === 'development') {
                console.log('[create-subscription] Account status updated immediately:', {
                  customerId,
                  subscriptionId: subscription.id,
                  status: subscription.status,
                  accountId: account.id,
                });
              }

              // Log successful payment to stripe_events table
              // This ensures we have a record even if webhook doesn't fire
              try {
                const serviceSupabase = createServiceClient();
                
                // Create a synthetic event ID for direct API payments (not from webhook)
                const eventId = `api_subscription_${subscription.id}_${Date.now()}`;
                
                // Create event data similar to Stripe webhook format
                const eventData = {
                  id: eventId,
                  type: 'customer.subscription.created',
                  object: 'event',
                  api_version: '2025-09-30.clover',
                  created: Math.floor(Date.now() / 1000),
                  data: {
                    object: subscription,
                  },
                  livemode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') || false,
                };

                const { error: eventError } = await (serviceSupabase as any)
                  .from('stripe_events')
                  .insert({
                    stripe_event_id: eventId,
                    event_type: 'customer.subscription.created',
                    account_id: account.id,
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscription.id,
                    event_data: eventData,
                    processed: true, // Mark as processed since we're updating account immediately
                    processed_at: new Date().toISOString(),
                  });

                if (eventError) {
                  console.error('[create-subscription] Failed to log to stripe_events:', eventError);
                  // Don't fail the request - account is already updated
                } else {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[create-subscription] Payment logged to stripe_events:', {
                      eventId,
                      accountId: account.id,
                      subscriptionId: subscription.id,
                      customerId,
                    });
                  }
                }
              } catch (eventErr) {
                console.error('[create-subscription] Error logging to stripe_events:', eventErr);
                // Don't fail the request - account is already updated
              }
            }
          } catch (updateErr) {
            console.error('[create-subscription] Error updating account:', updateErr);
            // Don't fail the request - webhook will update it
          }
        }

        return NextResponse.json({
          subscriptionId: subscription.id,
          status: subscription.status,
          requiresAction,
          clientSecret,
          paymentStatus,
        });
      } catch (error: any) {
        // Always log errors, but don't expose sensitive details in production
        if (process.env.NODE_ENV === 'development') {
          console.error('Error creating subscription:', error);
        } else {
          console.error('Error creating subscription:', error.message || 'Unknown error');
        }
        return NextResponse.json(
          { error: error.message || 'Failed to create subscription' },
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
