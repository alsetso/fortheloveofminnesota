import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { stripe } from '@/lib/stripe';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * POST /api/billing/create-portal-session
 * Creates a Stripe billing portal session for the authenticated user's account
 * 
 * Security:
 * - Requires authentication
 * - Rate limited: 10 requests/minute
 * - Validates account ownership
 */
export async function POST(request: NextRequest) {
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

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user || user.id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }

        // Get active account ID from cookie
        const activeAccountIdCookie = request.cookies.get('active_account_id');
        const activeAccountId = activeAccountIdCookie?.value || null;

        // Get account with stripe_customer_id
        let account;
        if (activeAccountId) {
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('id', activeAccountId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to fetch account' },
              { status: 500 }
            );
          }
          account = data;
        } else {
          const { data, error } = await supabase
            .from('accounts')
            .select('id, stripe_customer_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
          
          if (error) {
            return NextResponse.json(
              { error: 'Failed to fetch account' },
              { status: 500 }
            );
          }
          account = data;
        }

        if (!account) {
          return NextResponse.json(
            { error: 'Account not found' },
            { status: 404 }
          );
        }

        // Check if customer ID exists
        if (!account.stripe_customer_id) {
          return NextResponse.json(
            { error: 'No Stripe customer ID found. Please set up payment first.' },
            { status: 400 }
          );
        }

        // Get base URL for return redirect
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const returnUrl = `${baseUrl}/billing`;

        // Create billing portal session
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: account.stripe_customer_id,
          return_url: returnUrl,
        });

        return NextResponse.json({
          url: portalSession.url,
        });
      } catch (error) {
        console.error('Error creating billing portal session:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to create billing portal session' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
