import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const limitParam = searchParams.get('limit');

    if (!dateParam && !startDateParam) {
      return NextResponse.json(
        { error: 'Either date or startDate parameter is required' },
        { status: 400 }
      );
    }

    let startDate: string;
    let endDate: string | null = null;

    if (dateParam) {
      // Single date query
      startDate = dateParam;
      endDate = dateParam;
    } else {
      startDate = startDateParam!;
      endDate = endDateParam || null;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (endDate && !dateRegex.test(endDate)) {
      return NextResponse.json(
        { error: 'Invalid endDate format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Use RPC function to query news schema
    // Note: Function must be created via migration 328 first
    const { data, error } = await supabase.rpc('get_news_by_date_range', {
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
      const limit = parseInt(limitParam, 10);
      if (limit > 0) {
        articles = articles.slice(0, limit);
      }
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
    console.error('Error in GET /api/news/by-date:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

