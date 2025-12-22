import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RapidAPI key not configured' },
        { status: 500 }
      );
    }

    const encodedQuery = encodeURIComponent(query);
    
    // Build URL - try with all parameters first, fallback to simpler version if needed
    const baseUrl = 'https://real-time-news-data.p.rapidapi.com/search';
    const url = `${baseUrl}?query=${encodedQuery}&limit=50&time_published=1y&country=US&lang=en`;

    let response: Response;
    try {
      response = await fetch(url, {
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
    console.error('Error in GET /api/news:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
