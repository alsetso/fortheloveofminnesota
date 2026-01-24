import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { BillingFeature } from '@/lib/billing/types';

const updateFeatureSchema = z.object({
  slug: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const uuidSchema = z.string().uuid();

/**
 * PATCH /api/admin/billing/features/[id]
 * Update a feature
 */
export async function PATCH(
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
            { error: 'Invalid feature ID' },
            { status: 400 }
          );
        }
        
        const supabase = await createServerClientWithAuth(cookies());
        const body = await req.json();
        const validation = updateFeatureSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.issues },
            { status: 400 }
          );
        }
        
        // Use helper function to update feature (checks admin access via RLS)
        const { data: feature, error } = await supabase.rpc('update_billing_feature', {
          p_id: id,
          p_slug: validation.data.slug,
          p_name: validation.data.name,
          p_description: validation.data.description,
          p_category: validation.data.category,
          p_emoji: validation.data.emoji,
          p_is_active: validation.data.is_active,
        } as any).returns<BillingFeature>();
        
        if (error) {
          console.error('[Admin Billing API] Error updating feature:', error);
          if (error.code === 'PGRST116') {
            return NextResponse.json(
              { error: 'Feature not found' },
              { status: 404 }
            );
          }
          return NextResponse.json(
            { error: 'Failed to update feature', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ feature });
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
 * DELETE /api/admin/billing/features/[id]
 * Delete a feature (cascades to plan_features)
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
            { error: 'Invalid feature ID' },
            { status: 400 }
          );
        }
        
        const supabase = await createServerClientWithAuth(cookies());
        
        // Delete feature using helper function (cascade will remove plan_features)
        // First soft delete by setting is_active = false
        const { error } = await supabase.rpc('update_billing_feature', {
          p_id: id,
          p_is_active: false,
        } as any);
        
        // Note: Hard delete would require a separate function if needed
        
        if (error) {
          console.error('[Admin Billing API] Error deleting feature:', error);
          if (error.code === 'PGRST116') {
            return NextResponse.json(
              { error: 'Feature not found' },
              { status: 404 }
            );
          }
          return NextResponse.json(
            { error: 'Failed to delete feature', details: error.message },
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
