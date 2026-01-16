import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import { savePrompt } from '@/features/news/services/newsService';
import { fetchNewsFromRapidAPI, deduplicateArticles, formatNewsArticles } from '@/features/news/services/newsApiService';
import { handleApiError } from '@/lib/apiErrorHandler';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { z } from 'zod';

/**
 * POST /api/news/generate
 * Generate news articles (admin only)
 * 
 * Security:
 * - Rate limited: 500 requests/minute (admin)
 * - Request size limit: 1MB
 * - Input validation with Zod
 * - Requires admin access
 */
const newsGenerateSchema = z.object({
  limit: z.number().int().min(1).max(500).default(100).optional(),
  query: z.string().min(1).max(200).default('Minnesota, MN').optional(),
  timePublished: z.string().max(50).default('7d').optional(),
  country: z.string().length(2).default('US').optional(),
  lang: z.string().length(2).default('en').optional(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        // Validate request body
        const validation = await validateRequestBody(req, newsGenerateSchema, REQUEST_SIZE_LIMITS.json);
        if (!validation.success) {
          return validation.error;
        }
        
        const { limit, query, timePublished, country, lang } = validation.data;

        // Use accountId from security middleware context
        if (!accountId) {
          return NextResponse.json(
            { error: 'Account not found. Please complete your profile setup.' },
            { status: 404 }
          );
        }

        // Fetch news from RapidAPI using shared service
        let data;
        try {
          data = await fetchNewsFromRapidAPI({
            query: query || 'Minnesota, MN',
            timePublished: timePublished || '7d',
            country: country || 'US',
            lang: lang || 'en',
            limit: (limit || 100).toString(),
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes('SSL certificate')) {
            return NextResponse.json(
              { 
                error: 'SSL certificate validation failed. The news API endpoint may be temporarily unavailable or misconfigured.',
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
          query: query || 'Minnesota, MN',
          timePublished: timePublished || '7d',
          country: country || 'US',
          lang: lang || 'en',
          generatedAt: new Date().toISOString(),
        };

        // Save to database (uses news.prompt, trigger auto-extracts to news.generated)
        const { prompt: savedPrompt, error: saveError } = await savePrompt(accountId, query || 'Minnesota, MN', apiResponse);

        if (!savedPrompt) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[News Generate] Failed to save prompt:', saveError);
          }
          return NextResponse.json(
            { 
              error: 'Failed to save news to database',
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
    },
    {
      rateLimit: 'admin',
      requireAdmin: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}

