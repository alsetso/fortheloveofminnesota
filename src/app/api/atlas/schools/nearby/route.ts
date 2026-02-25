import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const querySchema = z.object({
  school_id: commonSchemas.uuid,
  radius: z.coerce.number().positive().max(50).optional(),
  limit: z.coerce.number().int().positive().max(20).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, querySchema);
        if (!validation.success) return validation.error;

        const { school_id, radius = 10, limit = 5 } = validation.data;

        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        const { data, error } = await (supabase as any).rpc('get_nearby_schools', {
          p_school_id: school_id,
          p_radius_miles: radius,
          p_limit: limit,
        });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Nearby Schools API] Error:', error);
          }
          return NextResponse.json({ error: 'Failed to fetch nearby schools' }, { status: 500 });
        }

        return NextResponse.json(data || []);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Nearby Schools API] Error:', err);
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { rateLimit: 'public', requireAuth: false }
  );
}
