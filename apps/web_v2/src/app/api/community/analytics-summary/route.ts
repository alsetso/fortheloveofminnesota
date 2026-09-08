import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export type AnalyticsRange = '30d' | 'all';

export type AnalyticsActor = {
  id: string;
  username: string | null;
  image_url: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type EngagementEvent = {
  kind: 'view' | 'like' | 'comment';
  actor: AnalyticsActor | null;
  post: {
    id: string;
    body_snippet: string | null;
    media_url: string | null;
  };
  occurred_at: string;
  comment_preview?: string | null;
};

/** Unified Contributor timeline — who saw a pin or the profile. */
export type SightingEvent = {
  kind: 'pin_view' | 'profile_view';
  actor: AnalyticsActor | null;
  post: {
    id: string;
    body_snippet: string | null;
    media_url: string | null;
  } | null;
  occurred_at: string;
};

export type AnalyticsSeriesPoint = {
  key: string;
  label: string;
  views: number;
};

export type AnalyticsSummary = {
  range: AnalyticsRange;
  pins: {
    total: number;
    live: number;
    archived: number;
    view_count_sum: number;
    like_count_sum: number;
    comment_count_sum: number;
  };
  profile: {
    view_count: number;
    views_in_range: number;
  };
  /** Pin views within the selected range. */
  views_in_range: number;
  /** Combined pin + profile views for the chart. */
  series: AnalyticsSeriesPoint[];
  /** Pin view events (compat with Activity analytics). */
  views: {
    count: number;
    items: EngagementEvent[];
  };
  /** Unified who-saw timeline for Contributor. */
  sightings: {
    count: number;
    items: SightingEvent[];
  };
  engagement: {
    count: number;
    items: EngagementEvent[];
  };
};

type PostRow = {
  id: string;
  body: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  archived: boolean | null;
};
type ViewRow = { post_id: string; viewer_account_id: string | null; viewed_at: string };
type ProfileViewRow = { viewer_account_id: string | null; viewed_at: string };
type ReactionRow = { entity_id: string; account_id: string | null; created_at: string };
type CommentRow = {
  entity_id: string;
  author_account_id: string | null;
  body: string | null;
  created_at: string;
};
type MediaRow = { post_id: string; url: string; media_type: string | null };

const FEED_LIMIT = 50;
const SERIES_VIEW_LIMIT = 5000;
const ENGAGEMENT_SOURCE_LIMIT = 200;

function snippet(body: string | null, max = 140): string | null {
  if (!body) return null;
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function isVideoMedia(m: MediaRow): boolean {
  if (m.media_type === 'video') return true;
  if (m.media_type === 'image') return false;
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(m.url);
}

function parseRange(raw: string | null): AnalyticsRange {
  return raw === 'all' ? 'all' : '30d';
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function dayLabel(key: string): string {
  const [, m, d] = key.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(m) - 1] ?? m} ${y.slice(2)}`;
}

function rangeStartIso(range: AnalyticsRange): string | null {
  if (range !== '30d') return null;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 29);
  return start.toISOString();
}

function buildDaySeries(viewTimes: string[]): AnalyticsSeriesPoint[] {
  const counts = new Map<string, number>();
  for (const iso of viewTimes) {
    const key = dayKey(new Date(iso));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const points: AnalyticsSeriesPoint[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() - 29);
  for (let i = 0; i < 30; i += 1) {
    const key = dayKey(cursor);
    points.push({ key, label: dayLabel(key), views: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

function buildMonthSeries(viewTimes: string[]): AnalyticsSeriesPoint[] {
  const counts = new Map<string, number>();
  let earliest: Date | null = null;
  for (const iso of viewTimes) {
    const d = new Date(iso);
    const key = monthKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!earliest || d < earliest) earliest = d;
  }

  const end = new Date();
  end.setUTCDate(1);
  end.setUTCHours(0, 0, 0, 0);

  const start = earliest
    ? new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1))
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1));

  const minStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  const cursor = start < minStart ? minStart : start;

  const points: AnalyticsSeriesPoint[] = [];
  while (cursor <= end) {
    const key = monthKey(cursor);
    points.push({ key, label: monthLabel(key), views: counts.get(key) ?? 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return points;
}

/**
 * GET /api/community/analytics-summary?range=30d|all
 * Pin + profile view totals, combined attention series, and a unified
 * "who saw your pin / profile" sightings feed.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const accountId = session.accountId;
    const range = parseRange(request.nextUrl.searchParams.get('range'));
    const sinceIso = rangeStartIso(range);
    const sinceMs = sinceIso ? new Date(sinceIso).getTime() : null;
    const inRange = (iso: string) =>
      sinceMs == null ? true : new Date(iso).getTime() >= sinceMs;

    const supabase = await createSupabaseServerClient();

    let profileViewsQuery = supabase
      .schema('community')
      .from('profile_views')
      .select('viewer_account_id, viewed_at')
      .eq('profile_account_id', accountId)
      .order('viewed_at', { ascending: false })
      .limit(SERIES_VIEW_LIMIT);
    if (sinceIso) profileViewsQuery = profileViewsQuery.gte('viewed_at', sinceIso);

    const [postsRes, profileRes, profileViewsRes] = await Promise.all([
      supabase
        .schema('community')
        .from('posts')
        .select('id, body, view_count, like_count, comment_count, archived')
        .eq('account_id', accountId)
        .eq('kind', 'post')
        .eq('is_active', true)
        .not('lat', 'is', null),
      supabase
        .from('accounts')
        .select('view_count')
        .eq('id', accountId)
        .maybeSingle(),
      profileViewsQuery,
    ]);

    const { data: posts, error: postsErr } = postsRes;
    if (postsErr) {
      console.error('[community/analytics-summary] posts', postsErr);
      return NextResponse.json({ error: 'Failed to load pins' }, { status: 500 });
    }
    if (profileRes.error) {
      console.error('[community/analytics-summary] profile', profileRes.error);
    }
    if (profileViewsRes.error) {
      console.error('[community/analytics-summary] profile_views', profileViewsRes.error);
    }

    const profileViewCount = Math.max(
      0,
      Number((profileRes.data as { view_count: number | null } | null)?.view_count ?? 0),
    );

    const profileViewRows = ((profileViewsRes.data ?? []) as ProfileViewRow[]).filter(
      (v) => v.viewer_account_id !== accountId,
    );

    const rows = (posts ?? []) as PostRow[];
    const pinSummary = rows.reduce(
      (acc, p) => {
        acc.total += 1;
        if (p.archived) acc.archived += 1;
        else acc.live += 1;
        acc.view_count_sum += Math.max(0, Number(p.view_count ?? 0));
        acc.like_count_sum += Math.max(0, Number(p.like_count ?? 0));
        acc.comment_count_sum += Math.max(0, Number(p.comment_count ?? 0));
        return acc;
      },
      { total: 0, live: 0, archived: 0, view_count_sum: 0, like_count_sum: 0, comment_count_sum: 0 },
    );

    const postIds = rows.map((p) => p.id);
    const postById = new Map(rows.map((p) => [String(p.id), p]));

    let items: EngagementEvent[] = [];
    let pinViewEvents: EngagementEvent[] = [];
    let viewRows: ViewRow[] = [];
    let mediaByPost = new Map<string, string>();

    if (postIds.length > 0) {
      let viewsQuery = supabase
        .schema('community')
        .from('post_views')
        .select('post_id, viewer_account_id, viewed_at')
        .in('post_id', postIds)
        .order('viewed_at', { ascending: false })
        .limit(SERIES_VIEW_LIMIT);
      if (sinceIso) viewsQuery = viewsQuery.gte('viewed_at', sinceIso);

      let reactionsQuery = supabase
        .schema('community')
        .from('reactions')
        .select('entity_id, account_id, created_at')
        .eq('entity_type', 'community_post')
        .eq('type', 'like')
        .in('entity_id', postIds)
        .order('created_at', { ascending: false })
        .limit(ENGAGEMENT_SOURCE_LIMIT);
      if (sinceIso) reactionsQuery = reactionsQuery.gte('created_at', sinceIso);

      let commentsQuery = supabase
        .schema('community')
        .from('comments')
        .select('entity_id, author_account_id, body, created_at')
        .eq('entity_type', 'community_post')
        .in('entity_id', postIds)
        .order('created_at', { ascending: false })
        .limit(ENGAGEMENT_SOURCE_LIMIT);
      if (sinceIso) commentsQuery = commentsQuery.gte('created_at', sinceIso);

      const [viewsRes, reactionsRes, commentsRes, mediaRes] = await Promise.all([
        viewsQuery,
        reactionsQuery,
        commentsQuery,
        supabase
          .schema('community')
          .from('post_media')
          .select('post_id, url, media_type')
          .in('post_id', postIds),
      ]);

      if (viewsRes.error) console.error('[community/analytics-summary] views', viewsRes.error);
      if (reactionsRes.error)
        console.error('[community/analytics-summary] reactions', reactionsRes.error);
      if (commentsRes.error)
        console.error('[community/analytics-summary] comments', commentsRes.error);
      if (mediaRes.error) console.error('[community/analytics-summary] media', mediaRes.error);

      viewRows = ((viewsRes.data ?? []) as ViewRow[]).filter(
        (v) => v.viewer_account_id !== accountId,
      );
      const reactionRows = ((reactionsRes.data ?? []) as ReactionRow[]).filter(
        (r) => r.account_id !== accountId,
      );
      const commentRows = ((commentsRes.data ?? []) as CommentRow[]).filter(
        (c) => c.author_account_id !== accountId,
      );

      mediaByPost = new Map<string, string>();
      for (const m of (mediaRes.data ?? []) as MediaRow[]) {
        if (isVideoMedia(m)) continue;
        const pid = String(m.post_id);
        if (!mediaByPost.has(pid)) mediaByPost.set(pid, m.url);
      }

      const actorIds = [
        ...new Set(
          [
            ...viewRows.map((v) => v.viewer_account_id),
            ...reactionRows.map((r) => r.account_id),
            ...commentRows.map((c) => c.author_account_id),
            ...profileViewRows.map((v) => v.viewer_account_id),
          ].filter((id): id is string => Boolean(id)),
        ),
      ];

      const actorById = new Map<string, AnalyticsActor>();
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from('accounts')
          .select('id, username, image_url, first_name, last_name')
          .in('id', actorIds);
        for (const a of (actors ?? []) as AnalyticsActor[]) {
          actorById.set(String(a.id), a);
        }
      }

      const postRef = (postId: string): EngagementEvent['post'] => {
        const post = postById.get(postId);
        return {
          id: postId,
          body_snippet: snippet(post?.body ?? null),
          media_url: mediaByPost.get(postId) ?? null,
        };
      };

      pinViewEvents = viewRows
        .filter((v) => inRange(v.viewed_at))
        .map((v) => ({
          kind: 'view' as const,
          actor: v.viewer_account_id ? actorById.get(v.viewer_account_id) ?? null : null,
          post: postRef(String(v.post_id)),
          occurred_at: v.viewed_at,
        }));

      const likeEvents: EngagementEvent[] = reactionRows
        .filter((r) => inRange(r.created_at))
        .map((r) => ({
          kind: 'like' as const,
          actor: r.account_id ? actorById.get(r.account_id) ?? null : null,
          post: postRef(String(r.entity_id)),
          occurred_at: r.created_at,
        }));

      const commentEvents: EngagementEvent[] = commentRows
        .filter((c) => inRange(c.created_at))
        .map((c) => ({
          kind: 'comment' as const,
          actor: c.author_account_id ? actorById.get(c.author_account_id) ?? null : null,
          post: postRef(String(c.entity_id)),
          occurred_at: c.created_at,
          comment_preview: c.body,
        }));

      items = [...pinViewEvents, ...likeEvents, ...commentEvents]
        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
        .slice(0, FEED_LIMIT);

      const profileSightings: SightingEvent[] = profileViewRows
        .filter((v) => inRange(v.viewed_at))
        .map((v) => ({
          kind: 'profile_view' as const,
          actor: v.viewer_account_id ? actorById.get(v.viewer_account_id) ?? null : null,
          post: null,
          occurred_at: v.viewed_at,
        }));

      const pinSightings: SightingEvent[] = pinViewEvents.map((e) => ({
        kind: 'pin_view' as const,
        actor: e.actor,
        post: e.post,
        occurred_at: e.occurred_at,
      }));

      const seriesTimes = [
        ...viewRows.map((v) => v.viewed_at),
        ...profileViewRows.map((v) => v.viewed_at),
      ];
      const series = range === '30d' ? buildDaySeries(seriesTimes) : buildMonthSeries(seriesTimes);
      const sightings = [...pinSightings, ...profileSightings]
        .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
        .slice(0, FEED_LIMIT);

      const summary: AnalyticsSummary = {
        range,
        pins: pinSummary,
        profile: {
          view_count: profileViewCount,
          views_in_range: profileViewRows.filter((v) => inRange(v.viewed_at)).length,
        },
        views_in_range: viewRows.length,
        series,
        views: { count: pinViewEvents.length, items: pinViewEvents },
        sightings: { count: sightings.length, items: sightings },
        engagement: { count: items.length, items },
      };

      return NextResponse.json(summary, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    // No pins — still return profile sightings + series.
    const actorIds = [
      ...new Set(
        profileViewRows
          .map((v) => v.viewer_account_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const actorById = new Map<string, AnalyticsActor>();
    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from('accounts')
        .select('id, username, image_url, first_name, last_name')
        .in('id', actorIds);
      for (const a of (actors ?? []) as AnalyticsActor[]) {
        actorById.set(String(a.id), a);
      }
    }

    const profileSightings: SightingEvent[] = profileViewRows
      .filter((v) => inRange(v.viewed_at))
      .map((v) => ({
        kind: 'profile_view' as const,
        actor: v.viewer_account_id ? actorById.get(v.viewer_account_id) ?? null : null,
        post: null,
        occurred_at: v.viewed_at,
      }));

    const seriesTimes = profileViewRows.map((v) => v.viewed_at);
    const series = range === '30d' ? buildDaySeries(seriesTimes) : buildMonthSeries(seriesTimes);

    const summary: AnalyticsSummary = {
      range,
      pins: pinSummary,
      profile: {
        view_count: profileViewCount,
        views_in_range: profileSightings.length,
      },
      views_in_range: 0,
      series,
      views: { count: 0, items: [] },
      sightings: { count: profileSightings.length, items: profileSightings.slice(0, FEED_LIMIT) },
      engagement: { count: 0, items: [] },
    };

    return NextResponse.json(summary, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[community/analytics-summary]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
