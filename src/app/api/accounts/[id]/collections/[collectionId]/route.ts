import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity } from '@/lib/security/middleware';

/**
 * PATCH /api/accounts/[id]/collections/[collectionId]
 * Update a collection. Requires auth; [id] must match authenticated account and collection owner.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id, collectionId } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      const { emoji, title, description } = body as { emoji?: string; title?: string; description?: string | null };
      const updates: { emoji?: string; title?: string; description?: string | null; updated_at?: string } = {};
      if (emoji !== undefined) updates.emoji = typeof emoji === 'string' ? emoji : '📍';
      if (title !== undefined) updates.title = typeof title === 'string' ? title.trim() : '';
      if (description !== undefined) updates.description = description ?? null;
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }
      updates.updated_at = new Date().toISOString();

      const supabase = await createServerClientWithAuth(cookies());
      const { data, error } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', collectionId)
        .eq('account_id', id)
        .select()
        .single();

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Collections API]', error);
        return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
      }
      return NextResponse.json({ collection: data });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}

/**
 * DELETE /api/accounts/[id]/collections/[collectionId]
 * Delete a collection. Requires auth; [id] must match authenticated account.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; collectionId: string }> }
) {
  return withSecurity(
    request,
    async (req, { accountId }) => {
      const { id, collectionId } = await params;
      if (!accountId || accountId !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const supabase = await createServerClientWithAuth(cookies());
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId)
        .eq('account_id', id);

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[Collections API]', error);
        return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    },
    { requireAuth: true, rateLimit: 'authenticated' }
  );
}
