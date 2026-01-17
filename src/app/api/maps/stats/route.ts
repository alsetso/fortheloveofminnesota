import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/maps/stats?ids=id1,id2,id3
 * Returns view statistics for multiple maps in a single request
 * 
 * Security:
 * - Rate limited: 200 requests/minute (authenticated) or 100/min (public)
 * - Query parameter validation
 * - Optional authentication
 */
const mapsStatsQuerySchema = z.object({
  ids: z.string().min(1).max(2000).transform((val) => 
    val.split(',').map(id => id.trim()).filter(id => id.length > 0)
  ).pipe(
    z.array(commonSchemas.uuid).min(1).max(100)
  ),
  hours: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(87600)).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, mapsStatsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { ids: mapIds, hours } = validation.data;

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

        // Fetch stats for all maps in parallel using get_url_stats
        // Maps are tracked as /map/{map_id} URLs
        const statsPromises = mapIds.map(async (mapId) => {
          try {
            const mapUrl = `/map/${mapId}`;
            const { data, error } = await supabase.rpc('get_url_stats', {
              p_url: mapUrl,
              p_hours: hours,
            } as any) as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };

            if (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`[Batch Map Stats API] Error fetching stats for map ${mapId}:`, error);
              }
              return {
                map_id: mapId,
                stats: {
                  total_views: 0,
                  unique_viewers: 0,
                  accounts_viewed: 0,
                },
              };
            }

            const stats = data && data.length > 0 ? data[0] : {
              total_views: 0,
              unique_viewers: 0,
              accounts_viewed: 0,
            };

            return {
              map_id: mapId,
              stats,
            };
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`[Batch Map Stats API] Error processing map ${mapId}:`, error);
            }
            return {
              map_id: mapId,
              stats: {
                total_views: 0,
                unique_viewers: 0,
                accounts_viewed: 0,
              },
            };
          }
        });

        const results = await Promise.all(statsPromises);

        // Convert to map for easy lookup
        const statsMap: Record<string, { total_views: number; unique_viewers: number; accounts_viewed: number }> = {};
        results.forEach((result) => {
          statsMap[result.map_id] = result.stats;
        });

        return createSuccessResponse({
          success: true,
          stats: statsMap,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Batch Map Stats API] Error:', error);
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

