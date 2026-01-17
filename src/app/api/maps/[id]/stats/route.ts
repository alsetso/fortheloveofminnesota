import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams, validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/[id]/stats
 * Returns view statistics for a map
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Query and path parameter validation
 * - Optional authentication
 */
const mapStatsQuerySchema = z.object({
  hours: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(87600)).optional().nullable(),
});

const mapStatsPathSchema = z.object({
  id: commonSchemas.uuid,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { id } = await params;
        
        // Validate path parameters
        const pathValidation = validatePathParams({ id }, mapStatsPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: validatedId } = pathValidation.data;
        
        // Validate query parameters
        const url = new URL(req.url);
        const queryValidation = validateQueryParams(url.searchParams, mapStatsQuerySchema);
        if (!queryValidation.success) {
          return queryValidation.error;
        }
        
        const { hours } = queryValidation.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return createErrorResponse('Server configuration error', 500);
    }

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Route handlers can set cookies - no-op for read operations
          },
        },
      }
    );

        // Get stats using get_url_stats function
        // Maps are tracked as /map/{map_id} URLs
        const mapUrl = `/map/${validatedId}`;
        const { data, error } = await supabase.rpc('get_url_stats', {
          p_url: mapUrl,
          p_hours: hours,
        } as any) as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Map Stats API] Error fetching map stats:', error);
          }
          return createErrorResponse('Failed to fetch map stats', 500);
        }

        // Function returns array with single row
        const stats = data && data.length > 0 ? data[0] : {
          total_views: 0,
          unique_viewers: 0,
          accounts_viewed: 0,
        };

        return createSuccessResponse({ 
          success: true,
          stats 
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Map Stats API] Error:', error);
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

