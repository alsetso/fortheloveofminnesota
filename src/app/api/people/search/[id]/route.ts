import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

export interface PeopleSearchFull {
  id: string;
  search_type: 'name' | 'email' | 'phone';
  query: Record<string, unknown>;
  account_results: { accounts: unknown[]; count: number } | null;
  public_record_results: { records: unknown[]; count: number } | null;
  created_at: string;
}

export interface PullRequestRow {
  id: string;
  person_id: string;
  pulled_data: Record<string, unknown>;
  created_at: string;
}

/**
 * GET /api/people/search/[id]
 * Returns one people.search row and its people.pull_requests. Verifies row.account_id === context accountId.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (_req, { accountId }) => {
      if (!accountId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { id } = await context.params;
      if (!id) {
        return NextResponse.json({ error: 'Missing search id' }, { status: 400 });
      }
      try {
        const supabase = await createServerClientWithAuth(cookies());
        const { data: row, error: fetchErr } = await supabase
          .schema('people')
          .from('search')
          .select('id, search_type, query, account_results, public_record_results, account_id, created_at')
          .eq('id', id)
          .single();
        if (fetchErr || !row) {
          return NextResponse.json({ error: 'Search not found' }, { status: 404 });
        }
        const typed = row as { account_id: string };
        if (typed.account_id !== accountId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const { data: pulls } = await supabase
          .schema('people')
          .from('pull_requests')
          .select('id, person_id, pulled_data, created_at')
          .eq('search_id', id)
          .order('created_at', { ascending: false });
        const search: PeopleSearchFull = {
          id: row.id,
          search_type: row.search_type,
          query: (row.query as Record<string, unknown>) ?? {},
          account_results: (row.account_results as PeopleSearchFull['account_results']) ?? null,
          public_record_results: (row.public_record_results as PeopleSearchFull['public_record_results']) ?? null,
          created_at: row.created_at,
        };
        return NextResponse.json({
          search,
          pull_requests: (pulls ?? []) as PullRequestRow[],
        });
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('GET /api/people/search/[id]:', e);
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    },
    { rateLimit: 'strict', requireAuth: true }
  );
}
