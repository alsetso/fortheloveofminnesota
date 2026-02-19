import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { getApiKey } from '@/lib/security/apiKeys';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { validateRequestBody } from '@/lib/security/validation';
import { extractPublicRecords } from '@/lib/people/normalize';
import { z } from 'zod';

const bodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('name'), name: z.string().min(1).max(200).transform((s) => s.trim()), search_id: z.string().uuid().optional() }),
  z.object({ type: z.literal('email'), email: z.string().email().max(320), search_id: z.string().uuid().optional() }),
  z.object({ type: z.literal('phone'), phone: z.string().min(4).max(30), search_id: z.string().uuid().optional() }),
]);

const RAPIDAPI_HOST = 'skip-tracing-working-api.p.rapidapi.com';

function buildRapidApiUrl(data: z.infer<typeof bodySchema>): string {
  const base = `https://${RAPIDAPI_HOST}`;
  switch (data.type) {
    case 'name':
      return `${base}/search/byname?name=${encodeURIComponent(data.name)}&page=1`;
    case 'email':
      return `${base}/search/byemail?email=${encodeURIComponent(data.email)}&phone=1`;
    case 'phone':
      return `${base}/search/byphone?phoneno=${encodeURIComponent(data.phone)}&page=1`;
  }
}

/**
 * POST /api/people/public-records
 * Body: { type, name?|email?|phone?, search_id? (uuid) }
 * Calls RapidAPI skip-tracing; normalizes and returns. If search_id provided, verifies row belongs to context account then updates people.search.public_record_results.
 */
export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      try {
        const validation = await validateRequestBody(req, bodySchema);
        if (!validation.success) {
          return validation.error;
        }

        const data = validation.data;
        let apiKey: string;
        try {
          apiKey = getApiKey('RAPIDAPI');
        } catch {
          return NextResponse.json(
            { error: 'RapidAPI key not configured' },
            { status: 500 }
          );
        }

        const url = buildRapidApiUrl(data);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': RAPIDAPI_HOST,
          },
        });

        if (!response.ok) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Public records API error:', response.status, response.statusText);
          }
          return NextResponse.json(
            { error: 'Public records lookup failed', status: response.status },
            { status: response.status >= 500 ? 502 : response.status }
          );
        }

        const raw = await response.json();
        const normalized = extractPublicRecords(raw as Record<string, unknown>);

        if (data.search_id && accountId) {
          const supabase = await createServerClientWithAuth(cookies());
          const { data: row, error: fetchErr } = await supabase.schema('people').from('search').select('account_id').eq('id', data.search_id).single();
          if (fetchErr || !row) {
            return NextResponse.json({ error: 'Search not found' }, { status: 404 });
          }
          if ((row as { account_id: string }).account_id !== accountId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }
          await supabase.schema('people').from('search').update({ public_record_results: normalized }).eq('id', data.search_id);
        }

        return NextResponse.json(normalized);
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('POST /api/people/public-records:', e);
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
