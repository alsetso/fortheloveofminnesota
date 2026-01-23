import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * Update accounts table with subscription data
 */
async function updateAccountFromSubscription(
  customerId: string,
  subscription: Stripe.Subscription | null
): Promise<void> {
  const supabase = createServiceClient() as any;

  // Map Stripe subscription status to our subscription_status
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    unpaid: 'unpaid',
    paused: 'paused',
  };

  if (!subscription) {
    // No subscription - set to inactive
    const { error } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'inactive',
        stripe_subscription_id: null,
        plan: 'hobby',
        billing_mode: 'standard',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId);

    if (error) {
      throw new Error(`Failed to update account: ${error.message}`);
    }
    return;
  }

  // Determine plan and billing mode
  const plan = 'contributor'; // If they have a subscription, they're on contributor plan
  const billingMode = subscription.status === 'trialing' ? 'trial' : 'standard';
  const subscriptionStatus = statusMap[subscription.status] || subscription.status;

  const { error } = await supabase
    .from('accounts')
    .update({
      subscription_status: subscriptionStatus,
      stripe_subscription_id: subscription.id,
      plan: plan,
      billing_mode: billingMode,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    throw new Error(`Failed to update account: ${error.message}`);
  }
}

/**
 * Stripe webhook handler
 * 
 * Endpoint: POST /api/stripe/webhook
 * 
 * Security:
 * - Rate limited: 1000 requests/minute (webhook preset - Stripe sends bursts)
 * - Request size limit: 1MB
 * - Stripe signature verification (handled internally)
 * - No authentication required (Stripe verifies via signature)
 * 
 * Verifies webhook signature and processes Stripe events to sync subscription data.
 * Listens to subscription, invoice, and payment events.
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const body = await req.text();
        const sig = req.headers.get('stripe-signature');

        if (!sig) {
          return createErrorResponse('Missing stripe-signature header', 400);
        }

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          if (process.env.NODE_ENV === 'development') {
            console.error('STRIPE_WEBHOOK_SECRET is not configured');
          }
          return createErrorResponse('Webhook secret not configured', 500);
        }

        let event: Stripe.Event;

        try {
          // Verify webhook signature
          event = stripe.webhooks.constructEvent(
            body,
            sig,
            webhookSecret
          );
        } catch (err) {
          const error = err as Error;
          if (process.env.NODE_ENV === 'development') {
            console.error('Webhook signature verification failed:', error.message);
          }
          return createErrorResponse(`Webhook Error: ${error.message}`, 400);
        }

        // Log event to database immediately (before processing)
        const supabase = createServiceClient() as any;
        let eventRecordId: string | null = null;
        
        try {
          // Extract customer ID early for logging
          let customerIdForLog: string | null = null;
          let subscriptionIdForLog: string | null = null;
          
          // Quick extraction for logging purposes
          if (event.data.object && typeof event.data.object === 'object') {
            const obj = event.data.object as any;
            customerIdForLog = obj.customer || obj.customer_id || null;
            const subscriptionValue = obj.subscription || obj.subscription_id || null;
            
            // Handle string vs object types
            if (subscriptionValue && typeof subscriptionValue === 'object' && 'id' in subscriptionValue) {
              subscriptionIdForLog = (subscriptionValue as { id: string }).id || null;
            } else if (typeof subscriptionValue === 'string') {
              subscriptionIdForLog = subscriptionValue;
            }
          }

          // Insert event record
          const { data: eventRecord, error: logError } = await supabase
            .from('stripe_events')
            .insert({
              stripe_event_id: event.id,
              event_type: event.type,
              stripe_customer_id: customerIdForLog,
              stripe_subscription_id: subscriptionIdForLog,
              event_data: event as any,
              processed: false,
            })
            .select('id')
            .single();

          if (logError) {
            // Log error but don't fail the webhook - we still want to process it
            if (process.env.NODE_ENV === 'development') {
              console.error('Failed to log Stripe event to database:', logError);
            }
          } else {
            eventRecordId = eventRecord?.id || null;
            
            // Try to link to account if we have customer ID
            if (customerIdForLog && eventRecordId) {
              await supabase.rpc('link_stripe_event_to_account', {
                p_stripe_event_id: event.id,
                p_customer_id: customerIdForLog,
              });
            }
          }
        } catch (logErr) {
          // Don't fail webhook if logging fails
          if (process.env.NODE_ENV === 'development') {
            console.error('Error logging Stripe event:', logErr);
          }
        }

        // Handle typed events
        let customerId: string | null = null;
        let subscription: Stripe.Subscription | null = null;

        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            customerId = session.customer as string | null;
            
            // Handle subscription checkout
            if (session.subscription) {
              const subId = typeof session.subscription === 'string' 
                ? session.subscription 
                : session.subscription.id;
              subscription = await stripe.subscriptions.retrieve(subId);
            }
            // For one-time payments (mode: 'payment'), subscription will be null
            // The event is still logged to stripe_events for tracking
            break;
          }

          case 'customer.subscription.created':
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            subscription = event.data.object as Stripe.Subscription;
            customerId = subscription.customer as string | null;
            
            // For deleted subscriptions, set subscription to null
            if (event.type === 'customer.subscription.deleted') {
              subscription = null;
            }
            break;
          }

          case 'customer.subscription.paused':
          case 'customer.subscription.resumed':
          case 'customer.subscription.pending_update_applied':
          case 'customer.subscription.pending_update_expired':
          case 'customer.subscription.trial_will_end': {
            subscription = event.data.object as Stripe.Subscription;
            customerId = subscription.customer as string | null;
            break;
          }

          case 'invoice.paid':
          case 'invoice.payment_failed':
          case 'invoice.payment_action_required':
          case 'invoice.upcoming':
          case 'invoice.marked_uncollectible':
          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice;
            customerId = invoice.customer as string | null;
            
            // If invoice has a subscription, fetch it
            const subscriptionId = (invoice as any).subscription;
            if (subscriptionId) {
              const subId = typeof subscriptionId === 'string' 
                ? subscriptionId 
                : (subscriptionId as Stripe.Subscription).id;
              subscription = await stripe.subscriptions.retrieve(subId);
            }
            break;
          }

          case 'payment_intent.succeeded':
          case 'payment_intent.payment_failed':
          case 'payment_intent.canceled': {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            customerId = paymentIntent.customer as string | null;
            break;
          }

          default:
            if (process.env.NODE_ENV === 'development') {
              console.log(`Ignoring unhandled event type: ${event.type}`);
            }
            
            // Still mark as processed (we received it, just don't handle it)
            if (eventRecordId) {
              await supabase
                .from('stripe_events')
                .update({
                  processed: true,
                  processed_at: new Date().toISOString(),
                  processing_error: 'Event type not handled',
                })
                .eq('id', eventRecordId);
            }
            
            return createSuccessResponse({ received: true, handled: false });
        }

        if (!customerId) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Could not extract customer ID from event: ${event.type}`);
          }
          
          // Mark event as unprocessable
          if (eventRecordId) {
            await supabase
              .from('stripe_events')
              .update({
                processed: false,
                processing_error: 'No customer ID found in event',
              })
              .eq('id', eventRecordId);
          }
          
          return createSuccessResponse({ 
            received: true, 
            synced: false, 
            reason: 'no_customer_id' 
          });
        }

        try {
          // Update accounts table with subscription data
          await updateAccountFromSubscription(customerId, subscription);
          
          // Mark event as processed successfully
          if (eventRecordId) {
            await supabase
              .from('stripe_events')
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
              })
              .eq('id', eventRecordId);
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Updated account for customer ${customerId} (event: ${event.type})`);
          }
          
          return createSuccessResponse({ 
            received: true, 
            handled: true, 
            event_type: event.type,
            customer_id: customerId,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (process.env.NODE_ENV === 'development') {
            console.error(`❌ Error updating account for customer ${customerId}:`, error);
          }
          
          // Mark event as failed with error message
          if (eventRecordId) {
            await supabase
              .from('stripe_events')
              .update({
                processed: false,
                processing_error: errorMessage,
                retry_count: 1,
                last_retry_at: new Date().toISOString(),
              })
              .eq('id', eventRecordId);
          }
          
          // Return 200 to Stripe to prevent retries for non-retryable errors
          return createSuccessResponse({ 
            received: true, 
            handled: false, 
            error: errorMessage,
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Webhook handler error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'webhook', // Higher limit for webhook bursts
      requireAuth: false, // Stripe verifies via signature
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

// Route configuration
export const runtime = 'nodejs';

// Disable body parsing - we need raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

