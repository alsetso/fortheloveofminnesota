import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import type { NewsArticle } from '@/types/news';

/**
 * GET /api/news/[id]
 * Fetch a single news article by article_id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id;
    const supabase = createServiceClient();

    // Use RPC function to query by article_id
    const { data, error } = await supabase.rpc('get_news_by_date_range', {
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
    console.error('Error in GET /api/news/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

