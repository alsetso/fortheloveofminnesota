import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import type { NewsArticle } from '@/types/news';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validatePathParams } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * GET /api/news/[id]
 * Fetch a single news article by article_id
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Path parameter validation
 * - Public endpoint - no authentication required
 */
const newsIdPathSchema = z.object({
  id: z.string().min(1).max(200),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // Validate path parameters
        const pathValidation = validatePathParams(params, newsIdPathSchema);
        if (!pathValidation.success) {
          return pathValidation.error;
        }
        
        const { id: articleId } = pathValidation.data;
    const supabase = createServiceClient();

    // Use RPC function to query by article_id
    const { data, error } = await (supabase.rpc as any)('get_news_by_date_range', {
      p_start_date: '2000-01-01',
      p_end_date: '2100-01-01',
    });

    if (error) {
      console.error('Error fetching article:', error);
      return NextResponse.json(
        { error: 'Failed to fetch article', details: error.message },
        { status: 500 }
      );
    }

    // Find article by article_id or id
    const article = (data || []).find((a: any) => 
      a.article_id === articleId || a.id === articleId
    );

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Format article to match expected structure
    const formattedArticle: NewsArticle = {
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
    };

        return NextResponse.json({
          success: true,
          data: {
            article: formattedArticle,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/news/[id]:', error);
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

