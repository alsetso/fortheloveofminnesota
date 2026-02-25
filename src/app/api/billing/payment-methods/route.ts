import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
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

    if (accountError) {
      return NextResponse.json({
        paymentMethods: [],
        hasStripeCustomer: false,
      });
    }

    if (!account?.stripe_customer_id) {
      return NextResponse.json({
        paymentMethods: [],
        hasStripeCustomer: false,
      });
    }

    // Fetch customer first to check for default payment method
    const customer = await stripe.customers.retrieve(account.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method', 'default_source']
    }) as Stripe.Customer;

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: account.stripe_customer_id,
      type: 'card',
    });

    // Also check subscriptions for attached payment methods
    const subscriptions = await stripe.subscriptions.list({
      customer: account.stripe_customer_id,
      limit: 10,
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

    // Return only display-safe fields: no full PAN, no raw Stripe IDs to client
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
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}
