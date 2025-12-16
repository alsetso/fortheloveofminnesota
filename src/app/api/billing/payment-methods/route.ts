import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';

/**
 * Get payment methods for the current user
 * GET /api/billing/payment-methods
 */
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

    // Get Stripe customer ID
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account?.stripe_customer_id) {
      return NextResponse.json({
        payment_methods: [],
        default_payment_method: null,
      });
    }

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
      payment_methods: paymentMethods.data.map(pm => ({
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
      default_payment_method: defaultPaymentMethodId,
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

/**
 * Set default payment method
 * POST /api/billing/payment-methods
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

    const { payment_method_id } = await request.json();

    if (!payment_method_id) {
      return NextResponse.json(
        { error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    // Get Stripe customer ID
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Please add a payment method first.' },
        { status: 400 }
      );
    }

    // Attach payment method to customer if not already attached
    try {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: account.stripe_customer_id,
      });
    } catch (error: unknown) {
      // Payment method might already be attached, continue
      if (error instanceof Error && !error.message.includes('already been attached')) {
        throw error;
      }
    }

    // Set as default payment method
    await stripe.customers.update(account.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set default payment method' },
      { status: 500 }
    );
  }
}

/**
 * Delete a payment method
 * DELETE /api/billing/payment-methods?payment_method_id=pm_xxx
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const payment_method_id = searchParams.get('payment_method_id');

    if (!payment_method_id) {
      return NextResponse.json(
        { error: 'Payment method ID is required' },
        { status: 400 }
      );
    }

    // Get Stripe customer ID to verify ownership
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    // Verify payment method belongs to customer
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);
    
    if (paymentMethod.customer !== account.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Payment method does not belong to this customer' },
        { status: 403 }
      );
    }

    // Detach payment method
    await stripe.paymentMethods.detach(payment_method_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}

