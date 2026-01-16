import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/security/apiKeys';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

interface NewsArticle {
  article_id: string;
  title: string;
  link: string;
  snippet: string;
  photo_url: string | null;
  thumbnail_url: string | null;
  published_datetime_utc: string;
  authors: string[];
  source_url: string;
  source_name: string;
  source_logo_url: string | null;
  source_favicon_url: string | null;
  source_publication_id: string;
  related_topics: string[];
}

interface NewsResponse {
  status: string;
  request_id: string;
  data: NewsArticle[];
}

/**
 * GET /api/news
 * Search news articles from RapidAPI
 * 
 * Security:
 * - Rate limited: 100 requests/minute (public)
 * - Query parameter validation
 * - Server-only API key
 * - Public endpoint - no authentication required
 */
const newsQuerySchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(500)).optional(),
  time_published: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  country: z.string().length(2).optional(),
  lang: z.string().length(2).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, newsQuerySchema);
        if (!validation.success) {
          return validation.error;
        }
        
        const { query, limit, time_published: timePublished, source, country, lang } = validation.data;

        // Get server-only API key
        let apiKey: string;
        try {
          apiKey = getApiKey('RAPIDAPI');
        } catch (error) {
          return NextResponse.json(
            { error: 'RapidAPI key not configured' },
            { status: 500 }
          );
        }

        // Build URL with optional parameters
        const baseUrl = 'https://real-time-news-data.p.rapidapi.com/search';
        const urlParams = new URLSearchParams();
        urlParams.append('query', query);
        
        const limitValue = limit || 50;
        urlParams.append('limit', limitValue.toString());
        
        urlParams.append('time_published', timePublished || '1y');
        
        if (source) {
          urlParams.append('source', source);
        }
        
        urlParams.append('country', country || 'US');
        urlParams.append('lang', lang || 'en');
    
        const apiUrl = `${baseUrl}?${urlParams.toString()}`;

        let response: Response;
        try {
          response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': 'real-time-news-data.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
      });
    } catch (fetchError: any) {
      // Handle SSL/certificate errors
      if (fetchError?.code === 'ERR_TLS_CERT_ALTNAME_INVALID' || fetchError?.message?.includes('certificate')) {
        console.error('SSL certificate error with news API endpoint:', fetchError.message);
        return NextResponse.json(
          { 
            error: 'SSL certificate validation failed. The news API endpoint may be temporarily unavailable or misconfigured.',
            details: 'Please try again later or contact support if the issue persists.'
          },
          { status: 502 }
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error('RapidAPI error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'Failed to fetch news data', 
          details: errorText,
          status: response.status 
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const data: NewsResponse = await response.json();

    // Check if status is OK
    if (data.status !== 'OK') {
      return NextResponse.json(
        { 
          error: 'News API returned non-OK status', 
          status: data.status 
        },
        { status: 502 }
      );
    }

    // Format the response
    const formattedArticles = (data.data || []).map((article) => ({
      id: article.article_id,
      title: article.title,
      link: article.link,
      snippet: article.snippet,
      photoUrl: article.photo_url,
      thumbnailUrl: article.thumbnail_url,
      publishedAt: article.published_datetime_utc,
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

    // Generate curl command for debugging
    const curlCommand = `curl --request GET \\
  --url '${url}' \\
  --header 'x-rapidapi-host: real-time-news-data.p.rapidapi.com' \\
  --header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'`;

        return NextResponse.json({
          requestId: data.request_id,
          articles: formattedArticles,
          count: formattedArticles.length,
          curl: curlCommand,
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error in GET /api/news:', error);
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

