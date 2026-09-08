import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { firstFeedImageByPostId } from '@/lib/community/feedMedia';
import {
  FEED_CONTENT_SHAPES,
  POST_VISIBILITY,
} from '@/lib/community/postVisibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildPostPlaceBits } from '@/features/feed/postPlaceLabel';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export type FeedAuthor = {
  id: string;
  username: string | null;
  image_url: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type FeedItem = {
  id: string;
  kind: string;
  content_shape: string | null;
  /** Contribution category UUID (report / highlight / event / story / idea). */
  mention_type_id: string | null;
  body: string | null;
  emoji: string | null;
  /** @deprecated Prefer place_* — kept for search/compat; never show street on feed. */
  full_address: string | null;
  /** CTU / primary territory unit. */
  unit_id: string | null;
  zipcode_id: string | null;
  city_name: string | null;
  zip_code: string | null;
  /** "City · ZIP" when available. */
  place_label: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  /** Owner-only in practice — used for edit sheet visibility picker. */
  visibility?: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  is_liked: boolean;
  account_id: string | null;
  account: FeedAuthor | null;
  media_url: string | null;
};

type PostRow = {
  id: string;
  kind: string | null;
  content_shape: string | null;
  mention_type_id: string | null;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  unit_id: string | null;
  zipcode_id: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  account_id: string | null;
  visibility: string | null;
};

type FeedScope = 'all' | 'foryou' | 'places' | 'following';

function parseFeedScope(raw: string): FeedScope {
  if (raw === 'following') return 'following';
  if (raw === 'places' || raw === 'my_places' || raw === 'my-places') return 'places';
  if (raw === 'foryou' || raw === 'for_you' || raw === 'for-you') return 'foryou';
  return 'all';
}

async function loadFollowingAccountIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
): Promise<string[]> {
  const { data: edges, error } = await supabase
    .schema('community')
    .from('connections')
    .select('to_account_id')
    .eq('from_account_id', accountId)
    .eq('relationship', 'follow')
    .eq('status', 'accepted');
  if (error) throw error;
  const ids = [
    ...new Set(
      (edges ?? [])
        .map((e) => (e.to_account_id ? String(e.to_account_id) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  // Always include your own posts in Following / For you.
  if (!ids.includes(accountId)) ids.push(accountId);
  return ids;
}

async function loadMyPlaceUnitIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  accountId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('account_places')
    .select('territory_unit_id')
    .eq('account_id', accountId)
    .in('kind', ['live_here', 'work_here', 'interested_in']);
  if (error) throw error;
  return [
    ...new Set(
      (data ?? [])
        .map((row) =>
          row.territory_unit_id ? String(row.territory_unit_id) : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

/**
 * GET /api/community/feed?limit=25&offset=0&q=lake&scope=all|foryou|places|following&unit_id=&account_id=
 *
 * Community feed visibility:
 * - `all`       → `public` only (statewide)
 * - `foryou`    → people you follow + posts in your places (falls back to all)
 * - `places`    → public posts whose `unit_id` is one of your CTUs (or `unit_id=`)
 * - `following` → `public` + `shared` from accounts you follow (incl. own)
 * - `account_id` → that author's posts (public; + shared if viewer follows /
 *   owns; + only_me when viewing self)
 * Active, not archived, not expired, feed shapes only; hide blocked authors.
 *
 * Card media: first image URL via feedMedia (videos skipped; detail plays full set).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
    const scope = parseFeedScope(url.searchParams.get('scope') ?? 'all');
    const accountIdFilter = url.searchParams.get('account_id')?.trim() || null;
    const unitIdFilter = url.searchParams.get('unit_id')?.trim() || null;

    const session = await getSessionAccount();
    const supabase = await createSupabaseServerClient();
    const nowIso = new Date().toISOString();
    const isSelfProfile =
      Boolean(accountIdFilter) &&
      Boolean(session?.accountId) &&
      session!.accountId === accountIdFilter;

    let followingIds: string[] | null = null;
    let placeUnitIds: string[] | null = null;
    /** For you: OR of following authors + place units (null = fall back to all). */
    let forYouOr: string | null = null;
    let viewerFollowsAuthor = false;

    if (accountIdFilter && session?.accountId && !isSelfProfile) {
      const { data: edge } = await supabase
        .schema('community')
        .from('connections')
        .select('id')
        .eq('from_account_id', session.accountId)
        .eq('to_account_id', accountIdFilter)
        .eq('relationship', 'follow')
        .eq('status', 'accepted')
        .maybeSingle();
      viewerFollowsAuthor = Boolean(edge);
    } else if (!accountIdFilter && (scope === 'following' || scope === 'foryou' || scope === 'places')) {
      if (!session?.accountId) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      try {
        if (scope === 'following') {
          followingIds = await loadFollowingAccountIds(supabase, session.accountId);
          if (followingIds.length === 0) {
            return NextResponse.json(
              { items: [], hasMore: false },
              { headers: { 'Cache-Control': 'private, no-store' } },
            );
          }
        } else if (scope === 'places') {
          const mine = await loadMyPlaceUnitIds(supabase, session.accountId);
          if (unitIdFilter) {
            placeUnitIds = mine.includes(unitIdFilter) ? [unitIdFilter] : [];
          } else {
            placeUnitIds = mine;
          }
          if (placeUnitIds.length === 0) {
            return NextResponse.json(
              { items: [], hasMore: false },
              { headers: { 'Cache-Control': 'private, no-store' } },
            );
          }
        } else {
          // foryou
          const [follows, units] = await Promise.all([
            loadFollowingAccountIds(supabase, session.accountId),
            loadMyPlaceUnitIds(supabase, session.accountId),
          ]);
          const otherFollows = follows.filter((id) => id !== session.accountId);
          if (otherFollows.length === 0 && units.length === 0) {
            // Cold start — same as All until they follow people / add places.
            followingIds = null;
            placeUnitIds = null;
          } else {
            const parts: string[] = [];
            if (follows.length > 0) {
              parts.push(`account_id.in.(${follows.join(',')})`);
            }
            if (units.length > 0) {
              parts.push(`unit_id.in.(${units.join(',')})`);
            }
            forYouOr = parts.join(',');
          }
        }
      } catch (e) {
        console.error('[community/feed] scope graph', e);
        return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
      }
    }

    // Hide authors I blocked + authors who blocked me (not when viewing own profile).
    const excludedAuthorIds = new Set<string>();
    if (session?.accountId && !isSelfProfile) {
      const [{ data: outbound }, { data: inbound }] = await Promise.all([
        supabase
          .schema('community')
          .from('account_blocks')
          .select('blocked_account_id')
          .eq('blocker_account_id', session.accountId),
        supabase
          .schema('community')
          .from('account_blocks')
          .select('blocker_account_id')
          .eq('blocked_account_id', session.accountId),
      ]);
      for (const row of outbound ?? []) {
        if (row?.blocked_account_id) excludedAuthorIds.add(String(row.blocked_account_id));
      }
      for (const row of inbound ?? []) {
        if (row?.blocker_account_id) excludedAuthorIds.add(String(row.blocker_account_id));
      }
      if (accountIdFilter && excludedAuthorIds.has(accountIdFilter)) {
        return NextResponse.json(
          { items: [], hasMore: false },
          { headers: { 'Cache-Control': 'private, no-store' } },
        );
      }
    }

    const visibilities = accountIdFilter
      ? isSelfProfile
        ? [POST_VISIBILITY.public, POST_VISIBILITY.shared, POST_VISIBILITY.onlyMe]
        : viewerFollowsAuthor
          ? [POST_VISIBILITY.public, POST_VISIBILITY.shared]
          : [POST_VISIBILITY.public]
      : scope === 'following' || (scope === 'foryou' && Boolean(forYouOr))
        ? [POST_VISIBILITY.public, POST_VISIBILITY.shared]
        : [POST_VISIBILITY.public];

    let query = supabase
      .schema('community')
      .from('posts')
      .select(
        'id, kind, content_shape, mention_type_id, body, emoji, full_address, unit_id, zipcode_id, lat, lng, created_at, like_count, comment_count, view_count, account_id, visibility',
      )
      .eq('kind', 'post')
      .in('visibility', visibilities)
      .eq('is_active', true)
      .eq('archived', false)
      // Feed shapes + legacy null (treated as standard). Excludes territory_bulletin etc.
      .or(
        `content_shape.is.null,content_shape.in.(${FEED_CONTENT_SHAPES.join(',')})`,
      )
      .or(`expires_at.is.null,expires_at.gt."${nowIso}"`);

    if (accountIdFilter) {
      query = query.eq('account_id', accountIdFilter);
    } else if (followingIds) {
      query = query.in('account_id', followingIds);
    } else if (placeUnitIds) {
      query = query.in('unit_id', placeUnitIds);
    } else if (forYouOr) {
      query = query.or(forYouOr);
    } else if (unitIdFilter && scope === 'all') {
      query = query.eq('unit_id', unitIdFilter);
    }

    if (excludedAuthorIds.size > 0) {
      query = query.not(
        'account_id',
        'in',
        `(${[...excludedAuthorIds].join(',')})`,
      );
    }

    if (q.length >= 2) {
      const escaped = q.replace(/[%_,]/g, '');
      if (escaped.length >= 2) {
        query = query.or(
          `body.ilike.%${escaped}%,full_address.ilike.%${escaped}%`,
        );
      }
    }

    const { data: rows, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[community/feed]', error);
      return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 });
    }

    // Defense in depth — never leak only_me / draft / bulletins if filters drift.
    const allowedVis = new Set(visibilities);
    const posts = ((rows ?? []) as PostRow[]).filter((p) => {
      const vis = p.visibility ?? '';
      if (!allowedVis.has(vis as (typeof visibilities)[number])) return false;
      if (p.content_shape && !(FEED_CONTENT_SHAPES as readonly string[]).includes(p.content_shape)) {
        return false;
      }
      if (accountIdFilter && String(p.account_id) !== accountIdFilter) return false;
      if (p.account_id && excludedAuthorIds.has(String(p.account_id))) return false;
      return true;
    });

    const accountIds = [
      ...new Set(
        posts
          .map((p) => (p.account_id ? String(p.account_id) : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const authorsById = new Map<string, FeedAuthor>();
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, username, image_url, first_name, last_name')
        .in('id', accountIds);
      for (const a of (accounts ?? []) as FeedAuthor[]) {
        authorsById.set(String(a.id), a);
      }
    }

    const postIds = posts.map((p) => String(p.id));
    const likedIds = new Set<string>();

    const unitIds = [
      ...new Set(
        posts
          .flatMap((p) => [p.unit_id, p.zipcode_id])
          .map((id) => (id ? String(id) : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const unitNameById = new Map<string, string>();
    if (unitIds.length > 0) {
      const { data: units } = await supabase
        .schema('territory')
        .from('units')
        .select('id, name')
        .in('id', unitIds);
      for (const u of units ?? []) {
        const id = String((u as { id: string }).id);
        const name = String((u as { name: string | null }).name ?? '').trim();
        if (id && name) unitNameById.set(id, name);
      }
    }

    let firstImageByPost = new Map<string, string>();
    if (postIds.length > 0) {
      const mediaPromise = supabase
        .schema('community')
        .from('post_media')
        .select('post_id, url, media_type, sort_order')
        .in('post_id', postIds)
        .order('sort_order', { ascending: true });

      const likesPromise =
        session?.accountId
          ? supabase
              .schema('community')
              .from('reactions')
              .select('entity_id')
              .eq('account_id', session.accountId)
              .eq('entity_type', 'community_post')
              .eq('type', 'like')
              .in('entity_id', postIds)
          : Promise.resolve({ data: null as { entity_id: string }[] | null });

      const [{ data: mediaRows }, { data: likeRows }] = await Promise.all([
        mediaPromise,
        likesPromise,
      ]);

      firstImageByPost = firstFeedImageByPostId(mediaRows);
      for (const row of likeRows ?? []) {
        if (row?.entity_id) likedIds.add(String(row.entity_id));
      }
    }

    const items: FeedItem[] = posts.map((p) => {
      const unitId = p.unit_id ? String(p.unit_id) : null;
      const zipcodeId = p.zipcode_id ? String(p.zipcode_id) : null;
      const place = buildPostPlaceBits({
        unitId,
        zipcodeId,
        cityName: unitId ? unitNameById.get(unitId) ?? null : null,
        zipCode: zipcodeId ? unitNameById.get(zipcodeId) ?? null : null,
        fullAddress: p.full_address,
      });
      return {
        id: String(p.id),
        kind: p.kind ?? 'post',
        content_shape: p.content_shape ?? 'standard',
        mention_type_id: p.mention_type_id ? String(p.mention_type_id) : null,
        body: p.body,
        emoji: p.emoji,
        full_address: p.full_address,
        unit_id: place.unitId,
        zipcode_id: place.zipcodeId,
        city_name: place.cityName,
        zip_code: place.zipCode,
        place_label: place.label,
        lat: typeof p.lat === 'number' && Number.isFinite(p.lat) ? p.lat : null,
        lng: typeof p.lng === 'number' && Number.isFinite(p.lng) ? p.lng : null,
        created_at: p.created_at,
        visibility: p.visibility ?? POST_VISIBILITY.public,
        like_count: p.like_count ?? 0,
        comment_count: p.comment_count ?? 0,
        view_count: p.view_count ?? 0,
        is_liked: likedIds.has(String(p.id)),
        account_id: p.account_id,
        account: p.account_id ? authorsById.get(String(p.account_id)) ?? null : null,
        media_url: firstImageByPost.get(String(p.id)) ?? null,
      };
    });

    return NextResponse.json(
      { items, hasMore: (rows ?? []).length >= limit },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[community/feed]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
