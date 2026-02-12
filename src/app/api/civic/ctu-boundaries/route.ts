import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/civic/ctu-boundaries
 * Get CTU (City, Township, Unorganized Territory) boundaries
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const ctuBoundariesQuerySchema = z.object({
  id: commonSchemas.uuid.optional(),
  ctu_class: z.enum(['CITY', 'TOWNSHIP', 'UNORGANIZED TERRITORY']).optional(),
  county_name: z.string().max(200).optional(),
  // Coerce string to number for limit parameter (query params come as strings)
  limit: z.coerce.number().int().positive().max(3000).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, ctuBoundariesQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { id, ctu_class: ctuClass, county_name: countyName, limit } = validation.data;
        
        // Use RPC function to query layers schema (public resources)
        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();
        
        const { data, error } = await supabase.rpc('get_ctu_boundaries', {
          p_id: id || null,
          p_ctu_class: ctuClass || null,
          p_county_name: countyName || null,
          p_limit: limit ?? 3000
        });
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[CTU Boundaries API] Error:', error);
          }
          return NextResponse.json(
            { error: 'Failed to fetch CTU boundaries' },
            { status: 500 }
          );
        }
        
        // If querying by ID, return single object; otherwise return array
        if (id) {
          return NextResponse.json(Array.isArray(data) && data.length > 0 ? data[0] : data);
        }
        
        return NextResponse.json(data || []);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[CTU Boundaries API] Error:', error);
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

