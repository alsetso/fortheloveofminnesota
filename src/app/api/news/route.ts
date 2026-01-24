import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';
import { cache } from 'react';

// Cache news articles for 5 minutes (300 seconds) for fast reloads
// Revalidates automatically when new articles are added
export const revalidate = 300; // 5 minutes
export const dynamic = 'force-dynamic'; // Still allow dynamic params

interface NewsArticle {
  id: string;
  prompt_id: string;
  article_id: string;
  title: string;
  link: string;
  snippet: string | null;
  photo_url: string | null;
  thumbnail_url: string | null;
  published_at: string;
  published_date: string;
  authors: string[];
  source_url: string | null;
  source_name: string | null;
  source_logo_url: string | null;
  source_favicon_url: string | null;
  source_publication_id: string | null;
  related_topics: string[];
  created_at: string;
  updated_at: string;
}

// Cached function to fetch news articles (server-side cache for 5 minutes)
// Cache key includes all parameters to ensure different queries are cached separately
const getCachedNews = cache(async (
  limit: number, 
  offset: number, 
  startDate?: string | null, 
  endDate?: string | null
) => {
  const supabase = await createServerClientWithAuth();
  
  let query = (supabase as any)
    .schema('news')
    .from('generated')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply date filters if provided
  if (startDate) {
    query = query.gte('published_date', startDate);
  }
  if (endDate) {
    query = query.lte('published_date', endDate);
  }

  const { data: articles, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch news articles: ${error.message}`);
  }

  // Transform authors from JSONB to array
  const transformedArticles = (articles || []).map((article) => ({
    ...article,
    authors: Array.isArray(article.authors) ? article.authors : [],
    related_topics: Array.isArray(article.related_topics) ? article.related_topics : [],
  }));

  return transformedArticles;
});

// Public route - news articles are visible to all users (authenticated and anonymous)
// Rate limited: 100 requests/minute per IP
// Cached: 5 minutes server-side for fast reloads
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      try {
        const searchParams = req.nextUrl.searchParams;
        const limitParam = searchParams.get('limit') || '50';
        const offsetParam = searchParams.get('offset') || '0';
        const limit = Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100); // Clamp between 1-100
        const offset = Math.max(parseInt(offsetParam, 10) || 0, 0); // Must be >= 0
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        
        // Validate date format if provided
        if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          return NextResponse.json(
            { error: 'Invalid start_date format. Use YYYY-MM-DD' },
            { status: 400 }
          );
        }
        if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          return NextResponse.json(
            { error: 'Invalid end_date format. Use YYYY-MM-DD' },
            { status: 400 }
          );
        }

        // Use cached function for server-side caching
        const articles = await getCachedNews(limit, offset, startDate, endDate);

        // Add cache headers for client-side caching
        const response = NextResponse.json({
          articles,
          count: articles.length,
          limit,
          offset,
        });

        // Cache-Control: public, max-age=60 means clients can cache for 1 minute
        // The server-side cache (revalidate=300) handles the 5-minute server cache
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

        return response;
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      // No auth required - public access
      requireAuth: false,
      requireAdmin: false,
      // Rate limit: 100 requests/minute per IP (public rate limit)
      rateLimit: 'public',
    }
  );
}
