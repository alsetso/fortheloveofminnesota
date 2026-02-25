import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/civic/congressional-districts
 * Get congressional districts
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const congressionalDistrictsQuerySchema = z.object({
  id: commonSchemas.uuid.optional(),
  limit: z.coerce.number().int().positive().max(3000).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, congressionalDistrictsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { id, limit } = validation.data;
        
        // Use RPC function to query layers schema (public resources)
        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();
        
        const { data, error } = await (supabase as any).rpc('get_congressional_districts', {
          p_id: id || null,
          p_limit: limit ?? 3000
        });
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Congressional Districts API] Error:', error);
          }
          return NextResponse.json(
            { error: 'Failed to fetch districts' },
            { status: 500 }
          );
        }
        
        // If querying by ID, return single object; otherwise return array
        const arr = Array.isArray(data) ? data : [];
        if (id) {
          return NextResponse.json(arr.length > 0 ? arr[0] : data);
        }
        
        return NextResponse.json(data ?? []);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Congressional Districts API] Error:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

