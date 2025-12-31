import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '@/lib/adminHelpers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { hasNewsGeneratedRecently, savePrompt } from '@/features/news/services/newsService';
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

    // Check if news was already generated in the last 24 hours
    const alreadyGenerated = await hasNewsGeneratedRecently();
    if (alreadyGenerated) {
      return NextResponse.json(
        { error: 'News has already been generated in the last 24 hours. Please wait before generating again.' },
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
    const savedPrompt = await savePrompt(accountId, query, apiResponse);

    if (!savedPrompt) {
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
    return handleApiError(error, 'Error in POST /api/news/generate');
  }
}

