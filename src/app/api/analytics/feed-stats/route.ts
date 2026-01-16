import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import type { PageStats } from '@/types/analytics';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/analytics/feed-stats
 * Returns feed statistics: total loads, unique visitors, and active accounts
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const feedStatsQuerySchema = z.object({
  hours: z.enum(['24', '168']).transform((val) => parseInt(val, 10)).default(24),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, feedStatsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { hours } = validation.data;

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

    // Get feed statistics using the new get_page_stats function
    // Feed page URL is '/feed'
    const { data: stats, error } = await supabase.rpc('get_page_stats', {
      p_page_url: '/feed',
      p_hours: hours,
    } as any);

    if (error) {
      console.error('Error fetching feed stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feed statistics', details: error.message },
        { status: 500 }
      );
    }

        // Return stats with default values if null
        const statsArray = stats as PageStats[] | null;
        return NextResponse.json({
          total_loads: statsArray?.[0]?.total_views || 0,
          unique_visitors: statsArray?.[0]?.unique_viewers || 0,
          accounts_active: statsArray?.[0]?.accounts_viewed || 0,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in feed-stats route:', error);
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

