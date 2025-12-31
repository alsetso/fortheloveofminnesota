import { NextRequest, NextResponse } from 'next/server';
import { getLatestPrompt } from '@/features/news/services/newsService';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const latestPrompt = await getLatestPrompt();

    if (!latestPrompt) {
      return NextResponse.json(
        { error: 'No news data available. Please generate news first.' },
        { status: 404 }
      );
    }

    // Get articles from generated table using RPC
    const supabase = createServiceClient();
    
    // Get all articles for this prompt (we'll filter by prompt_id in the function or use a different approach)
    // For now, get articles from the latest prompt by using a date range
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 1); // Last 24 hours
    
    const { data: articlesData, error: articlesError } = await supabase.rpc('get_news_by_date_range', {
      p_start_date: startDate.toISOString().split('T')[0],
      p_end_date: today.toISOString().split('T')[0],
    });
    
    // Filter by prompt_id client-side (or create another RPC function)
    const filteredArticles = (articlesData || []).filter((a: any) => a.prompt_id === latestPrompt.id).slice(0, 100);

    // If articles table has data, use it
    if (!articlesError && filteredArticles && filteredArticles.length > 0) {
      const articles = filteredArticles.map((article: any) => ({
        id: article.article_id,
        title: article.title,
        link: article.link,
        snippet: article.snippet,
        photoUrl: article.photo_url,
        thumbnailUrl: article.thumbnail_url,
        publishedAt: article.published_at,
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
      });
    }

    // Fallback to JSONB extraction from prompt
    const apiResponse = latestPrompt.api_response as {
      requestId?: string;
      articles?: unknown[];
      count?: number;
      query?: string;
      generatedAt?: string;
    };

    return NextResponse.json({
      success: true,
      data: {
        articles: apiResponse.articles || [],
        count: apiResponse.count || 0,
        requestId: apiResponse.requestId,
        query: apiResponse.query || latestPrompt.user_input,
        generatedAt: apiResponse.generatedAt || latestPrompt.created_at,
        createdAt: latestPrompt.created_at,
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

