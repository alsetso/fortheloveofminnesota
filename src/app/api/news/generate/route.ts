import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '@/lib/adminHelpers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { savePrompt } from '@/features/news/services/newsService';
import { fetchNewsFromRapidAPI, deduplicateArticles, formatNewsArticles } from '@/features/news/services/newsApiService';
import { handleApiError } from '@/lib/apiErrorHandler';

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

    // No 24-hour check for admin - allow generating anytime

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

    // Parse request body for custom parameters
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 100; // Default to 100 articles

    // Default query: "Minnesota, MN" with 7 days
    const query = body.query || 'Minnesota, MN';
    const timePublished = body.timePublished || '7d'; // 7 days for more articles
    const country = body.country || 'US';
    const lang = body.lang || 'en';

    // Fetch news from RapidAPI using shared service
    let data;
    try {
      data = await fetchNewsFromRapidAPI({
        query,
        timePublished,
        country,
        lang,
        limit, // Pass limit to API
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('SSL certificate')) {
        return NextResponse.json(
          { 
            error: 'SSL certificate validation failed. The news API endpoint may be temporarily unavailable or misconfigured.',
            details: 'Please try again later or contact support if the issue persists.'
          },
          { status: 502 }
        );
      }
      return handleApiError(error, 'Failed to fetch news from RapidAPI');
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

    // Save to database (uses news.prompt, trigger auto-extracts to news.generated)
    const { prompt: savedPrompt, error: saveError } = await savePrompt(accountId, query, apiResponse);

    if (!savedPrompt) {
      console.error('[News Generate] Failed to save prompt:', saveError);
      return NextResponse.json(
        { 
          error: 'Failed to save news to database',
          details: saveError || 'Unknown error occurred while saving',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'News generated and saved successfully',
      data: apiResponse,
    });
  } catch (error) {
    return handleApiError(error, 'Error in POST /api/news/generate');
  }
}

