import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * GET /api/points-of-interest
 * List points of interest
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Optional authentication
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const supabase = createServerClient();
    
    // Type assertion needed because TypeScript only allows 'public' schema,
    // but we need to query from 'map' schema
    const { data, error } = await (supabase as any)
      .schema('map')
      .from('points_of_interest')
      .select('id, name, category, emoji, lat, lng, description, created_at, updated_at')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error fetching points of interest:', error);
          }
          return createErrorResponse('Failed to fetch points of interest', 500);
        }

        return createSuccessResponse({
          points: data || [],
          count: data?.length || 0,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/points-of-interest:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'authenticated',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

