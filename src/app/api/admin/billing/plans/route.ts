import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const createPlanSchema = z.object({
  slug: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  price_monthly_cents: z.number().int().nonnegative(),
  price_yearly_cents: z.number().int().nonnegative().nullable().optional(),
  display_order: z.number().int().positive(),
  description: z.string().nullable().optional(),
  stripe_price_id_monthly: z.string().nullable().optional(),
  stripe_price_id_yearly: z.string().nullable().optional(),
});

const updatePlanSchema = createPlanSchema.partial().extend({
  is_active: z.boolean().optional(),
});

/**
 * GET /api/admin/billing/plans
 * Returns all plans with their features
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Get all plans using public view (billing_plans -> billing.plans)
        const { data: plans, error: plansError } = await supabase
          .from('billing_plans')
          .select('*')
          .order('display_order', { ascending: true });
        
        if (plansError) {
          console.error('[Admin Billing API] Error fetching plans:', plansError);
          return NextResponse.json(
            { error: 'Failed to fetch plans', details: plansError.message },
            { status: 500 }
          );
        }
        
        // Get features for each plan (directly assigned, not inherited)
        // Query plan_features view to get feature_id for each plan
        const plansWithFeatures = await Promise.all(
          (plans || []).map(async (plan) => {
            // Get directly assigned features (not inherited)
            const { data: planFeatures } = await supabase
              .from('billing_plan_features')
              .select('feature_id')
              .eq('plan_id', plan.id);
            
            if (!planFeatures || planFeatures.length === 0) {
              return {
                ...plan,
                features: [],
              };
            }
            
            // Get feature details for each assigned feature
            const featureIds = planFeatures.map((pf) => pf.feature_id);
            const { data: features } = await supabase
              .from('billing_features')
              .select('id, slug, name')
              .in('id', featureIds)
              .eq('is_active', true);
            
            return {
              ...plan,
              features: (features || []).map((f) => ({
                feature_id: f.id,
                feature_slug: f.slug,
                feature_name: f.name,
              })),
            };
          })
        );
        
        return NextResponse.json({ plans: plansWithFeatures });
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
 * POST /api/admin/billing/plans
 * Create a new plan
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        const body = await req.json();
        const validation = createPlanSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.errors },
            { status: 400 }
          );
        }
        
        // Use helper function to insert plan (checks admin access via RLS)
        const { data: plan, error } = await supabase.rpc('insert_billing_plan', {
          p_slug: validation.data.slug,
          p_name: validation.data.name,
          p_price_monthly_cents: validation.data.price_monthly_cents,
          p_display_order: validation.data.display_order,
          p_price_yearly_cents: validation.data.price_yearly_cents || null,
          p_description: validation.data.description || null,
          p_stripe_price_id_monthly: validation.data.stripe_price_id_monthly || null,
          p_stripe_price_id_yearly: validation.data.stripe_price_id_yearly || null,
        });
        
        if (error) {
          console.error('[Admin Billing API] Error creating plan:', error);
          return NextResponse.json(
            { error: 'Failed to create plan', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ plan }, { status: 201 });
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
