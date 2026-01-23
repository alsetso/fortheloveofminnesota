import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if a plan has a price ID configured
 * 
 * GET /api/billing/check-price-id?plan={plan}
 * 
 * Returns whether the plan has a Stripe price ID configured
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const plan = searchParams.get('plan');

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan parameter is required' },
        { status: 400 }
      );
    }

    // Check for price ID based on plan type
    let hasPriceId = false;
    switch (plan) {
      case 'contributor':
        hasPriceId = !!process.env.STRIPE_CONTRIBUTOR_PRICE_ID;
        break;
      case 'business':
        hasPriceId = !!process.env.STRIPE_BUSINESS_PRICE_ID;
        break;
      case 'government':
        hasPriceId = !!process.env.STRIPE_GOVERNMENT_PRICE_ID;
        break;
      case 'credits':
        hasPriceId = !!(process.env.STRIPE_CREDITS_PRICE_ID || 'price_1Ss5F5RxPcmTLDu9ygiUQpKw');
        break;
      default:
        hasPriceId = false;
    }

    return NextResponse.json({
      plan,
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
