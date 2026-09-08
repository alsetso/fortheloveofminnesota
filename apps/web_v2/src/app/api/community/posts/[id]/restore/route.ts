import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { isStoryShape, storyExpiresAt } from '@/lib/community/storyExpiry';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/community/posts/[id]/restore
 * Owner-only — unarchive a post (Your activity → Archive → Restore).
 * Stories get a fresh 24h `expires_at` so they go live again.
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: postId } = await ctx.params;
    const supabase = await createSupabaseServerClient();

    const { data: existing, error: fetchErr } = await supabase
      .schema('community')
      .from('posts')
      .select(
        'id, account_id, archived, kind, lat, lng, full_address, content_shape, expires_at',
      )
      .eq('id', postId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.account_id !== session.accountId) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
    if (!existing.archived) {
      return NextResponse.json({ error: 'Post is not archived' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const story = isStoryShape(existing.content_shape as string | null);
    const nextExpiresAt = story ? storyExpiresAt() : null;

    const update: Record<string, unknown> = {
      archived: false,
      updated_at: nowIso,
    };
    if (story) {
      update.expires_at = nextExpiresAt;
    }

    const { error: restoreErr } = await supabase
      .schema('community')
      .from('posts')
      .update(update)
      .eq('id', postId)
      .eq('account_id', session.accountId);

    if (restoreErr) {
      console.error('[community/posts/id/restore]', restoreErr);
      return NextResponse.json({ error: 'Failed to restore' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      expires_at: nextExpiresAt,
    });
  } catch (e) {
    console.error('[community/posts/id/restore]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
