import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/community/comments/[id]
 * Author-only — remove own comment (Your activity → Comments).
 */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: commentId } = await ctx.params;
    if (!commentId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: existing, error: fetchErr } = await supabase
      .schema('community')
      .from('comments')
      .select('id, author_account_id, entity_id')
      .eq('id', commentId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.author_account_id !== session.accountId) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const { error: delErr } = await supabase
      .schema('community')
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('author_account_id', session.accountId);

    if (delErr) {
      console.error('[community/comments/id DELETE]', delErr);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entity_id: existing.entity_id ? String(existing.entity_id) : null,
    });
  } catch (e) {
    console.error('[community/comments/id DELETE]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
