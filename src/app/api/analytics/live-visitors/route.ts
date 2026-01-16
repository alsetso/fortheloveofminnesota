import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/analytics/live-visitors?period=today|total
 * Returns visitor statistics for the live page
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const liveVisitorsQuerySchema = z.object({
  period: z.enum(['today', 'total']).default('today'),
});

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

        // Validate query parameters
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, liveVisitorsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { period } = validation.data;

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
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in live-visitors route:', error);
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

