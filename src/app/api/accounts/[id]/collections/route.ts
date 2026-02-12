import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * GET /api/accounts/[id]/collections
 * List collections for an account. Requires auth; [id] must match authenticated account.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const supabase = await createServerClientWithAuth(cookies());
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('account_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Collections API]', error);
        return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
      }
      return NextResponse.json({ collections: data ?? [] });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}

/**
 * POST /api/accounts/[id]/collections
 * Create a collection. Requires auth; [id] must match authenticated account.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      const { emoji = '📍', title, description } = body as { emoji?: string; title?: string; description?: string | null };
      if (!title || typeof title !== 'string' || title.trim() === '') {
        return NextResponse.json({ error: 'title is required' }, { status: 400 });
      }
      const supabase = await createServerClientWithAuth(cookies());
      const { data, error } = await supabase
        .from('collections')
        .insert({
          account_id: id,
          emoji: typeof emoji === 'string' ? emoji : '📍',
          title: title.trim(),
          description: description ?? null,
        })
        .select()
        .single();

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Collections API]', error);
        return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 });
      }
      return NextResponse.json({ collection: data });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}
