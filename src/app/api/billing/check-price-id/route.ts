import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';

/**
 * Check if a plan has a price ID configured
 * 
 * GET /api/billing/check-price-id?plan={plan}&period={monthly|yearly}
 * 
 * Returns whether the plan has a Stripe price ID configured in the database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const planSlug = searchParams.get('plan');
    const period = searchParams.get('period') || 'monthly'; // Default to monthly

    if (!planSlug) {
      return NextResponse.json(
        { error: 'Plan parameter is required' },
        { status: 400 }
      );
    }

    // Special case for credits (still uses env var as fallback)
    if (planSlug === 'credits') {
      const hasPriceId = !!(process.env.STRIPE_CREDITS_PRICE_ID || 'price_1Ss5F5RxPcmTLDu9ygiUQpKw');
      return NextResponse.json({
        plan: planSlug,
        hasPriceId,
      });
    }

    // Fetch plan from database
    const supabase = await createServerClientWithAuth(cookies());
    const { data: plan, error: planError } = await supabase
      .from('billing_plans')
      .select('stripe_price_id_monthly, stripe_price_id_yearly')
      .eq('slug', planSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json({
        plan: planSlug,
        hasPriceId: false,
      });
    }

    // Check if the requested period has a price ID
    const hasPriceId = period === 'yearly'
      ? !!plan.stripe_price_id_yearly
      : !!plan.stripe_price_id_monthly;

    return NextResponse.json({
      plan: planSlug,
      period,
      hasPriceId,
    });
  } catch (error) {
    console.error('Error checking price ID:', error);
    return NextResponse.json(
      { error: 'Failed to check price ID' },
      { status: 500 }
    );
  }
}
