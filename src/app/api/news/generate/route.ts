import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '@/lib/adminHelpers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { hasNewsGeneratedToday, saveNewsGen } from '@/features/news/services/newsService';

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

export async function POST(request: NextRequest) {
  try {
    // Check admin access
    const adminCheck = await requireAdminApiAccess(request);
    if (adminCheck.response) {
      return adminCheck.response;
    }
    const auth = adminCheck.auth;
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if news was already generated today
    const alreadyGenerated = await hasNewsGeneratedToday();
    if (alreadyGenerated) {
      return NextResponse.json(
        { error: 'News has already been generated today. Only one API call per day is allowed.' },
        { status: 400 }
      );
    }

    // Get account ID - get user from supabase to ensure proper auth context
    const supabase = await createServerClientWithAuth(cookies());
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Get first account for user (users can have multiple accounts)
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (accountError) {
      console.error('Error fetching account:', accountError);
      return NextResponse.json(
        { error: 'Failed to fetch account', details: accountError.message },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: 'Account not found. Please complete your profile setup.' },
        { status: 404 }
      );
    }

    const accountId = (accounts[0] as { id: string }).id;

    // Default query: "Minnesota, MN" with 24 hours
    const query = 'Minnesota, MN';
    const limit = '50';
    const timePublished = '1d'; // 24 hours
    const country = 'US';
    const lang = 'en';

    const apiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RapidAPI key not configured' },
        { status: 500 }
      );
    }

    // Build URL
    const baseUrl = 'https://real-time-news-data.p.rapidapi.com/search';
    const urlParams = new URLSearchParams();
    urlParams.append('query', query);
    urlParams.append('limit', limit);
    urlParams.append('time_published', timePublished);
    urlParams.append('country', country);
    urlParams.append('lang', lang);

    const url = `${baseUrl}?${urlParams.toString()}`;

    // Make API call
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

    // Prepare response for storage
    const apiResponse = {
      requestId: data.request_id,
      articles: formattedArticles,
      count: formattedArticles.length,
      query,
      limit,
      timePublished,
      country,
      lang,
      generatedAt: new Date().toISOString(),
    };

    // Save to database
    const savedNews = await saveNewsGen(accountId, query, apiResponse);

    if (!savedNews) {
      return NextResponse.json(
        { error: 'Failed to save news to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'News generated and saved successfully',
      data: apiResponse,
    });
  } catch (error) {
    console.error('Error in POST /api/news/generate:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

