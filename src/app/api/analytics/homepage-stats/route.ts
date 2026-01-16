import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import type { PageStats } from '@/types/analytics';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';

/**
 * GET /api/analytics/homepage-stats
 * Returns homepage statistics for last 24 hours, 7 days, and 30 days
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Public endpoint - no authentication required
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
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

    // Get homepage statistics for different time periods
    // Homepage URL is '/'
    const [stats24h, stats7d, stats30d, allTimeStats] = await Promise.all([
      supabase.rpc('get_page_stats', {
        p_page_url: '/',
        p_hours: 24,
      } as any),
      supabase.rpc('get_page_stats', {
        p_page_url: '/',
        p_hours: 168, // 7 days
      } as any),
      supabase.rpc('get_page_stats', {
        p_page_url: '/',
        p_hours: 720, // 30 days
      } as any),
      // Get all-time stats (use a very large number of hours, e.g., 10 years)
      supabase.rpc('get_page_stats', {
        p_page_url: '/',
        p_hours: 87600, // ~10 years
      } as any),
    ]);

    // Extract stats with default values
    const stats24hArray = stats24h.data as PageStats[] | null;
    const stats7dArray = stats7d.data as PageStats[] | null;
    const stats30dArray = stats30d.data as PageStats[] | null;
    const allTimeArray = allTimeStats.data as PageStats[] | null;

    return NextResponse.json({
      last24Hours: {
        unique_visitors: stats24hArray?.[0]?.unique_viewers || 0,
        total_views: stats24hArray?.[0]?.total_views || 0,
        accounts_viewed: stats24hArray?.[0]?.accounts_viewed || 0,
      },
      last7Days: {
        unique_visitors: stats7dArray?.[0]?.unique_viewers || 0,
        total_views: stats7dArray?.[0]?.total_views || 0,
        accounts_viewed: stats7dArray?.[0]?.accounts_viewed || 0,
      },
      last30Days: {
        unique_visitors: stats30dArray?.[0]?.unique_viewers || 0,
        total_views: stats30dArray?.[0]?.total_views || 0,
        accounts_viewed: stats30dArray?.[0]?.accounts_viewed || 0,
      },
        allTime: {
          unique_visitors: allTimeArray?.[0]?.unique_viewers || 0,
          total_views: allTimeArray?.[0]?.total_views || 0,
          accounts_viewed: allTimeArray?.[0]?.accounts_viewed || 0,
        },
      });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in homepage-stats route:', error);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: false,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}






