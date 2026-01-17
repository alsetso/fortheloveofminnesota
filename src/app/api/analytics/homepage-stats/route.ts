import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * GET /api/analytics/homepage-stats
 * Returns /live page visit statistics (24h and total)
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op for server component
        },
      },
    });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Query 24-hour stats using public.get_url_stats for /live page
    const { data: stats24h, error: error24h } = await supabase.rpc('get_url_stats', {
      p_url: '/live',
      p_hours: 24,
    });

    // Query previous 24h (48-24h ago) for growth comparison
    const { count: countPrevious24h } = await supabase
      .from('url_visits')
      .select('*', { count: 'exact', head: true })
      .eq('url', '/live')
      .gte('viewed_at', fortyEightHoursAgo)
      .lt('viewed_at', twentyFourHoursAgo);

    // Query total stats (no time filter) for /live page
    const { data: statsTotal, error: errorTotal } = await supabase.rpc('get_url_stats', {
      p_url: '/live',
      p_hours: null,
    });

    // If RPC fails, query directly from url_visits table
    if (error24h || errorTotal) {
      const { count: count24h } = await supabase
        .from('url_visits')
        .select('*', { count: 'exact', head: true })
        .eq('url', '/live')
        .gte('viewed_at', twentyFourHoursAgo);

      const { count: countTotal } = await supabase
        .from('url_visits')
        .select('*', { count: 'exact', head: true })
        .eq('url', '/live');

      return NextResponse.json({
        last24Hours: count24h || 0,
        previous24Hours: countPrevious24h || 0,
        total: countTotal || 0,
      });
    }

    return NextResponse.json({
      last24Hours: stats24h?.[0]?.total_views || 0,
      previous24Hours: countPrevious24h || 0,
      total: statsTotal?.[0]?.total_views || 0,
    });
  } catch (error) {
    console.error('[homepage-stats] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homepage stats' },
      { status: 500 }
    );
  }
}
