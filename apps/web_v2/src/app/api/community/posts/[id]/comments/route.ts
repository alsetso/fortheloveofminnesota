import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { notifyPostInteraction } from '@/lib/community/postInteractionAlert';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * GET /api/community/posts/[id]/comments
 * POST — create comment (auth required).
 */
export async function GET(req: Request, ctx: RouteCtx) {
  try {
    const { id: postId } = await ctx.params;
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 50);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);

    const supabase = await createSupabaseServerClient();
    const { data: comments, error } = await supabase
      .schema('community')
      .from('comments')
      .select('id, body, parent_comment_id, created_at, author_account_id')
      .eq('entity_type', 'community_post')
      .eq('entity_id', postId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[community/comments GET]', error);
      return NextResponse.json({ comments: [], hasMore: false });
    }

    const authorIds = [
      ...new Set((comments ?? []).map((c) => c.author_account_id).filter(Boolean)),
    ] as string[];

    const authorsMap = new Map<
      string,
      {
        id: string;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        image_url: string | null;
      }
    >();

    if (authorIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, username, first_name, last_name, image_url')
        .in('id', authorIds);
      for (const a of accounts ?? []) {
        if (a?.id) authorsMap.set(String(a.id), a);
      }
    }

    return NextResponse.json({
      comments: (comments ?? []).map((c) => ({
        id: c.id,
        body: c.body,
        parent_comment_id: c.parent_comment_id,
        created_at: c.created_at,
        author: authorsMap.get(c.author_account_id) ?? null,
      })),
      hasMore: (comments ?? []).length === limit,
    });
  } catch (e) {
    console.error('[community/comments GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: postId } = await ctx.params;
    const json = (await req.json().catch(() => ({}))) as {
      body?: string;
      parent_comment_id?: string | null;
    };
    const text = typeof json.body === 'string' ? json.body.trim() : '';
    if (!text || text.length > 2000) {
      return NextResponse.json(
        { error: 'Comment body required (max 2000 chars)' },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: comment, error } = await supabase
      .schema('community')
      .from('comments')
      .insert({
        author_account_id: session.accountId,
        entity_type: 'community_post',
        entity_id: postId,
        body: text,
        parent_comment_id: json.parent_comment_id ?? null,
      })
      .select('id, body, parent_comment_id, created_at, author_account_id')
      .single();

    if (error || !comment) {
      return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 400 });
    }

    const { data: account } = await supabase
      .from('accounts')
      .select('id, username, first_name, last_name, image_url')
      .eq('id', session.accountId)
      .maybeSingle();

    const { data: post } = await supabase
      .schema('community')
      .from('posts')
      .select('comment_count, account_id')
      .eq('id', postId)
      .maybeSingle();

    if (post?.account_id) {
      await notifyPostInteraction({
        kind: 'comment',
        postId,
        recipientAccountId: post.account_id,
        actorAccountId: session.accountId,
        actor: account,
        commentBody: comment.body,
        commentId: comment.id,
      });
    }

    return NextResponse.json(
      {
        comment: {
          id: comment.id,
          body: comment.body,
          parent_comment_id: comment.parent_comment_id,
          created_at: comment.created_at,
          author: account ?? null,
        },
        comment_count: post?.comment_count ?? null,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error('[community/comments POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
