/**
 * Admin-only API route for generating news articles
 * Requires authentication and admin role
 */
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { generateNews } from '@/lib/services/newsGenerationService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId, userId }) => {
      try {
        const body = await req.json();
        const { query, timePublished, country, lang } = body;

        if (!query || typeof query !== 'string') {
          return NextResponse.json(
            { error: 'Query parameter is required' },
            { status: 400 }
          );
        }

        // If accountId is not available, try to get first admin account as fallback
        let finalAccountId = accountId;
        if (!finalAccountId && userId) {
          const { createServerClientWithAuth } = await import('@/lib/supabaseServer');
          const { cookies } = await import('next/headers');
          const supabase = await createServerClientWithAuth(await cookies());
          
          const { data: adminAccount, error: adminError } = await supabase
            .from('accounts')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();
          
          if (adminAccount && !adminError) {
            finalAccountId = (adminAccount as any).id;
          } else {
            return NextResponse.json(
              { error: 'Account not found. Please ensure you have an admin account.' },
              { status: 404 }
            );
          }
        }

        if (!finalAccountId) {
          return NextResponse.json(
            { error: 'Unauthorized - account required' },
            { status: 401 }
          );
        }

        const result = await generateNews(finalAccountId, {
          query,
          timePublished: timePublished || '1d',
          country: country || 'US',
          lang: lang || 'en',
        });

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Failed to generate news' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          promptId: result.promptId,
          articles: result.articles || [],
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
