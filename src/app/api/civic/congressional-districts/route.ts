import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
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
        
        const { id } = validation.data;
        const supabase = createServerClient();
    
    let query = (supabase as any)
      .schema('civic')
      .from('congressional_districts')
      .select('id, district_number, name, geometry')
      .order('district_number', { ascending: true });
    
    // Apply filters
    if (id) {
      query = query.eq('id', id);
    }
    
        const { data, error } = await query;
        
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
        if (id) {
          return NextResponse.json(Array.isArray(data) && data.length > 0 ? data[0] : data);
        }
        
        return NextResponse.json(data || []);
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

