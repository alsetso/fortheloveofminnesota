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
    async (req, { userId }) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user || user.id !== userId) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
        
        // Get user features using the billing function
        const { data, error } = await supabase.rpc('get_user_features', {
          user_id: user.id,
        });
        
        if (error) {
          console.error('[Billing API] Error getting user features:', error);
          return NextResponse.json(
            { error: 'Failed to fetch features' },
            { status: 500 }
          );
        }
        
        // Transform data to simple array of feature slugs
        const features = (data || []).map((row: { feature_slug: string; feature_name: string }) => ({
          slug: row.feature_slug,
          name: row.feature_name,
        }));
        
        return NextResponse.json({ features });
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
      rateLimit: { requests: 200, window: 60 },
    }
  );
}
