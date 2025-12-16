import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';
import type { Database } from '@/types/supabase';

export interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
  is_default: boolean;
}

export interface BillingData {
  hasCustomer: boolean;
  customerId: string | null;
  paymentMethods: PaymentMethod[];
  plan: 'hobby' | 'pro';
  billing_mode: 'standard' | 'trial';
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  isActive: boolean;
  isTrial: boolean;
}

/**
 * Get server-side Supabase client
 */
async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies - no-op
        },
      },
    }
  );
}

/**
 * Get billing data for the current user (server-side)
 * Includes customer status and payment methods
 * Uses React cache() to deduplicate requests within the same render
 */
export const getServerBillingData = cache(async (): Promise<BillingData> => {
  const supabase = await getServerSupabase();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return {
      hasCustomer: false,
      customerId: null,
      paymentMethods: [],
      plan: 'hobby',
      billing_mode: 'standard',
      subscription_status: null,
      stripe_subscription_id: null,
      isActive: false,
      isTrial: false,
    };
  }

  // Get account with Stripe customer ID and subscription info
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('stripe_customer_id, plan, billing_mode, subscription_status, stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (accountError || !account) {
    return {
      hasCustomer: false,
      customerId: null,
      paymentMethods: [],
      plan: 'hobby',
      billing_mode: 'standard',
      subscription_status: null,
      stripe_subscription_id: null,
      isActive: false,
      isTrial: false,
    };
  }

  const plan = (account.plan as 'hobby' | 'pro') || 'hobby';
  const billingMode = (account.billing_mode as 'standard' | 'trial') || 'standard';
  const subscriptionStatus = account.subscription_status || null;
  const stripeSubscriptionId = account.stripe_subscription_id || null;
  const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const isTrial = billingMode === 'trial' || subscriptionStatus === 'trialing';

  if (!account.stripe_customer_id) {
    return {
      hasCustomer: false,
      customerId: null,
      paymentMethods: [],
      plan,
      billing_mode: billingMode,
      subscription_status: subscriptionStatus,
      stripe_subscription_id: stripeSubscriptionId,
      isActive,
      isTrial,
    };
  }

  try {
    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: account.stripe_customer_id,
      type: 'card',
    });

    // Get customer to find default payment method
    const customer = await stripe.customers.retrieve(account.stripe_customer_id);

    const defaultPaymentMethodId = 
      typeof customer !== 'deleted' && customer.invoice_settings?.default_payment_method
        ? String(customer.invoice_settings.default_payment_method)
        : null;

    return {
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
    };
  } catch (error) {
    console.error('Error fetching billing data:', error);
    // Return customer exists but no payment methods on error
    return {
      hasCustomer: true,
      customerId: account.stripe_customer_id,
      paymentMethods: [],
      plan,
      billing_mode: billingMode,
      subscription_status: subscriptionStatus,
      stripe_subscription_id: stripeSubscriptionId,
      isActive,
      isTrial,
    };
  }
});

