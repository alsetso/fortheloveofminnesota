import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type CityPostMediaType = 'image' | 'video' | 'document' | 'youtube';

export type CityPostMedia = {
  url: string;
  type: CityPostMediaType;
  meta: Record<string, unknown> | null;
};

export type CityPost = {
  id: string;
  body: string | null;
  title: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  /** Derived from media: 'photo' | 'video' | 'text' */
  post_type: 'photo' | 'video' | 'text';
  /** True for territory-specific bulletin board posts */
  is_bulletin: boolean;
  author: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
  media: CityPostMedia[];
};

/**
 * GET /api/territory/units/[id]/posts
 *
 * Public community feed for a CTU — no passport gate.
 * Queries community.posts WHERE unit_id = [id] (covers both standard map pins
 * and territory_bulletin posts; unit_id is territory.units.id).
 *
 * Query params:
 *   type?   'all' | 'photo' | 'video' | 'text'  (default 'all')
 *   limit?  number (default 40, max 60)
 *   after?  ISO timestamp cursor
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const url = new URL(req.url);
    const typeFilter = url.searchParams.get('type') ?? 'all';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 40), 60);
    const after = url.searchParams.get('after');

    const service = createServiceClient();

    let query = service
      .schema('community')
      .from('posts')
      .select('id, account_id, body, title, created_at, like_count, comment_count, content_shape')
      .eq('unit_id', id)
      .eq('kind', 'post')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (after) query = query.lt('created_at', after);

    const { data: postsRaw, error: postsErr } = await query;

    if (postsErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[territory/posts]', postsErr);
      }
      return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 });
    }

    type RawPost = {
      id: string;
      account_id: string | null;
      body: string | null;
      title: string | null;
      created_at: string;
      like_count: number | null;
      comment_count: number | null;
      content_shape: string | null;
    };

    const posts = (postsRaw ?? []) as RawPost[];

    if (posts.length === 0) {
      return NextResponse.json({ posts: [], hasMore: false });
    }

    const postIds = posts.map((p) => p.id);
    const accountIds = [...new Set(posts.map((p) => p.account_id).filter(Boolean) as string[])];

    // Media
    const mediaByPostId = new Map<string, CityPostMedia[]>();
    const { data: mediaRaw } = await service
      .schema('community')
      .from('post_media')
      .select('post_id, url, media_type, meta, sort_order')
      .in('post_id', postIds)
      .order('sort_order', { ascending: true });

    for (const m of (mediaRaw ?? []) as Array<{
      post_id: string; url: string | null; media_type: string | null;
      meta: Record<string, unknown> | null; sort_order: number | null;
    }>) {
      if (!m?.post_id || !m?.url?.trim()) continue;
      const rawType = (m.media_type ?? 'image').toLowerCase();
      const type: CityPostMediaType =
        rawType === 'youtube' ? 'youtube'
        : rawType === 'document' ? 'document'
        : rawType === 'video' ? 'video'
        : 'image';
      const list = mediaByPostId.get(m.post_id) ?? [];
      list.push({ url: m.url.trim(), type, meta: m.meta ?? null });
      mediaByPostId.set(m.post_id, list);
    }

    // Authors
    const accountById = new Map<string, NonNullable<CityPost['author']>>();
    if (accountIds.length > 0) {
      const { data: acctRaw } = await service
        .from('accounts')
        .select('id, username, first_name, last_name, image_url')
        .in('id', accountIds);
      for (const a of (acctRaw ?? []) as NonNullable<CityPost['author']>[]) {
        if (a?.id) accountById.set(a.id, a);
      }
    }

    // Assemble
    let result: CityPost[] = posts.map((p) => {
      const media = mediaByPostId.get(p.id) ?? [];
      const hasPhoto = media.some((m) => m.type === 'image');
      const hasVideo = media.some((m) => m.type === 'video' || m.type === 'youtube');
      return {
        id: p.id,
        body: p.body,
        title: p.title,
        created_at: p.created_at,
        like_count: p.like_count ?? 0,
        comment_count: p.comment_count ?? 0,
        post_type: hasVideo ? 'video' : hasPhoto ? 'photo' : 'text',
        is_bulletin: p.content_shape === 'territory_bulletin',
        author: p.account_id ? (accountById.get(p.account_id) ?? null) : null,
        media,
      };
    });

    if (typeFilter !== 'all') {
      result = result.filter((p) => p.post_type === typeFilter);
    }

    return NextResponse.json({ posts: result, hasMore: posts.length === limit });
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory/posts]', e);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
