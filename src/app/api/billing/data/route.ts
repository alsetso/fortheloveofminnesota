import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
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

    // Get account with Stripe customer ID and subscription info
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id, plan, billing_mode, subscription_status, stripe_subscription_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account) {
      return NextResponse.json({
        hasCustomer: false,
        customerId: null,
        paymentMethods: [],
        plan: 'hobby',
        billing_mode: 'standard',
        subscription_status: null,
        stripe_subscription_id: null,
        isActive: false,
        isTrial: false,
      });
    }

    const plan = (account.plan as 'hobby' | 'pro' | 'plus') || 'hobby';
    const billingMode = (account.billing_mode as 'standard' | 'trial') || 'standard';
    const subscriptionStatus = account.subscription_status || null;
    const stripeSubscriptionId = account.stripe_subscription_id || null;
    const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
    const isTrial = billingMode === 'trial' || subscriptionStatus === 'trialing';

    if (!account.stripe_customer_id) {
      return NextResponse.json({
        hasCustomer: false,
        customerId: null,
        paymentMethods: [],
        plan,
        billing_mode: billingMode,
        subscription_status: subscriptionStatus,
        stripe_subscription_id: stripeSubscriptionId,
        isActive,
        isTrial,
      });
    }

    try {
      // Get payment methods from Stripe
      const paymentMethods = await stripe.paymentMethods.list({
        customer: account.stripe_customer_id,
        type: 'card',
      });

      // Get customer to find default payment method
      const customer = await stripe.customers.retrieve(account.stripe_customer_id) as import('stripe').Stripe.Customer | import('stripe').Stripe.DeletedCustomer;

      const defaultPaymentMethodId = 
        customer && !('deleted' in customer) && customer.invoice_settings?.default_payment_method
          ? String(customer.invoice_settings.default_payment_method)
          : null;

      return NextResponse.json({
        hasCustomer: true,
        customerId: account.stripe_customer_id,
        paymentMethods: paymentMethods.data.map(pm => ({
          id: pm.id,
          type: pm.type,
          card: pm.card ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          } : null,
          is_default: pm.id === defaultPaymentMethodId,
        })),
        plan,
        billing_mode: billingMode,
        subscription_status: subscriptionStatus,
        stripe_subscription_id: stripeSubscriptionId,
        isActive,
        isTrial,
      });
    } catch (error) {
      console.error('Error fetching billing data:', error);
      return NextResponse.json({
        hasCustomer: true,
        customerId: account.stripe_customer_id,
        paymentMethods: [],
        plan,
        billing_mode: billingMode,
        subscription_status: subscriptionStatus,
        stripe_subscription_id: stripeSubscriptionId,
        isActive,
        isTrial,
      });
    }
  } catch (error) {
    console.error('Error in billing data API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing data' },
      { status: 500 }
    );
  }
}



