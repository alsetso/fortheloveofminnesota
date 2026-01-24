import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const updatePlanFeatureLimitsSchema = z.object({
  plan_id: z.string().uuid(),
  feature_id: z.string().uuid(),
  limit_value: z.number().nullable(),
  limit_type: z.enum(['count', 'storage_mb', 'boolean', 'unlimited']).nullable(),
});

/**
 * PATCH /api/admin/billing/plan-features/limits
 * Update limit values for a specific plan-feature relationship
 */
export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req, context) => {
      try {
        console.log('[Admin Billing API - Limits] Request context:', {
          userId: context.userId,
          accountId: context.accountId,
        });
        
        const supabase = await createServerClientWithAuth(cookies());
        
        const body = await req.json();
        const validation = updatePlanFeatureLimitsSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.issues },
            { status: 400 }
          );
        }
        
        const { plan_id, feature_id, limit_value, limit_type } = validation.data;
        
        console.log('[Admin Billing API - Limits] Updating limits:', {
          plan_id,
          feature_id,
          limit_value,
          limit_type,
        });
        
        // Use RPC function to upsert (handles both insert and update)
        const { data, error } = await supabase
          .rpc('upsert_plan_feature_limits', {
            p_plan_id: plan_id,
            p_feature_id: feature_id,
            p_limit_value: limit_value,
            p_limit_type: limit_type,
          } as any);
        
        if (error) {
          console.error('[Admin Billing API] Error updating plan feature limits:', error);
          return NextResponse.json(
            { error: 'Failed to update limits', details: error.message },
            { status: 500 }
          );
        }
        
        console.log('[Admin Billing API - Limits] Successfully updated:', data);
        
        return NextResponse.json({ planFeature: data });
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
