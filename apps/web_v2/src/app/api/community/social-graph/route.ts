import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export type SocialGraphAccount = {
  id: string;
  username: string | null;
  image_url: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type SocialGraphEntry = {
  account: SocialGraphAccount;
  since: string;
  is_friend: boolean;
};

type EdgeRow = { from_account_id: string; to_account_id: string; created_at: string };

/**
 * GET /api/community/social-graph[?account_id=<id>]
 * Followers + following for `account_id` (defaults to the signed-in account),
 * backed by `community.connections` (relationship = 'follow', status = 'accepted').
 * 'follow' edges are publicly readable per RLS, so any account can be targeted;
 * viewing someone else's list respects their `hide_followers` / `hide_following`.
 * Self-view (no `account_id`, or `account_id` === caller) still requires sign-in.
 */
export async function GET(req: Request) {
  try {
    const targetParam = new URL(req.url).searchParams.get('account_id')?.trim() || null;
    const session = await getSessionAccount();

    const accountId = targetParam ?? session?.accountId ?? null;
    if (!accountId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const isSelf = session?.accountId === accountId;

    const supabase = await createSupabaseServerClient();

    let hideFollowers = false;
    let hideFollowing = false;
    if (targetParam && !isSelf) {
      const { data: target } = await supabase
        .from('accounts')
        .select('hide_followers, hide_following')
        .eq('id', accountId)
        .maybeSingle();
      if (!target) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }
      hideFollowers = Boolean(target.hide_followers);
      hideFollowing = Boolean(target.hide_following);
    }

    const [{ data: outEdges, error: outErr }, { data: inEdges, error: inErr }] = await Promise.all([
      supabase
        .schema('community')
        .from('connections')
        .select('from_account_id, to_account_id, created_at')
        .eq('from_account_id', accountId)
        .eq('relationship', 'follow')
        .eq('status', 'accepted')
        .order('created_at', { ascending: false }),
      supabase
        .schema('community')
        .from('connections')
        .select('from_account_id, to_account_id, created_at')
        .eq('to_account_id', accountId)
        .eq('relationship', 'follow')
        .eq('status', 'accepted')
        .order('created_at', { ascending: false }),
    ]);

    if (outErr || inErr) {
      console.error('[community/social-graph]', outErr ?? inErr);
      return NextResponse.json({ error: 'Failed to load social graph' }, { status: 500 });
    }

    const following = (outEdges ?? []) as EdgeRow[];
    const followers = (inEdges ?? []) as EdgeRow[];
    const followingIds = new Set(following.map((e) => e.to_account_id));
    const followerIds = new Set(followers.map((e) => e.from_account_id));

    const allIds = [...new Set([...followingIds, ...followerIds])];
    if (allIds.length === 0) {
      return NextResponse.json({
        followers: [] as SocialGraphEntry[],
        following: [] as SocialGraphEntry[],
        followers_count: hideFollowers ? null : 0,
        following_count: hideFollowing ? null : 0,
        friend_count: 0,
      });
    }

    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id, username, image_url, first_name, last_name')
      .in('id', allIds);

    if (accErr) {
      return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 });
    }

    const profileById = new Map(
      ((accounts ?? []) as SocialGraphAccount[]).map((a) => [a.id, a] as const),
    );

    const followingList: SocialGraphEntry[] = following
      .map((e) => {
        const acc = profileById.get(e.to_account_id);
        if (!acc) return null;
        return { account: acc, since: e.created_at, is_friend: followerIds.has(e.to_account_id) };
      })
      .filter((v): v is SocialGraphEntry => v != null);

    const followersList: SocialGraphEntry[] = followers
      .map((e) => {
        const acc = profileById.get(e.from_account_id);
        if (!acc) return null;
        return { account: acc, since: e.created_at, is_friend: followingIds.has(e.from_account_id) };
      })
      .filter((v): v is SocialGraphEntry => v != null);

    const friendCount = followingList.filter((f) => f.is_friend).length;

    return NextResponse.json(
      {
        followers: hideFollowers ? [] : followersList,
        following: hideFollowing ? [] : followingList,
        followers_count: hideFollowers ? null : followersList.length,
        following_count: hideFollowing ? null : followingList.length,
        friend_count: friendCount,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[community/social-graph]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
