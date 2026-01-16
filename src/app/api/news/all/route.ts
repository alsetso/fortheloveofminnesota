import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

/**
 * GET /api/news/all
 * Get all news articles with pagination
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Public endpoint - no authentication required
 */
const newsAllQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, newsAllQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { offset, limit } = validation.data;

    const supabase = createServerClient();

    // Query news.generated table directly, ordered by published_at DESC (most recent first)
    const { data, error, count } = await (supabase as any)
      .schema('news')
      .from('generated')
      .select('*', { count: 'exact' })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching all news:', error);
      return NextResponse.json(
        { error: 'Failed to fetch news articles', details: error.message },
        { status: 500 }
      );
    }

    // Format articles to match expected structure
    const articles = (data || []).map((article: any) => ({
      id: article.article_id,
      article_id: article.article_id,
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

    const total = count || 0;
    const hasMore = offset + limit < total;

        return NextResponse.json({
          success: true,
          data: {
            articles,
            pagination: {
              offset,
              limit,
              total,
              hasMore,
            },
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/news/all:', error);
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

