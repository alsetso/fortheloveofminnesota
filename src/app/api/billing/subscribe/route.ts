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
 * Create a subscription with existing payment method or return PaymentIntent for new payment method
 * POST /api/billing/subscribe
 * Body: { payment_method_id?: string } - optional, if provided, creates subscription directly
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

    // Get account data
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
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

    let customerId = account.stripe_customer_id;

    // Create Stripe customer if it doesn't exist
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            userId: user.id,
          },
        });

        // Save customer ID to accounts table
        const { error: updateError } = await supabase
          .from('accounts')
          .update({ stripe_customer_id: customer.id })
          .eq('user_id', user.id);

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

    // Check if user already has an active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      return NextResponse.json(
        { error: 'You already have an active subscription' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json().catch(() => ({}));
    const { payment_method_id } = body;

    // If payment method ID is provided, create subscription directly
    if (payment_method_id) {
      // Verify payment method belongs to customer
      const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);
      
      if (paymentMethod.customer !== customerId) {
        return NextResponse.json(
          { error: 'Payment method does not belong to this customer' },
          { status: 400 }
        );
      }

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });

      // Create subscription with price ID if configured
      const priceId = process.env.STRIPE_PRO_PRICE_ID;
      
      if (priceId) {
        try {
          const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: {
              payment_method_types: ['card'],
              save_default_payment_method: 'on_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
          });

          // Map Stripe subscription status to our subscription_status
          const statusMap: Record<string, 'active' | 'past_due' | 'canceled' | 'trialing' | 'inactive'> = {
            'active': 'active',
            'past_due': 'past_due',
            'canceled': 'canceled',
            'trialing': 'trialing',
            'incomplete': 'inactive',
            'incomplete_expired': 'inactive',
            'unpaid': 'inactive',
          };

          // Update account plan and billing mode
          await updateAccountPlan(supabase, user.id, {
            plan: 'pro',
            billing_mode: subscription.status === 'trialing' ? 'trial' : 'standard',
          });

          return NextResponse.json({
            subscription_id: subscription.id,
            status: subscription.status,
            requires_payment: subscription.status === 'incomplete',
            client_secret: subscription.latest_invoice && 
              typeof subscription.latest_invoice === 'object' &&
              'payment_intent' in subscription.latest_invoice &&
              subscription.latest_invoice.payment_intent &&
              typeof subscription.latest_invoice.payment_intent === 'object' &&
              'client_secret' in subscription.latest_invoice.payment_intent
              ? String(subscription.latest_invoice.payment_intent.client_secret)
              : null,
          });
        } catch (error) {
          console.error('Error creating subscription:', error);
          return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create subscription' },
            { status: 500 }
          );
        }
      } else {
        // No price ID configured - update account to pro plan
        await updateAccountPlan(supabase, user.id, {
          plan: 'pro',
          billing_mode: 'standard',
        });

        return NextResponse.json({
          subscription_id: null,
          status: 'payment_method_ready',
          message: 'Payment method ready. Subscription will be created separately.',
        });
      }
    }

    // No payment method provided - create PaymentIntent for new payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 2000,
      currency: 'usd',
      customer: customerId,
      setup_future_usage: 'off_session',
      metadata: {
        userId: user.id,
        type: 'pro_subscription',
      },
    });

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      customer_id: customerId,
      requires_new_payment_method: true,
    });
  } catch (error) {
    console.error('Error creating subscription payment intent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription payment' },
      { status: 500 }
    );
  }
}

