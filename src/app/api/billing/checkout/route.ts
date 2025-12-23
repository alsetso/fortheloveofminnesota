import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';

/**
 * Create Stripe Checkout Session
 * 
 * POST /api/billing/checkout
 * 
 * Creates a Stripe checkout session and returns the payment URL
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

    // Get base URL for success/cancel redirects
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/?upgrade=success`;
    const cancelUrl = `${baseUrl}/?upgrade=canceled`;

    // Create checkout session
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
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        accountId: account.id,
        userId: user.id,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
