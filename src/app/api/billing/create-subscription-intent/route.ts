import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';

/**
 * Create Subscription Setup Intent
 * 
 * POST /api/billing/create-subscription-intent
 * 
 * Creates a subscription with incomplete status and returns client secret
 * for Payment Element to collect payment method
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find their account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

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
          console.error('Error updating account with Stripe customer ID:', updateError);
          return NextResponse.json(
            { error: 'Failed to save customer ID' },
            { status: 500 }
          );
        }

        customerId = customer.id;
      } catch (error) {
        console.error('Error creating Stripe customer:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to create customer' },
          { status: 500 }
        );
      }
    }

    // Get price ID from environment
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { error: 'STRIPE_PRO_PRICE_ID environment variable is not configured' },
        { status: 500 }
      );
    }

    // Create subscription with incomplete status
    // This allows us to collect payment method first, then confirm
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        accountId: account.id,
        userId: user.id,
      },
    });

    // Get the payment intent client secret from the subscription
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error('Error creating subscription intent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription intent' },
      { status: 500 }
    );
  }
}
