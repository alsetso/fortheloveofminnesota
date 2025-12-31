import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/analytics/special-map-stats?map_identifier=mention
 * Returns view statistics for a special map
 * 
 * Query params:
 * - map_identifier: Required identifier (e.g., 'mention', 'fraud')
 * - hours: Optional number of hours to filter (default: all time)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapIdentifier = searchParams.get('map_identifier');
    const hoursParam = searchParams.get('hours');

    if (!mapIdentifier) {
      return NextResponse.json(
        { error: 'map_identifier is required' },
        { status: 400 }
      );
    }

    const hours = hoursParam ? parseInt(hoursParam, 10) : null;
    if (hoursParam && (isNaN(hours!) || hours! < 0)) {
      return NextResponse.json(
        { error: 'hours must be a positive integer' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
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

    // Get stats using public.get_special_map_stats function (wrapper for analytics.get_special_map_stats)
    const { data, error } = await supabase.rpc('get_special_map_stats', {
      p_map_identifier: mapIdentifier,
      p_hours: hours,
    } as any) as { data: Array<{ total_views: number; unique_viewers: number; accounts_viewed: number }> | null; error: any };

    if (error) {
      console.error('[Special Map Stats API] Error fetching stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch map stats', details: error.message },
        { status: 500 }
      );
    }

    // Function returns array with single row
    const stats = data && data.length > 0 ? data[0] : {
      total_views: 0,
      unique_viewers: 0,
      accounts_viewed: 0,
    };

    return NextResponse.json({ 
      success: true,
      stats 
    });
  } catch (error) {
    console.error('[Special Map Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

