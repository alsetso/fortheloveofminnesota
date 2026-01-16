import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * GET /api/billing/data
 * Get billing data for authenticated user
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated)
 * - Requires authentication
 * - Sensitive data - only returns user's own billing info
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
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
        
        // userId is guaranteed from security middleware
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user || user.id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

    // Get active account ID from cookie (set by client when switching accounts)
    // This ensures we use the account the user has selected, not just any account
    const activeAccountIdCookie = request.cookies.get('active_account_id');
    const activeAccountId = activeAccountIdCookie?.value || null;

    let account, accountError;
    
    if (activeAccountId) {
      // Verify the active account belongs to this user before using it
      const { data, error } = await supabase
        .from('accounts')
        .select('plan, billing_mode, subscription_status')
        .eq('id', activeAccountId)
        .eq('user_id', user.id)
        .maybeSingle();
      account = data;
      accountError = error;
    } else {
      // Fallback to first account if no active account ID in cookie
      const { data, error } = await supabase
        .from('accounts')
        .select('plan, billing_mode, subscription_status')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      account = data;
      accountError = error;
    }

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
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in billing data API:', error);
        }
        return NextResponse.json(
          { error: 'Failed to fetch billing data' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
