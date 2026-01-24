import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await createServerClientWithAuth(cookieStore);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active account ID from cookie
    const activeAccountIdCookie = request.cookies.get('active_account_id');
    const activeAccountId = activeAccountIdCookie?.value || null;

    console.log('[Payment Methods API] User ID:', user.id);
    console.log('[Payment Methods API] Active Account ID from cookie:', activeAccountId);

    let accountQuery = supabase
      .from('accounts')
      .select('id, stripe_customer_id');

    if (activeAccountId) {
      accountQuery = accountQuery.eq('id', activeAccountId).eq('user_id', user.id);
    } else {
      accountQuery = accountQuery.eq('user_id', user.id).limit(1);
    }

    const { data: account, error: accountError } = await accountQuery.maybeSingle()
      .returns<{id: string; stripe_customer_id: string | null}>();

    console.log('[Payment Methods API] Account query result:', { account, accountError });

    if (accountError) {
      console.error('[Payment Methods API] Account query error:', accountError);
      return NextResponse.json({ 
        paymentMethods: [],
        hasStripeCustomer: false,
        debug: { error: accountError.message }
      });
    }

    if (!account?.stripe_customer_id) {
      console.log('[Payment Methods API] No stripe_customer_id found for account:', account?.id);
      return NextResponse.json({ 
        paymentMethods: [],
        hasStripeCustomer: false,
        debug: { accountId: account?.id, hasStripeCustomer: false }
      });
    }

    console.log('[Payment Methods API] Fetching payment methods for customer:', account.stripe_customer_id);

    // Fetch customer first to check for default payment method
    const customer = await stripe.customers.retrieve(account.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method', 'default_source']
    }) as Stripe.Customer;

    console.log('[Payment Methods API] Customer details:', {
      id: customer.id,
      email: customer.email,
      defaultPaymentMethod: customer.invoice_settings.default_payment_method,
      defaultSource: customer.default_source,
    });

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: account.stripe_customer_id,
      type: 'card',
    });

    console.log('[Payment Methods API] Found payment methods:', paymentMethods.data.length);

    // Also check subscriptions for attached payment methods
    const subscriptions = await stripe.subscriptions.list({
      customer: account.stripe_customer_id,
      limit: 10,
    });

    console.log('[Payment Methods API] Found subscriptions:', subscriptions.data.length);
    subscriptions.data.forEach((sub, idx) => {
      console.log(`[Payment Methods API] Subscription ${idx}:`, {
        id: sub.id,
        status: sub.status,
        defaultPaymentMethod: sub.default_payment_method,
      });
    });

    const defaultPaymentMethodId = typeof customer.invoice_settings.default_payment_method === 'string'
      ? customer.invoice_settings.default_payment_method
      : customer.invoice_settings.default_payment_method?.id;

    // Collect all payment methods including from subscriptions
    const allPaymentMethodIds = new Set<string>();
    
    // Add from payment methods list
    paymentMethods.data.forEach(pm => allPaymentMethodIds.add(pm.id));
    
    // Add default payment method if it exists and isn't already in list
    if (defaultPaymentMethodId && typeof defaultPaymentMethodId === 'string') {
      allPaymentMethodIds.add(defaultPaymentMethodId);
    }
    
    // Add from subscriptions
    for (const sub of subscriptions.data) {
      if (sub.default_payment_method) {
        const pmId = typeof sub.default_payment_method === 'string' 
          ? sub.default_payment_method 
          : sub.default_payment_method.id;
        if (pmId) allPaymentMethodIds.add(pmId);
      }
    }

    console.log('[Payment Methods API] All unique payment method IDs:', Array.from(allPaymentMethodIds));

    // Fetch full details for all payment methods
    const allPaymentMethods = await Promise.all(
      Array.from(allPaymentMethodIds).map(async (pmId) => {
        try {
          const pm = await stripe.paymentMethods.retrieve(pmId);
          return pm;
        } catch (error) {
          console.error(`[Payment Methods API] Failed to retrieve payment method ${pmId}:`, error);
          return null;
        }
      })
    );

    const validPaymentMethods = allPaymentMethods.filter((pm) => {
      return pm !== null && pm !== undefined;
    }) as Stripe.PaymentMethod[];

    console.log('[Payment Methods API] Total valid payment methods found:', validPaymentMethods.length);

    return NextResponse.json({
      paymentMethods: validPaymentMethods.map(pm => {
        const card = pm?.card;
        return {
          id: pm?.id || '',
          brand: card?.brand || 'unknown',
          last4: card?.last4 || '0000',
          expMonth: card?.exp_month || 0,
          expYear: card?.exp_year || 0,
          isDefault: pm?.id === defaultPaymentMethodId,
        };
      }),
      hasStripeCustomer: true,
      debug: {
        accountId: account.id,
        stripeCustomerId: account.stripe_customer_id,
        paymentMethodCount: validPaymentMethods.length,
        subscriptionCount: subscriptions.data.length,
      }
    });
  } catch (error) {
    console.error('[Payment Methods API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch payment methods',
        debug: { message: error instanceof Error ? error.message : 'Unknown error' }
      },
      { status: 500 }
    );
  }
}
