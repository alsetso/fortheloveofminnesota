import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const assignFeaturesSchema = z.object({
  plan_id: z.string().uuid(),
  feature_ids: z.array(z.string().uuid()),
});

const removeFeatureSchema = z.object({
  plan_id: z.string().uuid(),
  feature_id: z.string().uuid(),
});

/**
 * POST /api/admin/billing/plan-features
 * Assign features to a plan (bulk assign)
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        const body = await req.json();
        const validation = assignFeaturesSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.errors },
            { status: 400 }
          );
        }
        
        const { plan_id, feature_ids } = validation.data;
        
        // Insert plan-feature relationships
        const planFeatures = feature_ids.map(feature_id => ({
          plan_id,
          feature_id,
        }));
        
        // Use helper function to assign features (checks admin access via RLS)
        const { data, error } = await supabase.rpc('assign_billing_plan_features', {
          p_plan_id: plan_id,
          p_feature_ids: feature_ids,
        });
        
        if (error) {
          console.error('[Admin Billing API] Error assigning features:', error);
          return NextResponse.json(
            { error: 'Failed to assign features', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ plan_features: data });
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

/**
 * DELETE /api/admin/billing/plan-features
 * Remove a feature from a plan
 */
export async function DELETE(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        const body = await req.json();
        const validation = removeFeatureSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.errors },
            { status: 400 }
          );
        }
        
        const { plan_id, feature_id } = validation.data;
        
        // Use helper function to remove feature (checks admin access via RLS)
        const { data, error } = await supabase.rpc('remove_billing_plan_feature', {
          p_plan_id: plan_id,
          p_feature_id: feature_id,
        });
        
        if (error) {
          console.error('[Admin Billing API] Error removing feature:', error);
          return NextResponse.json(
            { error: 'Failed to remove feature', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ success: true });
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
