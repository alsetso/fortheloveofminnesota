import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cookies } from 'next/headers';
import { z } from 'zod';

const createFeatureSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  emoji: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

const updateFeatureSchema = createFeatureSchema.partial().extend({
  is_active: z.boolean().optional(),
});

/**
 * GET /api/admin/billing/features
 * Returns all features grouped by category
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        // Get features using public view (billing_features -> billing.features)
        const { data: features, error } = await supabase
          .from('billing_features')
          .select('*')
          .order('category', { ascending: true })
          .order('name', { ascending: true });
        
        if (error) {
          console.error('[Admin Billing API] Error fetching features:', error);
          return NextResponse.json(
            { error: 'Failed to fetch features' },
            { status: 500 }
          );
        }
        
        // Group by category
        const grouped = (features || []).reduce((acc, feature) => {
          const category = feature.category || 'uncategorized';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(feature);
          return acc;
        }, {} as Record<string, typeof features>);
        
        return NextResponse.json({ features: grouped, all: features });
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
 * POST /api/admin/billing/features
 * Create a new feature
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const supabase = await createServerClientWithAuth(cookies());
        
        const body = await req.json();
        const validation = createFeatureSchema.safeParse(body);
        
        if (!validation.success) {
          return NextResponse.json(
            { error: 'Invalid request data', details: validation.error.errors },
            { status: 400 }
          );
        }
        
        // Use helper function to insert feature (checks admin access via RLS)
        const { data: feature, error } = await supabase.rpc('insert_billing_feature', {
          p_slug: validation.data.slug,
          p_name: validation.data.name,
          p_description: validation.data.description || null,
          p_category: validation.data.category || null,
          p_emoji: validation.data.emoji || null,
          p_is_active: validation.data.is_active ?? true,
        });
        
        if (error) {
          console.error('[Admin Billing API] Error creating feature:', error);
          return NextResponse.json(
            { error: 'Failed to create feature', details: error.message },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ feature }, { status: 201 });
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
