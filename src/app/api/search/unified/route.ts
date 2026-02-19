import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  slug: string | null;
  lat: number | null;
  lng: number | null;
  score: number;
}

const querySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      try {
        const url = new URL(req.url);
        const validation = validateQueryParams(url.searchParams, querySchema);
        if (!validation.success) return validation.error;

        const { q, limit = 10 } = validation.data;
        const query = q.trim();

        if (query.length < 2) {
          return NextResponse.json({ query, results: [], counts: {} });
        }

        const { createSupabaseClient } = await import('@/lib/supabase/unified');
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase.rpc('search_atlas', {
          query,
          result_limit: limit,
        });

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[Search Unified] RPC error:', error);
          }
          return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 },
          );
        }

        const results: SearchResult[] = data ?? [];

        const counts: Record<string, number> = {};
        for (const r of results) {
          counts[r.type] = (counts[r.type] ?? 0) + 1;
        }

        return NextResponse.json({ query, results, counts });
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[Search Unified] Error:', err);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 },
        );
      }
    },
    { rateLimit: 'public', requireAuth: false },
  );
}
