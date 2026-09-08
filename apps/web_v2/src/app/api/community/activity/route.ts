import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { firstFeedImageByPostId } from '@/lib/community/feedMedia';
import { archiveExpiredStoriesForAccount } from '@/lib/community/storyExpiry';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Visibility rules for community posts / pins (activity surfaces):
 *
 * - Map + Likes + Comments lists: only `is_active` + not `archived` (+ public, or own).
 *   If an author archives a pin, it disappears from everyone else's activity —
 *   reaction/comment rows may remain in DB, but they are filtered out here.
 * - My Pins: owner's live pins (`archived = false`).
 * - Archive: owner's archived pins only (never shown on the map or in others' Likes/Comments).
 * - Stories: live for 24h via `expires_at`, then auto-archived (restorable).
 */

export type ActivityTab = 'pins' | 'likes' | 'comments' | 'archived';

export type ActivityAuthor = {
  id: string;
  username: string | null;
  image_url: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type ActivityItem = {
  id: string;
  kind: string;
  /** `standard` | `story` — drives Post/Story badges in Pins + Archive. */
  content_shape: string | null;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  created_at: string;
  interaction_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  archived: boolean;
  expires_at: string | null;
  /** Present on Comments tab — own comment id for remove. */
  comment_id?: string | null;
  comment_preview?: string | null;
  /** Post owner — Likes/Comments can surface someone else's post. */
  account_id: string | null;
  account: ActivityAuthor | null;
  /** First image on the post. Videos are skipped. */
  media_url: string | null;
};

type PostRow = {
  id: string;
  kind: string | null;
  content_shape: string | null;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  created_at: string;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  archived: boolean | null;
  is_active: boolean | null;
  visibility: string | null;
  account_id: string | null;
  expires_at: string | null;
};

const POST_SELECT =
  'id, kind, content_shape, body, emoji, full_address, created_at, like_count, comment_count, view_count, archived, is_active, visibility, account_id, expires_at';

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const TABS: ActivityTab[] = ['pins', 'likes', 'comments', 'archived'];

function isLivePublicOrOwn(post: PostRow, accountId: string): boolean {
  if (!post.is_active || post.archived) return false;
  if (post.expires_at) {
    const exp = Date.parse(post.expires_at);
    if (Number.isFinite(exp) && exp <= Date.now()) return false;
  }
  if (post.visibility === 'public') return true;
  return post.account_id === accountId;
}

/** First *image* per post — same strategy as community feed cards. */
async function fetchFirstImageByPost(
  supabase: SupabaseServerClient,
  posts: PostRow[],
): Promise<Map<string, string>> {
  const ownIds = posts.map((p) => String(p.id));
  if (ownIds.length === 0) return new Map();

  const { data: rows } = await supabase
    .schema('community')
    .from('post_media')
    .select('post_id, url, media_type, sort_order')
    .in('post_id', ownIds)
    .order('sort_order', { ascending: true });

  return firstFeedImageByPostId(rows);
}

async function fetchAuthorsByIds(
  supabase: SupabaseServerClient,
  accountIds: (string | null)[],
): Promise<Map<string, ActivityAuthor>> {
  const ids = [
    ...new Set(accountIds.filter((id): id is string => Boolean(id))),
  ];
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from('accounts')
    .select('id, username, image_url, first_name, last_name')
    .in('id', ids);
  return new Map(
    ((data ?? []) as ActivityAuthor[]).map((a) => [String(a.id), a]),
  );
}

function toItem(
  post: PostRow,
  openId: string,
  interactionAt: string,
  extra: {
    comment_id?: string | null;
    comment_preview?: string | null;
    account: ActivityAuthor | null;
    media_url: string | null;
  },
): ActivityItem {
  return {
    id: openId,
    kind: post.kind ?? 'post',
    content_shape: post.content_shape ?? 'standard',
    body: post.body,
    emoji: post.emoji,
    full_address: post.full_address,
    created_at: post.created_at,
    interaction_at: interactionAt,
    like_count: post.like_count ?? 0,
    comment_count: post.comment_count ?? 0,
    view_count: post.view_count ?? 0,
    archived: Boolean(post.archived),
    expires_at: post.expires_at ?? null,
    comment_id: extra.comment_id ?? null,
    comment_preview: extra.comment_preview ?? null,
    account_id: post.account_id,
    account: extra.account,
    media_url: extra.media_url,
  };
}

/**
 * GET /api/community/activity?tab=pins|likes|comments|archived
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const url = new URL(req.url);
    const tabParam = (url.searchParams.get('tab') ?? 'pins') as ActivityTab;
    const tab: ActivityTab = TABS.includes(tabParam) ? tabParam : 'pins';
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 100);

    const supabase = await createSupabaseServerClient();
    const accountId = session.accountId;

    // Stories past expires_at move into Archive before Pins/Archive lists render.
    if (tab === 'pins' || tab === 'archived') {
      await archiveExpiredStoriesForAccount(supabase, accountId);
    }

    if (tab === 'pins' || tab === 'archived') {
      const archived = tab === 'archived';
      const { data: rows, error } = await supabase
        .schema('community')
        .from('posts')
        .select(POST_SELECT)
        .eq('kind', 'post')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .eq('archived', archived)
        .not('lat', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[community/activity]', tab, error);
        return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
      }

      const posts = (rows ?? []) as PostRow[];
      const [authorsById, mediaByPost] = await Promise.all([
        fetchAuthorsByIds(supabase, [accountId]),
        fetchFirstImageByPost(supabase, posts),
      ]);

      const items = posts.map((p) =>
        toItem(p, p.id, p.created_at, {
          account: authorsById.get(String(p.account_id)) ?? null,
          media_url: mediaByPost.get(String(p.id)) ?? null,
        }),
      );
      return NextResponse.json(
        { tab, items },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    if (tab === 'likes') {
      const { data: reactions, error: rxErr } = await supabase
        .schema('community')
        .from('reactions')
        .select('entity_id, created_at')
        .eq('account_id', accountId)
        .eq('entity_type', 'community_post')
        .eq('type', 'like')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (rxErr) {
        console.error('[community/activity] likes', rxErr);
        return NextResponse.json({ error: 'Failed to load likes' }, { status: 500 });
      }

      const entityIds = [
        ...new Set(
          (reactions ?? [])
            .map((r) => (r.entity_id ? String(r.entity_id) : null))
            .filter(Boolean),
        ),
      ] as string[];

      if (entityIds.length === 0) {
        return NextResponse.json(
          { tab, items: [] as ActivityItem[] },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      }

      const { data: posts, error: postErr } = await supabase
        .schema('community')
        .from('posts')
        .select(POST_SELECT)
        .in('id', entityIds);

      if (postErr) {
        console.error('[community/activity] likes posts', postErr);
        return NextResponse.json({ error: 'Failed to load likes' }, { status: 500 });
      }

      const postById = new Map(
        ((posts ?? []) as PostRow[]).map((p) => [String(p.id), p]),
      );

      const livePosts = ((posts ?? []) as PostRow[]).filter((p) =>
        isLivePublicOrOwn(p, accountId),
      );
      const [authorsById, mediaByPost] = await Promise.all([
        fetchAuthorsByIds(
          supabase,
          livePosts.map((p) => p.account_id),
        ),
        fetchFirstImageByPost(supabase, livePosts),
      ]);

      const items: ActivityItem[] = [];
      for (const rx of reactions ?? []) {
        const eid = rx.entity_id ? String(rx.entity_id) : '';
        const post = postById.get(eid);
        if (!post || !isLivePublicOrOwn(post, accountId)) continue;
        items.push(
          toItem(post, String(post.id), String(rx.created_at ?? post.created_at), {
            account: authorsById.get(String(post.account_id)) ?? null,
            media_url: mediaByPost.get(String(post.id)) ?? null,
          }),
        );
      }

      return NextResponse.json(
        { tab, items },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    // comments
    const { data: comments, error: cErr } = await supabase
      .schema('community')
      .from('comments')
      .select('id, entity_id, body, created_at')
      .eq('author_account_id', accountId)
      .eq('entity_type', 'community_post')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cErr) {
      console.error('[community/activity] comments', cErr);
      return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 });
    }

    const entityIds = [
      ...new Set(
        (comments ?? [])
          .map((c) => (c.entity_id ? String(c.entity_id) : null))
          .filter(Boolean),
      ),
    ] as string[];

    if (entityIds.length === 0) {
      return NextResponse.json(
        { tab, items: [] as ActivityItem[] },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const { data: posts, error: postErr } = await supabase
      .schema('community')
      .from('posts')
      .select(POST_SELECT)
      .in('id', entityIds);

    if (postErr) {
      console.error('[community/activity] comments posts', postErr);
      return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 });
    }

    const postById = new Map(
      ((posts ?? []) as PostRow[]).map((p) => [String(p.id), p]),
    );

    const livePosts = ((posts ?? []) as PostRow[]).filter((p) =>
      isLivePublicOrOwn(p, accountId),
    );
    const [authorsById, mediaByPost] = await Promise.all([
      fetchAuthorsByIds(
        supabase,
        livePosts.map((p) => p.account_id),
      ),
      fetchFirstImageByPost(supabase, livePosts),
    ]);

    const items: ActivityItem[] = [];
    for (const c of comments ?? []) {
      const eid = c.entity_id ? String(c.entity_id) : '';
      const post = postById.get(eid);
      if (!post || !isLivePublicOrOwn(post, accountId)) continue;
      items.push(
        toItem(post, String(post.id), String(c.created_at ?? post.created_at), {
          comment_id: c.id ? String(c.id) : null,
          comment_preview: typeof c.body === 'string' ? c.body : null,
          account: authorsById.get(String(post.account_id)) ?? null,
          media_url: mediaByPost.get(String(post.id)) ?? null,
        }),
      );
    }

    return NextResponse.json(
      { tab, items },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[community/activity]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
