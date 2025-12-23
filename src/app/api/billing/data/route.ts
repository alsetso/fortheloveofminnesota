import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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

    // Get account with subscription info
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('plan, billing_mode, subscription_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (accountError || !account) {
      return NextResponse.json({
        plan: 'hobby',
        billing_mode: 'standard',
        subscription_status: null,
        isActive: false,
        isTrial: false,
      });
    }

    const plan = (account.plan as 'hobby' | 'pro' | 'plus') || 'hobby';
    const billingMode = (account.billing_mode as 'standard' | 'trial') || 'standard';
    const subscriptionStatus = account.subscription_status || null;
    const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
    const isTrial = billingMode === 'trial' || subscriptionStatus === 'trialing';

    return NextResponse.json({
      plan,
      billing_mode: billingMode,
      subscription_status: subscriptionStatus,
      isActive,
      isTrial,
    });
  } catch (error) {
    console.error('Error in billing data API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing data' },
      { status: 500 }
    );
  }
}
