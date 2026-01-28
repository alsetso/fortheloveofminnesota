import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';

/**
 * GET /api/billing/user-features
 * Returns all features available to the current user
 * 
 * Security:
 * - Rate limited: 200 requests/minute
 * - Requires authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // userId and accountId are guaranteed from security middleware
        if (!accountId) {
          return NextResponse.json(
            { error: 'Account not found', message: 'No active account selected' },
            { status: 404 }
          );
        }
        
        // Get account features + limits (account-scoped; respects active account selection)
        const { data, error } = await supabase.rpc('get_account_features_with_limits', {
          account_id: accountId,
        } as any);
        
        if (error) {
          console.error('[Billing API] Error getting account features:', error);
          return NextResponse.json(
            { error: 'Failed to fetch features' },
            { status: 500 }
          );
        }
        
        const features = Array.isArray(data)
          ? (data as any[]).map((row: any) => ({
              slug: row.feature_slug,
              name: row.feature_name,
              limit_value: row.limit_value ?? null,
              limit_type: row.limit_type ?? null,
              is_unlimited: Boolean(row.is_unlimited),
              category: row.category ?? null,
            }))
          : [];
        
        return NextResponse.json({ accountId, features });
      } catch (error) {
        console.error('[Billing API] Error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: { windowMs: 60 * 1000, maxRequests: 200 },
    }
  );
}
