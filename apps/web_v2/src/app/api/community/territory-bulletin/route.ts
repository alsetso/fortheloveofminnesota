import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';

/** Service-role client for post reads after the presence gate passes — skips RLS. */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const dynamic = 'force-dynamic';

// ─── Response shapes ──────────────────────────────────────────────────────────

type AccountRow = {
  id: string;
  username: string | null;
  image_url: string | null;
  first_name: string | null;
  last_name: string | null;
};

type MediaRow = {
  post_id: string;
  url: string | null;
  media_type: string | null;
  meta: Record<string, unknown> | null;
  sort_order: number | null;
};

export type BulletinMediaType = 'image' | 'video' | 'document' | 'youtube';

export type BulletinMedia = {
  url: string;
  type: BulletinMediaType;
  /** For type='youtube': {video_id, thumbnail, title, channel_name?, duration_iso?} */
  meta: Record<string, unknown> | null;
  sort_order: number;
};

export type BulletinPost = {
  id: string;
  author: AccountRow | null;
  body: string | null;
  title: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  media: BulletinMedia[];
};

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/community/territory-bulletin
 *
 * Returns the public bulletin board feed for a territory entity.
 * Gate: the signed-in account must have unlocked this territory via passport
 * (i.e. row in account_territory_presence WHERE unit_id = entity_id).
 *
 * Query params:
 *   entity_id  UUID — territory.units.id (= DockEntity.id in the client)
 *   limit?     number (default 30, max 60)
 *   after?     ISO timestamp cursor for pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entity_id');
    const limit = Math.min(Number(searchParams.get('limit') ?? 30), 60);
    const after = searchParams.get('after');

    if (!entityId || !/^[0-9a-f-]{36}$/i.test(entityId)) {
      return NextResponse.json({ error: 'entity_id is required (UUID)' }, { status: 400 });
    }

    // ── Auth gate ────────────────────────────────────────────────────────────
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in to view this bulletin board.' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // ── Unlock gate ──────────────────────────────────────────────────────────
    // Only accounts that have physically visited this territory may read its bulletin.
    const { data: presence, error: presenceErr } = await supabase
      .from('account_territory_presence')
      .select('unit_id')
      .eq('account_id', session.accountId)
      .eq('unit_id', entityId)
      .maybeSingle();

    if (presenceErr) {
      console.error('[territory-bulletin] presence check:', presenceErr);
      return NextResponse.json({ error: 'Could not verify territory access.' }, { status: 500 });
    }

    if (!presence) {
      return NextResponse.json(
        {
          error: 'Locked',
          reason: 'Travel to this territory in person to unlock its bulletin board.',
        },
        { status: 403 },
      );
    }

    // ── Feed query — service client to skip RLS after app-level presence gate ──
    const service = createServiceClient();
    let query = service
      .schema('community')
      .from('posts')
      .select(
        'id, account_id, body, title, created_at, like_count, comment_count',
      )
      .eq('content_shape', 'territory_bulletin')
      .eq('unit_id', entityId)
      .eq('is_active', true)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (after) {
      query = query.lt('created_at', after);
    }

    const { data: postsRaw, error: postsErr } = await query;

    if (postsErr) {
      console.error('[territory-bulletin] posts query:', postsErr);
      return NextResponse.json({ error: 'Failed to load bulletin.' }, { status: 500 });
    }

    const posts = (postsRaw ?? []) as Array<{
      id: string;
      account_id: string | null;
      body: string | null;
      title: string | null;
      created_at: string;
      like_count: number | null;
      comment_count: number | null;
    }>;

    if (posts.length === 0) {
      return NextResponse.json(
        { posts: [], hasMore: false },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const postIds = posts.map((p) => p.id);
    const accountIds = [...new Set(posts.map((p) => p.account_id).filter(Boolean) as string[])];

    // ── Media per post ───────────────────────────────────────────────────────
    const mediaByPostId = new Map<string, BulletinMedia[]>();
    const { data: mediaRaw } = await service
      .schema('community')
      .from('post_media')
      .select('post_id, url, media_type, meta, sort_order')
      .in('post_id', postIds)
      .order('sort_order', { ascending: true });

    for (const m of (mediaRaw ?? []) as MediaRow[]) {
      if (!m?.post_id || !m?.url?.trim()) continue;

      const rawType = (m.media_type ?? 'image').toLowerCase();
      const type: BulletinMediaType =
        rawType === 'youtube'
          ? 'youtube'
          : rawType === 'document'
            ? 'document'
            : rawType === 'video'
              ? 'video'
              : 'image';

      const item: BulletinMedia = {
        url: m.url.trim(),
        type,
        meta: m.meta ?? null,
        sort_order: m.sort_order ?? 0,
      };

      const list = mediaByPostId.get(m.post_id) ?? [];
      list.push(item);
      mediaByPostId.set(m.post_id, list);
    }

    // ── Account profiles ─────────────────────────────────────────────────────
    const accountById = new Map<string, AccountRow>();
    if (accountIds.length > 0) {
      const { data: acctRaw } = await service
        .from('accounts')
        .select('id, username, image_url, first_name, last_name')
        .in('id', accountIds);

      for (const a of (acctRaw ?? []) as AccountRow[]) {
        if (a?.id) accountById.set(a.id, a);
      }
    }

    // ── Assemble response ────────────────────────────────────────────────────
    const bulletinPosts: BulletinPost[] = posts.map((p) => ({
      id: p.id,
      author: p.account_id ? (accountById.get(p.account_id) ?? null) : null,
      body: p.body,
      title: p.title,
      created_at: p.created_at,
      like_count: p.like_count ?? 0,
      comment_count: p.comment_count ?? 0,
      media: mediaByPostId.get(p.id) ?? [],
    }));

    const hasMore = posts.length === limit;

    return NextResponse.json(
      { posts: bulletinPosts, hasMore },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory-bulletin]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
