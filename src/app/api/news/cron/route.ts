import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { hasNewsGeneratedRecently, savePromptWithService } from '@/features/news/services/newsService';
import { fetchNewsFromRapidAPI, deduplicateArticles, formatNewsArticles } from '@/features/news/services/newsApiService';
import { handleApiError } from '@/lib/apiErrorHandler';
import { createErrorResponse, createSuccessResponse } from '@/lib/server/apiError';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const cronQuerySchema = z.object({
  secret: z.string().optional(),
});

/**
 * Cron endpoint for automatic news generation
 * Protected by CRON_SECRET environment variable
 * Runs every 24 hours via Vercel Cron
 * 
 * Security:
 * - Rate limited: 10 requests/minute (strict - cron should only run once)
 * - CRON_SECRET verification
 * - Vercel cron header verification
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        // Verify cron secret for security
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          const url = new URL(req.url);
          const validation = validateQueryParams(url.searchParams, cronQuerySchema);
          const secretParam = validation.success ? validation.data.secret : url.searchParams.get('secret');
          const authHeader = req.headers.get('authorization');
          
          // Allow access via query param or auth header (for manual testing)
          // Vercel cron jobs are automatically authenticated
          if (secretParam !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            // Check if this is a Vercel cron request (they're automatically secured)
            const isVercelCron = req.headers.get('user-agent')?.includes('vercel') || 
                                req.headers.get('x-vercel-id');
            if (!isVercelCron) {
              return createErrorResponse('Unauthorized', 401);
            }
          }
        }

        // Check if news was already generated in the last 24 hours
        const alreadyGenerated = await hasNewsGeneratedRecently();
        if (alreadyGenerated) {
          return createSuccessResponse({ 
            success: true,
            message: 'News already generated in the last 24 hours. Skipping.',
            skipped: true
          });
        }

    // Get the first admin account to associate with the generation
    const supabase = createServiceClient();
    const { data: adminAccounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

        if (accountError || !adminAccounts || adminAccounts.length === 0) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[News Cron] No admin account found:', accountError);
          }
          return createErrorResponse('No admin account found for news generation', 500);
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
            return createErrorResponse('SSL certificate validation failed', 502);
          }
          if (process.env.NODE_ENV === 'development') {
            console.error('[News Cron] Failed to fetch news from RapidAPI:', error);
          }
          return createErrorResponse('Failed to fetch news from RapidAPI', 500);
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
        const { prompt: savedPrompt, error: saveError } = await savePromptWithService(accountId, query, apiResponse);

        if (!savedPrompt) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[News Cron] Failed to save prompt:', saveError);
          }
          return createErrorResponse('Failed to save news to database', 500);
        }

        return createSuccessResponse({
          success: true,
          message: 'News generated and saved successfully',
          data: {
            count: formattedArticles.length,
            requestId: data.request_id,
            generatedAt: apiResponse.generatedAt,
          },
        });
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[News Cron] Error:', error);
        }
        return createErrorResponse('Internal server error', 500);
      }
    },
    {
      rateLimit: 'strict', // Very strict - cron should only run once
      requireAuth: false, // CRON_SECRET handles auth
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

