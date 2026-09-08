import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteCtx = { params: Promise<{ id: string }> };

const VALID_SOURCES = new Set(['map', 'feed', 'direct', 'share', 'activity']);

/**
 * POST /api/community/posts/[id]/view
 * Logs a view row in `community.post_views` (anonymous ok — viewer_account_id
 * is null when signed out). A DB trigger bumps `posts.view_count` from this
 * table, so it's the single source of truth for both the counter and the
 * "who viewed what" feed on the analytics dock card.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const { id: postId } = await ctx.params;
    if (!postId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    let source = 'map';
    try {
      const body = (await req.json()) as { source?: string } | null;
      if (body?.source && VALID_SOURCES.has(body.source)) source = body.source;
    } catch {
      // No/invalid JSON body — default to 'map'.
    }

    const session = await getSessionAccount();
    const supabase = await createSupabaseServerClient();

    const { error: insertError } = await supabase
      .schema('community')
      .from('post_views')
      .insert({
        post_id: postId,
        viewer_account_id: session?.accountId ?? null,
        source,
      });

    if (insertError) {
      console.error('[community/view] insert', insertError);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const { data: post } = await supabase
      .schema('community')
      .from('posts')
      .select('view_count')
      .eq('id', postId)
      .maybeSingle();

    return NextResponse.json({ ok: true, view_count: post?.view_count ?? null });
  } catch (e) {
    console.error('[community/view]', e);
    return NextResponse.json({ ok: true });
  }
}
