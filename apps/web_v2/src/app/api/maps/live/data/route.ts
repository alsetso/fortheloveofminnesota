import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type TimeFilter = 'all' | '24h' | '7d';

function parseTime(v: string | null): TimeFilter {
  if (v === '24h' || v === '7d') return v;
  return 'all';
}

type PinRow = {
  id: string;
  lat: number | null;
  lng: number | null;
  body: string | null;
  emoji: string | null;
  full_address: string | null;
  mention_type_id: string | null;
  account_id: string | null;
  created_at: string;
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
};

/**
 * GET /api/maps/live/data
 * Public community map pins — geo `community.posts` (kind=post with lat/lng).
 * When signed in, includes `seen_by_me` from `community.post_views` (own pins count as seen).
 */
export async function GET(request: NextRequest) {
  try {
    const time = parseTime(request.nextUrl.searchParams.get('time'));
    const cutoffIso =
      time === '24h'
        ? new Date(Date.now() - 86_400_000).toISOString()
        : time === '7d'
          ? new Date(Date.now() - 7 * 86_400_000).toISOString()
          : null;

    const supabase = await createSupabaseServerClient();
    const session = await getSessionAccount();

    const nowIso = new Date().toISOString();
    let query = supabase
      .schema('community')
      .from('posts')
      .select(
        'id, lat, lng, body, emoji, full_address, mention_type_id, account_id, created_at, like_count, comment_count, view_count, expires_at',
      )
      .eq('kind', 'post')
      .eq('visibility', 'public')
      .eq('is_active', true)
      .eq('archived', false)
      .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (cutoffIso) {
      query = query.gte('created_at', cutoffIso);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('[maps/live/data] pins:', error);
      return NextResponse.json({ error: 'Failed to load pins' }, { status: 500 });
    }

    let pins = (rows ?? []) as PinRow[];

    if (session?.accountId) {
      const { data: blocks, error: blocksErr } = await supabase
        .schema('community')
        .from('account_blocks')
        .select('blocked_account_id')
        .eq('blocker_account_id', session.accountId);
      if (blocksErr) {
        console.error('[maps/live/data] account_blocks:', blocksErr);
      } else {
        const blocked = new Set(
          (blocks ?? []).map((b) => String(b.blocked_account_id)),
        );
        if (blocked.size > 0) {
          pins = pins.filter(
            (p) => !p.account_id || !blocked.has(p.account_id),
          );
        }
      }
    }

    const typeIds = [
      ...new Set(pins.map((p) => p.mention_type_id).filter(Boolean) as string[]),
    ];
    const accountIds = [
      ...new Set(pins.map((p) => p.account_id).filter(Boolean) as string[]),
    ];

    const typeById = new Map<string, { id: string; name: string; emoji: string }>();
    if (typeIds.length > 0) {
      const { data: types } = await supabase
        .from('mention_types')
        .select('id, name, emoji')
        .in('id', typeIds);
      for (const t of types ?? []) {
        if (t?.id) {
          typeById.set(String(t.id), {
            id: String(t.id),
            name: t.name ?? '',
            emoji: t.emoji ?? '',
          });
        }
      }
    }

    const accountById = new Map<
      string,
      { id: string; username: string | null; image_url: string | null }
    >();
    if (accountIds.length > 0) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, username, image_url')
        .in('id', accountIds);
      for (const a of accounts ?? []) {
        if (a?.id) {
          accountById.set(String(a.id), {
            id: String(a.id),
            username: a.username ?? null,
            image_url: a.image_url ?? null,
          });
        }
      }
    }

    const visiblePins = pins.filter(
      (p) => typeof p.lat === 'number' && typeof p.lng === 'number',
    );

    const seenIds = new Set<string>();
    if (session?.accountId) {
      for (const p of visiblePins) {
        if (p.account_id === session.accountId) seenIds.add(p.id);
      }
      const pinIds = visiblePins.map((p) => p.id);
      if (pinIds.length > 0) {
        const { data: views, error: viewsErr } = await supabase
          .schema('community')
          .from('post_views')
          .select('post_id')
          .eq('viewer_account_id', session.accountId)
          .in('post_id', pinIds);
        if (viewsErr) {
          console.error('[maps/live/data] post_views:', viewsErr);
        } else {
          for (const v of views ?? []) {
            if (v?.post_id) seenIds.add(String(v.post_id));
          }
        }
      }
    }

    const payload = visiblePins.map((p) => {
      const mention = p.mention_type_id ? typeById.get(p.mention_type_id) ?? null : null;
      const account = p.account_id ? accountById.get(p.account_id) ?? null : null;
      const seen_by_me = session?.accountId ? (seenIds.has(p.id) ? 1 : 0) : 1;
      return {
        id: p.id,
        lat: p.lat as number,
        lng: p.lng as number,
        body: p.body,
        emoji: p.emoji || mention?.emoji || null,
        full_address: p.full_address,
        account_id: p.account_id,
        created_at: p.created_at,
        like_count: p.like_count ?? 0,
        comment_count: p.comment_count ?? 0,
        view_count: p.view_count ?? 0,
        seen_by_me,
        mention_type: mention,
        account,
      };
    });

    return NextResponse.json(
      {
        pins: payload,
        tags: [...typeById.values()],
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[maps/live/data]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
