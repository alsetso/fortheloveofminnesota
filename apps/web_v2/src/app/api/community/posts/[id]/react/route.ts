import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { notifyPostInteraction } from '@/lib/community/postInteractionAlert';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/community/posts/[id]/react — like (idempotent upsert).
 * DELETE — unlike.
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: postId } = await ctx.params;
    const supabase = await createSupabaseServerClient();

    const { data: inserted, error } = await supabase
      .schema('community')
      .from('reactions')
      .upsert(
        {
          account_id: session.accountId,
          entity_type: 'community_post',
          entity_id: postId,
          type: 'like',
        },
        { onConflict: 'account_id,entity_type,entity_id,type', ignoreDuplicates: true },
      )
      .select('account_id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const isNewLike = (inserted?.length ?? 0) > 0;

    const { data: post } = await supabase
      .schema('community')
      .from('posts')
      .select('like_count, account_id')
      .eq('id', postId)
      .maybeSingle();

    if (isNewLike && post?.account_id) {
      const { data: actor } = await supabase
        .from('accounts')
        .select('username, first_name, last_name, image_url')
        .eq('id', session.accountId)
        .maybeSingle();

      await notifyPostInteraction({
        kind: 'like',
        postId,
        recipientAccountId: post.account_id,
        actorAccountId: session.accountId,
        actor,
      });
    }

    return NextResponse.json({
      like_count: post?.like_count ?? 0,
      reacted: true,
    });
  } catch (e) {
    console.error('[community/react POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: postId } = await ctx.params;
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .schema('community')
      .from('reactions')
      .delete()
      .eq('account_id', session.accountId)
      .eq('entity_type', 'community_post')
      .eq('entity_id', postId)
      .eq('type', 'like');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: post } = await supabase
      .schema('community')
      .from('posts')
      .select('like_count')
      .eq('id', postId)
      .maybeSingle();

    return NextResponse.json({
      like_count: post?.like_count ?? 0,
      reacted: false,
    });
  } catch (e) {
    console.error('[community/react DELETE]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
