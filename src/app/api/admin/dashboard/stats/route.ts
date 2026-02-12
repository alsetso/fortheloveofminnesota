import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/admin/dashboard/stats
 * Admin-only endpoint to fetch dashboard statistics
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
        
        // Fetch all stats in parallel
        const [
          accountsResult,
          subscriptionsResult,
          activeSubscriptionsResult,
          mapsResult,
          postsResult,
        ] = await Promise.all([
          // Total accounts
          supabase
            .from('accounts')
            .select('id', { count: 'exact', head: true }),
          
          // All subscriptions
          supabase
            .from('subscriptions')
            .select('id, status', { count: 'exact' }),
          
          // Active subscriptions only
          supabase
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
          
          // Total maps
          supabase
            .schema('maps')
            .from('maps')
            .select('id', { count: 'exact', head: true }),
          
          // Total posts
          supabase
            .schema('content')
            .from('posts')
            .select('id', { count: 'exact', head: true }),
        ]);

        // Process subscription status counts
        const subscriptions = subscriptionsResult.data || [];
        const subscriptionStatusCounts = subscriptions.reduce((acc, sub: any) => {
          const status = sub.status || 'unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Get accounts created in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: newAccountsCount } = await supabase
          .from('accounts')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo.toISOString());

        // Get subscriptions created in last 7 days
        const { count: newSubscriptionsCount } = await supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', sevenDaysAgo.toISOString());

        return NextResponse.json({
          accounts: {
            total: accountsResult.count || 0,
            newLast7Days: newAccountsCount || 0,
          },
          subscriptions: {
            total: subscriptionsResult.count || 0,
            active: activeSubscriptionsResult.count || 0,
            newLast7Days: newSubscriptionsCount || 0,
            byStatus: subscriptionStatusCounts,
          },
          content: {
            maps: mapsResult.count || 0,
            posts: postsResult.count || 0,
          },
          recentActivity: 0,
        });
      } catch (error) {
        console.error('[Admin Dashboard API] Error:', error);
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
