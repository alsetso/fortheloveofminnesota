import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import type { PageStats } from '@/types/analytics';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/analytics/atlas-map-stats?table=cities&hours=24
 * Returns view statistics for an atlas map page
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const atlasMapStatsQuerySchema = z.object({
  table: z.string().min(1).max(100),
  hours: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(87600)).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, atlasMapStatsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { table, hours } = validation.data;

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
        if (process.env.NODE_ENV === 'development') {
          console.error('[Atlas Map Stats API] Error:', error);
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

