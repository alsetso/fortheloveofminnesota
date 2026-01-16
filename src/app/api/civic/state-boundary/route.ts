import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * GET /api/civic/state-boundary
 * Get Minnesota state boundary
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async () => {
      try {
        const supabase = createServerClient();
        
        // Type assertion needed: Supabase TypeScript types only support 'public' schema,
        // but we need to query from 'civic' schema. The schema() method exists at runtime.
        const { data, error } = await (supabase as any)
          .schema('civic')
          .from('state_boundary')
          .select('id, name, description, publisher, source_date, geometry')
          .single();
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[State Boundary API] Error:', error);
          }
          return NextResponse.json(
            { error: 'Failed to fetch state boundary' },
            { status: 500 }
          );
        }
        
        if (!data) {
          return NextResponse.json(
            { error: 'State boundary not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(data);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[State Boundary API] Error:', error);
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

