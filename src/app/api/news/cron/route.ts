import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { hasNewsGeneratedRecently, saveNewsGenWithService } from '@/features/news/services/newsService';

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
 * Cron endpoint for automatic news generation
 * Protected by CRON_SECRET environment variable
 * Runs every 24 hours via Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (optional)
    // Vercel Cron jobs are automatically secured, but you can add CRON_SECRET for extra protection
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const url = new URL(request.url);
      const secretParam = url.searchParams.get('secret');
      const authHeader = request.headers.get('authorization');
      
      // Allow access via query param or auth header (for manual testing)
      // Vercel cron jobs are automatically authenticated
      if (secretParam !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // Check if this is a Vercel cron request (they're automatically secured)
        // If no secret matches and it's not from Vercel, reject
        const isVercelCron = request.headers.get('user-agent')?.includes('vercel') || 
                            request.headers.get('x-vercel-id');
        if (!isVercelCron) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          );
        }
      }
    }

    // Check if news was already generated in the last 24 hours
    const alreadyGenerated = await hasNewsGeneratedRecently();
    if (alreadyGenerated) {
      return NextResponse.json(
        { 
          success: true,
          message: 'News already generated in the last 24 hours. Skipping.',
          skipped: true
        },
        { status: 200 }
      );
    }

    // Get the first admin account to associate with the generation
    const supabase = createServiceClient();
    const { data: adminAccounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (accountError || !adminAccounts || adminAccounts.length === 0) {
      console.error('[News Cron] No admin account found:', accountError);
      return NextResponse.json(
        { error: 'No admin account found for news generation' },
        { status: 500 }
      );
    }

    const accountId = adminAccounts[0].id;

    // Default query: "Minnesota, MN" with 24 hours
    const query = 'Minnesota, MN';
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

    // Build URL (no limit to get all news)
    const baseUrl = 'https://real-time-news-data.p.rapidapi.com/search';
    const urlParams = new URLSearchParams();
    urlParams.append('query', query);
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
        console.error('[News Cron] SSL certificate error:', fetchError.message);
        return NextResponse.json(
          { 
            error: 'SSL certificate validation failed',
            details: fetchError.message
          },
          { status: 502 }
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.error('[News Cron] RapidAPI error:', response.status, errorText);
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

    // Format the response and remove duplicates by article_id
    const articleMap = new Map<string, typeof data.data[0]>();
    (data.data || []).forEach((article) => {
      if (!articleMap.has(article.article_id)) {
        articleMap.set(article.article_id, article);
      }
    });

    const formattedArticles = Array.from(articleMap.values()).map((article) => ({
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
      timePublished,
      country,
      lang,
      generatedAt: new Date().toISOString(),
    };

    // Save to database using service client
    const savedNews = await saveNewsGenWithService(accountId, query, apiResponse);

    if (!savedNews) {
      return NextResponse.json(
        { error: 'Failed to save news to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'News generated and saved successfully',
      data: {
        count: formattedArticles.length,
        requestId: data.request_id,
        generatedAt: apiResponse.generatedAt,
      },
    });
  } catch (error) {
    console.error('[News Cron] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

