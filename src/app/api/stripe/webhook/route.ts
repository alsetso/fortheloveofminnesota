import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * Get plan slug from Stripe price ID by querying billing.plans table
 */
async function getPlanSlugFromPriceId(priceId: string | null): Promise<string | null> {
  if (!priceId) return null;
  
  const supabase = createServiceClient() as any;
  
  // Query billing.plans to find plan with matching price_id
  // Note: RPC function is in billing schema but called without schema prefix
  const { data, error } = await supabase
    .rpc('get_plan_slug_from_price_id', { p_price_id: priceId });
  
  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`Failed to lookup plan for price_id ${priceId}:`, error);
    }
    // Log to console in production for debugging
    console.error(`[WEBHOOK] RPC error for price_id ${priceId}:`, error.message);
    return null;
  }
  
  return data || null;
}

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
    // No subscription - delete subscription record and set account to inactive
    const { error: deleteSubError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('stripe_customer_id', customerId);

    if (deleteSubError && process.env.NODE_ENV === 'development') {
      console.warn('Failed to delete subscription record:', deleteSubError);
    }

    const { error } = await supabase
      .from('accounts')
      .update({
        subscription_status: 'inactive',
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

  // Get price_id from subscription (first line item)
  const priceId = subscription.items.data[0]?.price.id || null;
  
  // Validate price_id exists (should always be present for valid subscriptions)
  if (!priceId) {
    throw new Error(`Subscription ${subscription.id} has no price_id - invalid subscription data`);
  }
  
  // Map price_id to plan slug using billing.plans table
  let planSlug: string | null = null;
  planSlug = await getPlanSlugFromPriceId(priceId);
  
  // Fallback to 'hobby' if no plan found (shouldn't happen for valid subscriptions)
  // This could happen if price_id doesn't match any plan in billing.plans
  const plan = planSlug || 'hobby';
  const billingMode = subscription.status === 'trialing' ? 'trial' : 'standard';
  const subscriptionStatus = statusMap[subscription.status] || subscription.status;

  // Get payment method details if available
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  
  if (subscription.default_payment_method) {
    try {
      const paymentMethod = typeof subscription.default_payment_method === 'string'
        ? await stripe.paymentMethods.retrieve(subscription.default_payment_method)
        : subscription.default_payment_method;
      
      if (paymentMethod && paymentMethod.type === 'card' && paymentMethod.card) {
        cardBrand = paymentMethod.card.brand || null;
        cardLast4 = paymentMethod.card.last4 || null;
      }
    } catch (error) {
      // Payment method retrieval failed - continue without card info
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to retrieve payment method details:', error);
      }
    }
  }

  // Convert Unix timestamps to ISO strings
  // TypeScript assertion: subscription is non-null at this point due to early return above
  const sub = subscription as Stripe.Subscription & {
    current_period_start: number;
    current_period_end: number;
  };
  const currentPeriodStart = new Date(sub.current_period_start * 1000).toISOString();
  const currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
  const trialEndDate = sub.trial_end 
    ? new Date(sub.trial_end * 1000).toISOString() 
    : null;

  // Upsert subscription data to subscriptions table
  // Note: price_id is validated above, so it's guaranteed to be non-null here
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        stripe_customer_id: customerId,
        subscription_id: sub.id,
        status: sub.status,
        price_id: priceId, // Guaranteed non-null after validation above
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        trial_end_date: trialEndDate,
        cancel_at_period_end: sub.cancel_at_period_end || false,
        card_brand: cardBrand,
        card_last4: cardLast4,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'stripe_customer_id',
      }
    );

  if (subscriptionError) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to update subscriptions table:', subscriptionError);
    }
    // Don't throw - accounts update is more critical
  }

  // Verify account exists before updating
  const { data: existingAccount, error: checkError } = await supabase
    .from('accounts')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (checkError || !existingAccount) {
    // Account doesn't exist - log warning but don't fail webhook
    // This could happen if Stripe has a customer we don't know about
    if (process.env.NODE_ENV === 'development') {
      console.warn(`No account found for Stripe customer ${customerId} - skipping account update`);
    }
    // Still update subscriptions table if we have valid subscription data
    return;
  }

  // Update accounts table
  const { error } = await supabase
    .from('accounts')
    .update({
      subscription_status: subscriptionStatus,
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
  // Bypass withSecurity for webhook - it needs raw body and no auth checks
  // Stripe verifies via signature, not auth
  try {
    // Check request size manually (don't use withSecurity)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > REQUEST_SIZE_LIMITS.json) {
      return createErrorResponse(
        `Request body exceeds maximum size of ${REQUEST_SIZE_LIMITS.json / 1024 / 1024}MB`,
        413
      );
    }

    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

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

      // Check if event already exists (handle duplicate Stripe events)
      const { data: existingEvent } = await supabase
        .from('stripe_events')
        .select('id')
        .eq('stripe_event_id', event.id)
        .single();

      if (existingEvent) {
        // Event already logged - use existing record ID
        eventRecordId = existingEvent.id;
      } else {
        // Insert new event record
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
          // Always log errors (not just in development) for production debugging
          console.error('[WEBHOOK] Failed to log Stripe event to database:', {
            error: logError,
            event_id: event.id,
            event_type: event.type,
            customer_id: customerIdForLog,
            subscription_id: subscriptionIdForLog,
          });
        } else {
          eventRecordId = eventRecord?.id || null;
        }
      }
      
      // Try to link to account if we have customer ID and event record
      if (customerIdForLog && eventRecordId) {
        try {
          await supabase.rpc('link_stripe_event_to_account', {
            p_stripe_event_id: event.id,
            p_customer_id: customerIdForLog,
          });
        } catch (linkError) {
          // Log but don't fail - linking is optional
          console.error('[WEBHOOK] Failed to link event to account:', linkError);
        }
      }
    } catch (logErr) {
      // Always log errors for production debugging
      const errorMessage = logErr instanceof Error ? logErr.message : 'Unknown error';
      console.error('[WEBHOOK] Error logging Stripe event:', {
        error: errorMessage,
        event_id: event.id,
        event_type: event.type,
      });
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Always log errors for debugging
    console.error('[WEBHOOK] Unhandled error:', errorMessage);
    if (errorStack) {
      console.error('[WEBHOOK] Stack:', errorStack);
    }
    
    // Return 200 to Stripe to prevent retries for unexpected errors
    // Log the error to stripe_events if possible
    return createSuccessResponse({ 
      received: true, 
      handled: false, 
      error: errorMessage 
    });
  }
}

// Route configuration
export const runtime = 'nodejs';

// Disable body parsing - we need raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

