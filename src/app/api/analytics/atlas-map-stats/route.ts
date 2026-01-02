import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import type { PageStats } from '@/types/analytics';

/**
 * GET /api/analytics/atlas-map-stats?table=cities&hours=24
 * Returns view statistics for an atlas map page
 * 
 * Query params:
 * - table: Required atlas table slug (e.g., 'cities', 'lakes')
 * - hours: Optional number of hours to filter (default: all time, null)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const hoursParam = searchParams.get('hours');

    if (!table) {
      return NextResponse.json(
        { error: 'table parameter is required' },
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

    // Get stats using get_page_stats function
    // Atlas map pages use URL pattern: /map/atlas/{table}
    const pageUrl = `/map/atlas/${table}`;
    
    const { data, error } = await supabase.rpc('get_page_stats', {
      p_page_url: pageUrl,
      p_hours: hours,
    } as any) as { data: PageStats[] | null; error: any };

    if (error) {
      console.error('[Atlas Map Stats API] Error fetching stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch atlas map stats', details: error.message },
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
      page_url: pageUrl,
      stats 
    });
  } catch (error) {
    console.error('[Atlas Map Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

