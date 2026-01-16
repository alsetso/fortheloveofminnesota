import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/news/dates-with-news
 * Get dates that have news articles
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const datesWithNewsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, datesWithNewsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { startDate: startDateParam, endDate: endDateParam } = validation.data;
        const endDate = endDateParam || startDateParam;

    const supabase = createServiceClient();

    // Use RPC function to query news schema
    // Note: Function must be created via migration 328 first
    const { data, error } = await (supabase.rpc as any)('get_dates_with_news_counts', {
      p_start_date: startDateParam,
      p_end_date: endDate,
    });

    if (error) {
      console.error('Error fetching dates with news:', error);
      
      // If function doesn't exist, return empty result (migration not run yet)
      if (error.message?.includes('Could not find the function') || error.message?.includes('schema cache')) {
        return NextResponse.json({
          success: true,
          data: {
            dates: {},
            dateList: [],
          },
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch dates with news', details: error.message },
        { status: 500 }
      );
    }

    // Format response (RPC already returns grouped data)
    const dateMap: Record<string, number> = {};
    const dateList: Array<{ date: string; article_count: number }> = [];
    
    (data || []).forEach((row: any) => {
      const date = row.date;
      const count = Number(row.article_count);
      dateMap[date] = count;
      dateList.push({ date, article_count: count });
    });

        return NextResponse.json({
          success: true,
          data: {
            dates: dateMap,
            dateList: dateList,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/news/dates-with-news:', error);
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

