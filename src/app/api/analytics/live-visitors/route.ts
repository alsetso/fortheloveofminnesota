import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/analytics/live-visitors
 * Returns visitor statistics for the live page
 * Public endpoint - no authentication required
 */
export async function GET(_request: NextRequest) {
  try {
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
            // Route handlers can set cookies, but this endpoint doesn't need to
          },
        },
      }
    );

    // Get today's date range (start of today to now)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    // Get total visitors (all time)
    const { count: totalCount, error: totalError } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('page_url', '/live');

    // Get today's visitors
    const { count: todayCount, error: todayError } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .eq('page_url', '/live')
      .gte('viewed_at', todayStart.toISOString());

    if (totalError || todayError) {
      console.error('Error fetching visitor stats:', { totalError, todayError });
      return NextResponse.json(
        { error: 'Failed to fetch visitor statistics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      totalVisitors: totalCount || 0,
      todayVisitors: todayCount || 0,
    });
  } catch (error) {
    console.error('Error in live-visitors route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

