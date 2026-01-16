import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/news/by-date
 * Get news articles by date range
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const newsByDateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(1000)).optional(),
}).refine(
  (data) => data.date || data.startDate,
  { message: 'Either date or startDate parameter is required' }
);

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, newsByDateQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { date: dateParam, startDate: startDateParam, endDate: endDateParam, limit: limitParam } = validation.data;
        
        let startDate: string;
        let endDate: string | null = null;

        if (dateParam) {
          startDate = dateParam;
          endDate = dateParam;
        } else {
          startDate = startDateParam!;
          endDate = endDateParam || null;
        }

    const supabase = createServiceClient();

    // Use RPC function to query news schema
    // Note: Function must be created via migration 328 first
    const { data, error } = await (supabase.rpc as any)('get_news_by_date_range', {
      p_start_date: startDate,
      p_end_date: endDate || startDate,
    });

    if (error) {
      console.error('Error fetching news by date:', error);
      
      // If function doesn't exist, return empty result (migration not run yet)
      if (error.message?.includes('Could not find the function') || error.message?.includes('schema cache')) {
        return NextResponse.json({
          success: true,
          data: {
            articles: [],
            count: 0,
            startDate,
            endDate: endDate || startDate,
          },
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch news articles', details: error.message },
        { status: 500 }
      );
    }

    // Format articles to match expected structure
    let articles = (data || []).map((article: any) => ({
      id: article.article_id, // Use article_id as the ID for routing
      article_id: article.article_id, // Keep both for compatibility
      title: article.title,
      link: article.link,
      snippet: article.snippet,
      photoUrl: article.photo_url,
      thumbnailUrl: article.thumbnail_url,
      publishedAt: article.published_at,
      published_date: article.published_date,
      authors: article.authors || [],
      source: {
        url: article.source_url,
        name: article.source_name,
        logoUrl: article.source_logo_url,
        faviconUrl: article.source_favicon_url,
        publicationId: article.source_publication_id,
      },
      relatedTopics: article.related_topics || [],
    }));

        // Apply limit if specified
        if (limitParam) {
          articles = articles.slice(0, limitParam);
        }

        return NextResponse.json({
          success: true,
          data: {
            articles,
            count: articles.length,
            startDate,
            endDate: endDate || startDate,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/news/by-date:', error);
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

