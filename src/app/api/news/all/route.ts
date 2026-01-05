import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offsetParam = searchParams.get('offset');
    const limitParam = searchParams.get('limit');

    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    if (offset < 0 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid offset or limit. Limit must be between 1 and 100.' },
        { status: 400 }
      );
    }

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
    console.error('Error in GET /api/news/all:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

