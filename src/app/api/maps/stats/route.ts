import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';

/**
 * GET /api/maps/stats?ids=id1,id2,id3
 * Returns view statistics for multiple maps in a single request
 * 
 * Query params:
 * - ids: Comma-separated list of map IDs (required)
 * - hours: Optional number of hours to filter (default: all time)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    const hoursParam = searchParams.get('hours');

    if (!idsParam) {
      return createErrorResponse('ids parameter is required (comma-separated map IDs)', 400);
    }

    const mapIds = idsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
    
    if (mapIds.length === 0) {
      return createErrorResponse('At least one valid map ID is required', 400);
    }

    // Limit to prevent abuse
    if (mapIds.length > 100) {
      return createErrorResponse('Maximum 100 map IDs allowed per request', 400);
    }

    const hours = hoursParam ? parseInt(hoursParam, 10) : null;
    if (hoursParam && (isNaN(hours!) || hours! < 0)) {
      return createErrorResponse('hours must be a positive integer', 400);
    }

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

    // Fetch stats for all maps in parallel
    const statsPromises = mapIds.map(async (mapId) => {
      try {
        const { data, error } = await supabase.rpc('get_map_stats', {
          p_map_id: mapId,
          p_hours: hours,
        } as any) as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };

        if (error) {
          console.error(`[Batch Map Stats API] Error fetching stats for map ${mapId}:`, error);
          return {
            map_id: mapId,
            stats: {
              total_views: 0,
              unique_viewers: 0,
              accounts_viewed: 0,
            },
            error: error.message,
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
        console.error(`[Batch Map Stats API] Error processing map ${mapId}:`, error);
        return {
          map_id: mapId,
          stats: {
            total_views: 0,
            unique_viewers: 0,
            accounts_viewed: 0,
          },
          error: error instanceof Error ? error.message : 'Unknown error',
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
    console.error('[Batch Map Stats API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

