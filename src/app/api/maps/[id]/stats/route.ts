import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { Database } from '@/types/supabase';

/**
 * GET /api/maps/[id]/stats
 * Returns view statistics for a map
 * 
 * Query params:
 * - hours: Optional number of hours to filter (default: all time)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hoursParam = searchParams.get('hours');

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

    // Get stats using public.get_map_stats function
    const { data, error } = await supabase.rpc('get_map_stats', {
      p_map_id: id,
      p_hours: hours,
    } as any) as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };

    if (error) {
      console.error('[Map Stats API] Error fetching map stats:', error);
      return createErrorResponse('Failed to fetch map stats', 500, error.message);
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
    console.error('[Map Stats API] Error:', error);
    return createErrorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : undefined
    );
  }
}

