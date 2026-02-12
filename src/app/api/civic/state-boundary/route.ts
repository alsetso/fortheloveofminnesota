import { NextRequest, NextResponse } from 'next/server';
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
        // Use RPC function to query layers schema (public resources)
        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();
        
        const { data, error } = await supabase.rpc('get_state_boundary');
        
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[State Boundary API] Error:', error);
          }
          return NextResponse.json(
            { error: 'Failed to fetch state boundary' },
            { status: 500 }
          );
        }
        
        const stateData = Array.isArray(data) && data.length > 0 ? data[0] : data;
        
        if (!stateData) {
          return NextResponse.json(
            { error: 'State boundary not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json(stateData);
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

