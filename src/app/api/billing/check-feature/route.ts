import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const checkFeatureQuerySchema = z.object({
  feature: z.string().min(1),
});

/**
 * GET /api/billing/check-feature?feature=unlimited_maps
 * Checks if the current user has access to a specific feature
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
        
        // Validate query parameters
        const url = new URL(req.url);
        const featureParam = url.searchParams.get('feature');
        
        if (!featureParam) {
          return NextResponse.json(
            { error: 'Feature parameter is required' },
            { status: 400 }
          );
        }
        
        const validation = checkFeatureQuerySchema.safeParse({ feature: featureParam });
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid feature parameter' },
            { status: 400 }
          );
        }
        
        const { feature } = validation.data;
        
        // Check feature access (account-scoped; respects active account selection)
        const { data: hasAccess, error } = await supabase.rpc('account_has_feature', {
          account_id: accountId,
          feature_slug: feature,
        } as any);
        
        if (error) {
          console.error('[Billing API] Error checking feature:', error);
          return NextResponse.json(
            { error: 'Failed to check feature access' },
            { status: 500 }
          );
        }
        
        // Get feature details using public view (billing_features -> billing.features)
        const { data: featureData, error: featureError } = await supabase
          .from('billing_features')
          .select('slug, name, description, category')
          .eq('slug', feature)
          .eq('is_active', true)
          .maybeSingle();
        
        return NextResponse.json({
          hasAccess: Boolean(hasAccess),
          feature: featureData || null,
          accountId,
        });
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
