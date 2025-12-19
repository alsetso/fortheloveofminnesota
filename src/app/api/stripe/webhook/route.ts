import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Update accounts table with subscription data
 */
async function updateAccountFromSubscription(
  customerId: string,
  subscription: Stripe.Subscription | null
): Promise<void> {
  const supabase = createServiceClient();

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
  const plan = 'pro'; // If they have a subscription, they're on pro plan
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
 * Verifies webhook signature and processes Stripe events to sync subscription data.
 * Listens to subscription, invoice, and payment events.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
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
      console.error('Webhook signature verification failed:', error.message);
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      );
    }

    // Handle typed events
    let customerId: string | null = null;
    let subscription: Stripe.Subscription | null = null;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        customerId = session.customer as string | null;
        
        if (session.subscription) {
          const subId = typeof session.subscription === 'string' 
            ? session.subscription 
            : session.subscription.id;
          subscription = await stripe.subscriptions.retrieve(subId);
        }
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
        // invoice.subscription can be a string (subscription ID) or Subscription object
        const subscriptionId = invoice.subscription;
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
        
        // Payment intents don't directly have subscriptions, but we can update account status
        // For now, we'll just sync if customer exists
        break;
      }

      default:
        console.log(`Ignoring unhandled event type: ${event.type}`);
        return NextResponse.json({ received: true, handled: false });
    }

    if (!customerId) {
      console.warn(`Could not extract customer ID from event: ${event.type}`);
      return NextResponse.json({ 
        received: true, 
        synced: false, 
        reason: 'no_customer_id' 
      });
    }

    try {
      // Update accounts table with subscription data
      await updateAccountFromSubscription(customerId, subscription);
      
      console.log(`✅ Updated account for customer ${customerId} (event: ${event.type})`);
      
      return NextResponse.json({ 
        received: true, 
        handled: true, 
        event_type: event.type,
        customer_id: customerId,
      });
    } catch (error) {
      console.error(`❌ Error updating account for customer ${customerId}:`, error);
      
      // Return 200 to Stripe to prevent retries for non-retryable errors
      return NextResponse.json({ 
        received: true, 
        handled: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Route configuration
export const runtime = 'nodejs';

// Disable body parsing - we need raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

