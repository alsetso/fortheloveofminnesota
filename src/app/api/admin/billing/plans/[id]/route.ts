import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { BillingPlan } from '@/lib/billing/types';

const updatePlanSchema = z.object({
  slug: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  price_monthly_cents: z.number().int().nonnegative().optional(),
  price_yearly_cents: z.number().int().nonnegative().nullable().optional(),
  display_order: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  description: z.string().nullable().optional(),
  stripe_price_id_monthly: z.string().nullable().optional(),
  stripe_price_id_yearly: z.string().nullable().optional(),
});

const uuidSchema = z.string().uuid();

/**
 * PATCH /api/admin/billing/plans/[id]
 * Update a plan
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, context) => {
      try {
        const { id } = await params;
        
        // Validate UUID
        const idValidation = uuidSchema.safeParse(id);
        if (!idValidation.success) {
          return NextResponse.json(
            { error: 'Invalid plan ID' },
            { status: 400 }
          );
        }
        
        const supabase = await createServerClientWithAuth(cookies());
        const body = await req.json();
        const validation = updatePlanSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.issues },
            { status: 400 }
          );
        }
        
        // Use helper function to update plan (checks admin access via RLS)
        const { data: plan, error } = await supabase.rpc('update_billing_plan', {
          p_id: id,
          p_slug: validation.data.slug,
          p_name: validation.data.name,
          p_price_monthly_cents: validation.data.price_monthly_cents,
          p_price_yearly_cents: validation.data.price_yearly_cents,
          p_display_order: validation.data.display_order,
          p_is_active: validation.data.is_active,
          p_description: validation.data.description,
          p_stripe_price_id_monthly: validation.data.stripe_price_id_monthly,
          p_stripe_price_id_yearly: validation.data.stripe_price_id_yearly,
        } as any).returns<BillingPlan>();
        
        if (error) {
          console.error('[Admin Billing API] Error updating plan:', error);
          if (error.code === 'PGRST116') {
            return NextResponse.json(
              { error: 'Plan not found' },
              { status: 404 }
            );
          }
          return NextResponse.json(
            { error: 'Failed to update plan', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ plan });
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
 * DELETE /api/admin/billing/plans/[id]
 * Soft delete a plan (set is_active = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const { id } = await params;
        
        // Validate UUID
        const idValidation = uuidSchema.safeParse(id);
        if (!idValidation.success) {
          return NextResponse.json(
            { error: 'Invalid plan ID' },
            { status: 400 }
          );
        }
        
        const supabase = await createServerClientWithAuth(cookies());
        
        // Use helper function to soft delete plan (checks admin access via RLS)
        const { data: plan, error } = await supabase.rpc('update_billing_plan', {
          p_id: id,
          p_is_active: false,
        } as any).returns<BillingPlan>();
        
        if (error) {
          console.error('[Admin Billing API] Error deleting plan:', error);
          if (error.code === 'PGRST116') {
            return NextResponse.json(
              { error: 'Plan not found' },
              { status: 404 }
            );
          }
          return NextResponse.json(
            { error: 'Failed to delete plan', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ plan });
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
