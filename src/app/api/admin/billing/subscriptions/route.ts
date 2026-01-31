import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/admin/billing/subscriptions
 * Admin-only endpoint to fetch all subscriptions with account details
 * 
 * Security:
 * - Requires admin role
 * - Rate limited: admin preset
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const searchParams = req.nextUrl.searchParams;
        const status = searchParams.get('status'); // Filter by status
        const limit = parseInt(searchParams.get('limit') || '100');
        
        // Build query
        let query = supabase
          .from('subscriptions')
          .select(`
            *,
            accounts!inner(
              id,
              username,
              user_id,
              plan,
              subscription_status,
              billing_mode
            )
          `)
          .order('created_at', { ascending: false })
          .limit(limit);
        
        // Filter by status if provided
        if (status) {
          query = query.eq('status', status);
        }
        
        const { data: subscriptions, error } = await query;
        
        if (error) {
          console.error('[Admin Billing API] Error fetching subscriptions:', error);
          return NextResponse.json(
            { error: 'Failed to fetch subscriptions' },
            { status: 500 }
          );
        }
        
        return NextResponse.json({
          subscriptions: subscriptions || [],
          count: subscriptions?.length || 0,
        });
      } catch (error) {
        console.error('[Admin Billing API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAdmin: true,
      rateLimit: 'admin',
    }
  );
}
