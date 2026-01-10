import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/analytics/live-visitors?period=today|total
 * Returns visitor statistics for the live page
 * Query params: period (today or total, default today)
 * Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
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

    // Get period filter from query params (today or total)
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get('period');
    const period = periodParam === 'total' ? 'total' : 'today';

    let visitorCount: number;
    let error;

    if (period === 'today') {
      // Get today's date range (start of today to now)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const result = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('page_url', '/live')
        .gte('viewed_at', todayStart.toISOString());
      
      visitorCount = result.count || 0;
      error = result.error;
    } else {
      // Get total visitors (all time)
      const result = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('page_url', '/live');
      
      visitorCount = result.count || 0;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching visitor stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch visitor statistics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      visitors: visitorCount,
      period: period,
    });
  } catch (error) {
    console.error('Error in live-visitors route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

