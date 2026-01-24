/**
 * Admin-only API route for saving extracted news articles
 * Requires authentication and admin role
 */
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { createServerClientWithAuth } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId, userId }) => {
      try {
        const body = await req.json();
        const { promptId } = body;

        if (!promptId || typeof promptId !== 'string') {
          return NextResponse.json(
            { error: 'promptId is required' },
            { status: 400 }
          );
        }

        const supabase = await createServerClientWithAuth();

        // Verify prompt exists first
        const { data: promptData, error: promptError } = await (supabase as any)
          .schema('news')
          .from('prompt')
          .select('id, api_response')
          .eq('id', promptId)
          .maybeSingle();

        if (promptError) {
          return NextResponse.json(
            { error: `Failed to find prompt: ${promptError.message}` },
            { status: 500 }
          );
        }

        if (!promptData) {
          return NextResponse.json(
            { error: 'Prompt not found' },
            { status: 404 }
          );
        }

        // Check if articles exist in api_response
        const articles = promptData.api_response?.articles;
        const articleCount = Array.isArray(articles) ? articles.length : 0;

        if (articleCount === 0) {
          return NextResponse.json(
            { error: 'No articles found in prompt' },
            { status: 400 }
          );
        }

        // Trigger article extraction using public wrapper function
        const { data: extractResult, error: extractError } = await supabase.rpc(
          'extract_articles_from_prompt',
          { p_prompt_id: promptId }
        );

        if (extractError) {
          return NextResponse.json(
            { 
              error: `Failed to extract articles: ${extractError.message || 'Unknown error'}`,
              code: extractError.code,
              details: extractError
            },
            { status: 500 }
          );
        }

        // extractResult should be the count of articles extracted
        const extractedCount = typeof extractResult === 'number' ? extractResult : 0;
        
        if (extractedCount === 0 && articleCount > 0) {
          return NextResponse.json(
            { 
              error: `Extraction returned 0 articles but ${articleCount} articles were expected. Check database logs for warnings.`,
              extractedCount,
              expectedCount: articleCount
            },
            { status: 500 }
          );
        }

        // Wait a moment for inserts to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check how many articles were actually saved
        const { count, error: countError } = await (supabase as any)
          .schema('news')
          .from('generated')
          .select('*', { count: 'exact', head: true })
          .eq('prompt_id', promptId);

        if (countError) {
          return NextResponse.json(
            { error: `Failed to verify articles: ${countError.message}` },
            { status: 500 }
          );
        }

        const finalCount = count || 0;

        if (finalCount === 0 && articleCount > 0) {
          return NextResponse.json(
            { 
              error: `No articles were saved. Extraction returned ${extractedCount} but database shows 0 articles.`,
              extractedCount,
              expectedCount: articleCount,
              articlesCount: finalCount
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          articlesExtracted: extractedCount,
          articlesCount: finalCount,
          expectedCount: articleCount,
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      requireAdmin: true,
      // Rate limit: 500 requests/minute per admin (admin rate limit)
      rateLimit: 'admin',
    }
  );
}
