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
        
        // Check feature access using the public schema wrapper
        const { data: hasAccess, error } = await supabase.rpc('user_has_feature', {
          user_id: user.id,
          feature_slug: feature,
        });
        
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
          hasAccess: hasAccess === true,
          feature: featureData || null,
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
      rateLimit: { requests: 200, window: 60 },
    }
  );
}
