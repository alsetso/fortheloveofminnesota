import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

/**
 * GET /api/analytics/pin-stats
 * Get comprehensive statistics for a pin
 * Query params:
 *   - pin_id: UUID of the pin (required)
 *   - hours: Number of hours to look back (optional, null = all time)
 *   - include_viewers: Whether to include viewer list (optional, default false)
 *   - viewer_limit: Limit for viewer list (optional, default 10)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pinId = searchParams.get('pin_id');
    const hoursParam = searchParams.get('hours');
    const includeViewers = searchParams.get('include_viewers') === 'true';
    const viewerLimit = parseInt(searchParams.get('viewer_limit') || '10', 10);

    if (!pinId) {
      return NextResponse.json(
        { error: 'pin_id is required' },
        { status: 400 }
      );
    }

    const hours = hoursParam ? parseInt(hoursParam, 10) : null;

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
          setAll() {},
        },
      }
    );

    // Get basic pin stats
    const { data: stats, error: statsError } = await supabase.rpc('get_pin_stats', {
      p_pin_id: pinId,
      p_hours: hours,
    } as any);

    if (statsError) {
      console.error('Error fetching pin stats:', statsError);
      return NextResponse.json(
        { error: 'Failed to fetch pin stats', details: statsError.message },
        { status: 500 }
      );
    }

    const statsData = (stats as any)?.[0] || {
      total_views: 0,
      unique_viewers: 0,
      accounts_viewed: 0,
    };

    // Get time-based breakdown (last 24h, 7d, 30d, all time)
    const timeRanges = [
      { label: '24h', hours: 24 },
      { label: '7d', hours: 168 },
      { label: '30d', hours: 720 },
      { label: 'all', hours: null },
    ];

    const timeRangeStats = await Promise.all(
      timeRanges.map(async (range) => {
        const { data: rangeStats } = await supabase.rpc('get_pin_stats', {
          p_pin_id: pinId,
          p_hours: range.hours,
        } as any);
        return {
          label: range.label,
          ...((rangeStats as any)?.[0] || { total_views: 0, unique_viewers: 0, accounts_viewed: 0 }),
        };
      })
    );

    // Get first and last view timestamps
    const { data: firstView } = await supabase
      .from('pin_views')
      .select('viewed_at')
      .eq('pin_id', pinId)
      .order('viewed_at', { ascending: true })
      .limit(1)
      .maybeSingle() as { data: { viewed_at: string } | null; error: any };

    const { data: lastView } = await supabase
      .from('pin_views')
      .select('viewed_at')
      .eq('pin_id', pinId)
      .order('viewed_at', { ascending: false })
      .limit(1)
      .maybeSingle() as { data: { viewed_at: string } | null; error: any };

    // Get recent viewers if requested
    let viewers = null;
    if (includeViewers) {
      const { data: viewersData, error: viewersError } = await supabase.rpc('get_pin_viewers', {
        p_pin_id: pinId,
        p_limit: viewerLimit,
        p_offset: 0,
      } as any);

      if (!viewersError && viewersData) {
        viewers = viewersData;
      }
    }

    // Get view trend (views per day for last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: trendData } = await supabase
      .from('pin_views')
      .select('viewed_at')
      .eq('pin_id', pinId)
      .gte('viewed_at', thirtyDaysAgo.toISOString())
      .order('viewed_at', { ascending: true });

    // Group by date
    const dailyViews: Record<string, number> = {};
    if (trendData) {
      (trendData as { viewed_at: string }[]).forEach((view) => {
        const date = new Date(view.viewed_at).toISOString().split('T')[0];
        dailyViews[date] = (dailyViews[date] || 0) + 1;
      });
    }

    const viewTrend = Object.entries(dailyViews)
      .map(([date, count]) => ({ date, views: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      pin_id: pinId,
      stats: {
        total_views: statsData.total_views || 0,
        unique_viewers: statsData.unique_viewers || 0,
        accounts_viewed: statsData.accounts_viewed || 0,
      },
      time_ranges: timeRangeStats,
      first_viewed_at: (firstView as { viewed_at: string } | null)?.viewed_at || null,
      last_viewed_at: (lastView as { viewed_at: string } | null)?.viewed_at || null,
      viewers: viewers,
      view_trend: viewTrend,
    });
  } catch (error: any) {
    console.error('Error in GET /api/analytics/pin-stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

