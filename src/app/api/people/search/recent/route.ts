import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

export interface PeopleSearchRow {
  id: string;
  search_type: 'name' | 'email' | 'phone';
  query: Record<string, unknown>;
  created_at: string;
}

/**
 * GET /api/people/search/recent
 * Returns at most 1 people.search row for the current account (limited API).
 * Also returns search_count (0 or 1) and pull_request_count for usage display.
 */
export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (_req, { accountId }) => {
      if (!accountId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const { data: searchData, error: searchErr } = await supabase
          .schema('people')
          .from('search')
          .select('id, search_type, query, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (searchErr) {
          if (process.env.NODE_ENV === 'development') {
            console.error('GET /api/people/search/recent:', searchErr);
          }
          return NextResponse.json({ error: 'Failed to fetch recent searches' }, { status: 500 });
        }
        const searches = (searchData ?? []) as PeopleSearchRow[];
        const search_count = searches.length;

        const { count: pull_request_count, error: countErr } = await supabase
          .schema('people')
          .from('pull_requests')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', accountId);
        if (countErr) {
          if (process.env.NODE_ENV === 'development') {
            console.error('GET /api/people/search/recent count:', countErr);
          }
        }
        return NextResponse.json({
          searches,
          search_count,
          pull_request_count: countErr ? 0 : (pull_request_count ?? 0),
        });
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('GET /api/people/search/recent:', e);
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { rateLimit: 'strict', requireAuth: true }
  );
}
