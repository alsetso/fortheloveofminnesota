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
 * Returns last 10 people.search rows for the current account (by account_id from auth context).
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
        const { data, error } = await supabase
          .schema('people')
          .from('search')
          .select('id, search_type, query, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('GET /api/people/search/recent:', error);
          }
          return NextResponse.json({ error: 'Failed to fetch recent searches' }, { status: 500 });
        }
        return NextResponse.json({ searches: (data ?? []) as PeopleSearchRow[] });
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
