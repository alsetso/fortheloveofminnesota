import { NextRequest, NextResponse } from 'next/server';
import { getLatestPrompt } from '@/features/news/services/newsService';
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

    let latestPrompt: Awaited<ReturnType<typeof getLatestPrompt>>;
    try {
      latestPrompt = await getLatestPrompt();
    } catch (error) {
      console.error('[News Latest] Error fetching latest prompt:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch news prompt',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    if (!latestPrompt) {
      return NextResponse.json(
        { error: 'No news data available. Please generate news first.' },
        { status: 404 }
      );
    }

    // Use anon client - RPC functions are SECURITY DEFINER and granted to anon
    // This works in production without requiring service role key
    const { createServerClient } = await import('@/lib/supabaseServer');
    let supabase;
    try {
      supabase = createServerClient();
    } catch (error) {
      console.error('[News Latest] Error creating server client:', error);
      return NextResponse.json(
        { 
          error: 'Failed to connect to database',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
    
    // Try RPC function first (most reliable, works with anon key via SECURITY DEFINER)
    let directArticles: any[] | null = null;
    let directError: any = null;
    
    try {
      // Use RPC to get articles by prompt_id - more reliable than direct schema query
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30); // Expand to 30 days
      
      const rpcResult = await (supabase.rpc as any)('get_news_by_date_range', {
        p_start_date: startDate.toISOString().split('T')[0],
        p_end_date: today.toISOString().split('T')[0],
      });
      
      if (rpcResult.error) {
        directError = rpcResult.error;
      } else {
        // Filter by prompt_id client-side
        directArticles = (rpcResult.data || []).filter((a: any) => a.prompt_id === latestPrompt.id);
      }
    } catch (error) {
      console.error('[News Latest] Error in RPC query:', error);
      directError = error;
    }
      
      if (!directError && directArticles && directArticles.length > 0) {
      console.log(`[News Latest] Found ${directArticles.length} articles via RPC for prompt ${latestPrompt.id}`);
      
        // Map RPC results to the expected format
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
      console.warn('[News Latest] RPC query failed or empty:', {
        error: directError,
        count: directArticles?.length || 0,
        promptId: latestPrompt.id,
      });
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

