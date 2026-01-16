import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/analytics/special-map-stats?map_identifier=mention
 * Returns view statistics for a special map
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const specialMapStatsQuerySchema = z.object({
  map_identifier: z.string().min(1).max(100),
  hours: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(87600)).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, specialMapStatsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { map_identifier: mapIdentifier, hours } = validation.data;

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
        if (process.env.NODE_ENV === 'development') {
          console.error('[Special Map Stats API] Error:', error);
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

