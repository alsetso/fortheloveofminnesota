import { NextRequest, NextResponse } from 'next/server';
import { getLatestPrompt } from '@/features/news/services/newsService';
import { createServiceClient } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/server/newsRateLimit';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 10 requests per 60 seconds per IP (relaxed)
    const rateLimit = checkRateLimit(request);
    if (!rateLimit.allowed) {
      const resetSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please wait before making another request.',
          retryAfter: resetSeconds,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
            'Retry-After': resetSeconds.toString(),
          },
        }
      );
    }

    const latestPrompt = await getLatestPrompt();

    if (!latestPrompt) {
      return NextResponse.json(
        { error: 'No news data available. Please generate news first.' },
        { status: 404 }
      );
    }

    // Get articles from generated table - query directly by prompt_id (most reliable)
    const supabase = createServiceClient();
    
    // First, try direct query by prompt_id (most reliable, bypasses date filtering issues)
    const { data: directArticles, error: directError } = await (supabase as any)
      .schema('news')
      .from('generated')
      .select('*')
      .eq('prompt_id', latestPrompt.id)
      .order('published_at', { ascending: false });
    
    if (!directError && directArticles && directArticles.length > 0) {
      console.log(`[News Latest] Found ${directArticles.length} articles via direct query for prompt ${latestPrompt.id}`);
      
      // Map direct query results to the expected format
      const articles = directArticles.map((article: any) => ({
        id: article.article_id,
        article_id: article.article_id,
        title: article.title || 'Untitled',
        link: article.link || '',
        snippet: article.snippet || '',
        photoUrl: article.photo_url || null,
        thumbnailUrl: article.thumbnail_url || null,
        publishedAt: article.published_at,
        published_date: article.published_date,
        authors: Array.isArray(article.authors) ? article.authors : [],
        source: {
          url: article.source_url || '',
          name: article.source_name || 'Unknown Source',
          logoUrl: article.source_logo_url || null,
          faviconUrl: article.source_favicon_url || null,
          publicationId: article.source_publication_id || '',
        },
        relatedTopics: Array.isArray(article.related_topics) ? article.related_topics : [],
      }));

      const apiResponse = latestPrompt.api_response as {
        requestId?: string;
        query?: string;
        generatedAt?: string;
      };

      return NextResponse.json({
        success: true,
        data: {
          articles,
          count: articles.length,
          requestId: apiResponse.requestId,
          query: apiResponse.query || latestPrompt.user_input,
          generatedAt: apiResponse.generatedAt || latestPrompt.created_at,
          createdAt: latestPrompt.created_at,
        },
      }, {
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      });
    } else {
      console.warn('[News Latest] Direct query failed or empty:', {
        error: directError,
        count: directArticles?.length || 0,
        promptId: latestPrompt.id,
      });
    }

    // Fallback: Try RPC function with wide date range (if direct query failed)
    if (!directArticles || directArticles.length === 0) {
      console.log('[News Latest] Trying RPC fallback...');
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30); // Expand to 30 days to catch all articles
      
      const { data: articlesData, error: articlesError } = await (supabase.rpc as any)('get_news_by_date_range', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: today.toISOString().split('T')[0],
      });
      
      if (articlesError) {
        console.error('[News Latest] RPC error:', articlesError);
      }
      
      // Filter by prompt_id client-side
      const filteredArticles = (articlesData || []).filter((a: any) => a.prompt_id === latestPrompt.id);
      
      if (filteredArticles && filteredArticles.length > 0) {
        console.log(`[News Latest] Found ${filteredArticles.length} articles via RPC for prompt ${latestPrompt.id}`);
      const articles = filteredArticles.map((article: any) => ({
        id: article.article_id,
        article_id: article.article_id,
        title: article.title || 'Untitled',
        link: article.link || '',
        snippet: article.snippet || '',
        photoUrl: article.photo_url || null,
        thumbnailUrl: article.thumbnail_url || null,
        publishedAt: article.published_at,
        published_date: article.published_date,
        authors: Array.isArray(article.authors) ? article.authors : [],
        source: {
          url: article.source_url || '',
          name: article.source_name || 'Unknown Source',
          logoUrl: article.source_logo_url || null,
          faviconUrl: article.source_favicon_url || null,
          publicationId: article.source_publication_id || '',
        },
        relatedTopics: Array.isArray(article.related_topics) ? article.related_topics : [],
      }));

      const apiResponse = latestPrompt.api_response as {
        requestId?: string;
        query?: string;
        generatedAt?: string;
      };

      return NextResponse.json({
        success: true,
        data: {
          articles,
          count: articles.length,
          requestId: apiResponse.requestId,
          query: apiResponse.query || latestPrompt.user_input,
          generatedAt: apiResponse.generatedAt || latestPrompt.created_at,
          createdAt: latestPrompt.created_at,
        },
      }, {
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      });
      } else {
        console.warn('[News Latest] RPC returned no articles for prompt:', latestPrompt.id);
      }
    }

    // Final fallback: Extract from JSONB in prompt (if news.generated is empty or trigger didn't run)
    console.log('[News Latest] Falling back to JSONB extraction from prompt');
    const apiResponse = latestPrompt.api_response as {
      requestId?: string;
      articles?: unknown[];
      count?: number;
      query?: string;
      generatedAt?: string;
    };

    const fallbackArticles = (apiResponse.articles || []) as any[];

    return NextResponse.json({
      success: true,
      data: {
        articles: fallbackArticles,
        count: fallbackArticles.length,
        requestId: apiResponse.requestId,
        query: apiResponse.query || latestPrompt.user_input,
        generatedAt: apiResponse.generatedAt || latestPrompt.created_at,
        createdAt: latestPrompt.created_at,
      },
    }, {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/news/latest:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

