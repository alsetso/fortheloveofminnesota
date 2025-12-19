import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';

/**
 * Update account plan and billing mode in database
 */
async function updateAccountPlan(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  updates: {
    plan?: 'hobby' | 'pro' | 'plus';
    billing_mode?: 'standard' | 'trial';
  }
) {
  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating account plan:', error);
    throw new Error(`Failed to update account plan: ${error.message}`);
  }
}

/**
 * Create a subscription after payment succeeds
 * POST /api/billing/create-subscription
 * Body: { payment_intent_id: string, payment_method_id: string }
 */
export async function POST(request: NextRequest) {
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

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { payment_intent_id, payment_method_id } = await request.json();

    if (!payment_intent_id || !payment_method_id) {
      return NextResponse.json(
        { error: 'Missing payment_intent_id or payment_method_id' },
        { status: 400 }
      );
    }

    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    // Get customer ID
    const { data: account } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!account?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Set payment method as default
    await stripe.customers.update(account.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    // Create subscription
    // Note: You'll need to create a Price in Stripe Dashboard and use its ID here
    // For now, using a monthly $20 subscription
    const priceId = process.env.STRIPE_PRO_PRICE_ID; // Set this in your .env

    if (!priceId) {
      // If no price ID is configured, just attach the payment method and return success
      // The subscription can be created manually or via webhook
      // This allows the payment to succeed even without a price ID configured
      return NextResponse.json({
        subscription_id: null,
        status: 'payment_method_attached',
        message: 'Payment method attached. Subscription will be created separately.',
      });
    }

    // Check if subscription already exists
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: account.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (existingSubscriptions.data.length > 0) {
      return NextResponse.json({
        subscription_id: existingSubscriptions.data[0].id,
        status: existingSubscriptions.data[0].status,
        message: 'Subscription already exists',
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: account.stripe_customer_id,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Update account plan and billing mode
    await updateAccountPlan(supabase, user.id, {
      plan: 'pro',
      billing_mode: subscription.status === 'trialing' ? 'trial' : 'standard',
    });

    return NextResponse.json({
      subscription_id: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

