import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { hasNewsGeneratedRecently, savePromptWithService } from '@/features/news/services/newsService';
import { fetchNewsFromRapidAPI, deduplicateArticles, formatNewsArticles } from '@/features/news/services/newsApiService';
import { handleApiError } from '@/lib/apiErrorHandler';

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

    const accountId = (adminAccounts[0] as { id: string }).id;

    // Default query: "Minnesota, MN" with 24 hours
    const query = 'Minnesota, MN';
    const timePublished = '1d'; // 24 hours
    const country = 'US';
    const lang = 'en';

    // Fetch news from RapidAPI using shared service
    let data;
    try {
      data = await fetchNewsFromRapidAPI({
        query,
        timePublished,
        country,
        lang,
        // No limit - get all news
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('SSL certificate')) {
        return NextResponse.json(
          { 
            error: 'SSL certificate validation failed',
            details: error.message
          },
          { status: 502 }
        );
      }
      return handleApiError(error, '[News Cron] Failed to fetch news from RapidAPI');
    }

    // Deduplicate and format articles
    const deduplicated = deduplicateArticles(data.data || []);
    const formattedArticles = formatNewsArticles(deduplicated);

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

    // Save to database using service client (uses news.prompt, trigger auto-extracts to news.generated)
    const savedPrompt = await savePromptWithService(accountId, query, apiResponse);

    if (!savedPrompt) {
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
    return handleApiError(error, '[News Cron] Error');
  }
}

