import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getApiKey } from '@/lib/security/apiKeys';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { normalizeToCamelCase } from '@/lib/people/normalize';
import { z } from 'zod';

const querySchema = z.object({
  peo_id: z.string().min(1).max(100).transform((s) => s.trim()),
  search_id: z.string().uuid().optional(),
});

const RAPIDAPI_HOST = 'skip-tracing-working-api.p.rapidapi.com';

/**
 * GET /api/people/public-records/details?peo_id=xxx&search_id=uuid (optional)
 * Calls RapidAPI /search/detailsbyID; normalizes to camelCase. If search_id + auth context present, inserts people.pull_requests.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const { searchParams } = new URL(req.url);
        const validation = validateQueryParams(searchParams, querySchema);
        if (!validation.success) {
          return validation.error;
        }

        const { peo_id, search_id } = validation.data;
        let apiKey: string;
        try {
          apiKey = getApiKey('RAPIDAPI');
        } catch {
          return NextResponse.json(
            { error: 'RapidAPI key not configured' },
            { status: 500 }
          );
        }

        const url = `https://${RAPIDAPI_HOST}/search/detailsbyID?peo_id=${encodeURIComponent(peo_id)}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
        });

        if (!response.ok) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Public records details API error:', response.status, response.statusText);
          }
          return NextResponse.json(
            { error: 'Details lookup failed', status: response.status },
            { status: response.status >= 500 ? 502 : response.status }
          );
        }

        const raw = await response.json();
        const normalized = normalizeToCamelCase(raw) as Record<string, unknown>;

        if (search_id && userId && accountId) {
          const supabase = await createServerClientWithAuth(cookies());
          await supabase.schema('people').from('pull_requests').insert({
            search_id,
            user_id: userId,
            account_id: accountId,
            person_id: peo_id,
            pulled_data: normalized,
          });
        }

        return NextResponse.json(normalized);
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('GET /api/people/public-records/details:', e);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'strict',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
