import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * GET /api/admin/billing/accounts
 * Admin-only: fetch all accounts with billing-relevant fields.
 * Supports ?search= for username filtering and ?plan= for plan filtering.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const searchParams = req.nextUrl.searchParams;
        const search = searchParams.get('search')?.trim() || '';
        const planFilter = searchParams.get('plan') || '';
        const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

        let query = supabase
          .from('accounts')
          .select(
            'id, username, image_url, plan, subscription_status, billing_mode, stripe_customer_id, role, created_at',
            { count: 'exact' }
          )
          .order('created_at', { ascending: false })
          .limit(limit);

        if (search) {
          query = query.ilike('username', `%${search}%`);
        }
        if (planFilter) {
          query = query.eq('plan', planFilter);
        }

        const { data, error, count } = await query;

        if (error) {
          console.error('[Admin Billing API] Error fetching accounts:', error);
          return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
        }

        return NextResponse.json({ accounts: data || [], count: count ?? (data?.length || 0) });
      } catch (error) {
        console.error('[Admin Billing API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
