import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  createServiceRoleClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server';
import {
  calendarYearBounds,
  chicagoDateKey,
  computeCurrentStreak,
  computeLongestStreak,
} from '@/features/streaks/streakCalendar';
import { getLevelTier } from '@/features/xp/logic/levelTiers';
import {
  progressInLevel,
  xpIntoLevel,
  xpSpanForLevel,
  xpThresholdForLevel,
} from '@/features/xp/logic/xpCurve';
import {
  loadProfileAboutDiscover,
  type ProfileAboutDiscover,
} from '@/features/community/loadProfileAboutDiscover';

export const dynamic = 'force-dynamic';

export type { ProfileAboutDiscover };

export type PublicProfileAccount = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  traits: string[];
  /** Billing plan slug — used for paid-plan avatar chrome (gold border). */
  plan: string | null;
  /** Public header label preference. */
  profile_name_display: 'full_name' | 'username';
  /** Present only when the viewer is viewing their own profile. */
  email: string | null;
  /** Present only when the viewer is viewing their own profile. */
  phone: string | null;
};

export type PublicProfileStandingLevel = {
  level: number;
  total_xp: number;
  /** 0–1 progress through the current level band (ceil thresholds). */
  progress_pct: number;
  /** XP earned inside the current level band. */
  xp_into_level: number;
  /** XP required to clear the current level band (next threshold − current). */
  xp_span: number;
  /** Absolute XP threshold for the current level. */
  xp_for_current: number;
  /** Absolute XP threshold for the next level (same as current at 99). */
  xp_for_next: number;
  tier_name: string;
};

export type PublicProfileStandingStreak = {
  current_streak: number;
  longest_streak: number;
  active_days_this_year: number;
  year: number;
};

export type PublicProfileStandingDiscovers = {
  items_found: number;
};

export type PublicProfile = {
  account: PublicProfileAccount;
  /** Public live map pins — always visible to every viewer. */
  posts_count: number;
  /** null when the owner has hidden this list from non-owners. */
  followers_count: number | null;
  following_count: number | null;
  /** True when the owner hid this list from others (owner still sees counts). */
  followers_private: boolean;
  following_private: boolean;
  level_private: boolean;
  streak_private: boolean;
  discovers_private: boolean;
  /** Populated when the viewer may see level (self or public). */
  standing_level: PublicProfileStandingLevel | null;
  /** Populated when the viewer may see streak (self or public). */
  standing_streak: PublicProfileStandingStreak | null;
  /** Populated when the viewer may see discovers (self or public). */
  standing_discovers: PublicProfileStandingDiscovers | null;
  /** Interests / places / schools for the About tab (public rows for others). */
  about: ProfileAboutDiscover;
  is_following: boolean;
  is_followed_by: boolean;
  is_self: boolean;
};

/**
 * GET /api/community/profile?id=<accountId>
 * GET /api/community/profile?username=<handle>
 * Public profile lookup for the Profile Card + `/:username` page — anyone can
 * view (accounts are publicly readable per RLS). Viewer session is optional and
 * only used for relationship flags + hide_* privacy. 404 when the account
 * doesn't exist — the client's "existing vs non-existing" branch.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id')?.trim() || null;
    const usernameRaw = url.searchParams.get('username')?.trim() || null;
    if (!id && !usernameRaw) {
      return NextResponse.json({ error: 'Missing id or username' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    let accountQuery = supabase
      .from('accounts')
      .select(
        'id, username, first_name, last_name, image_url, cover_image_url, bio, traits, plan, email, phone, profile_name_display, hide_followers, hide_following, hide_level, hide_streak, hide_discovers',
      );

    if (id) {
      accountQuery = accountQuery.eq('id', id);
    } else {
      const username = usernameRaw!
        .replace(/^@/, '')
        .trim()
        .toLowerCase();
      accountQuery = accountQuery.eq('username', username);
    }

    const { data: account, error: accountErr } = await accountQuery.maybeSingle();

    if (accountErr) {
      console.error('[community/profile]', accountErr);
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
    }
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const session = await getSessionAccount();
    const isSelf = session?.accountId === account.id;

    const hideLevel = Boolean(account.hide_level);
    const hideStreak = Boolean(account.hide_streak);
    const hideDiscovers = Boolean(account.hide_discovers);
    const canSeeLevel = isSelf || !hideLevel;
    const canSeeStreak = isSelf || !hideStreak;
    const canSeeDiscovers = isSelf || !hideDiscovers;

    const service = createServiceRoleClient();
    const [
      { count: postsCount },
      { count: followersCount },
      { count: followingCount },
      about,
    ] = await Promise.all([
      supabase
        .schema('community')
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .eq('kind', 'post')
        .eq('visibility', 'public')
        .eq('is_active', true)
        .eq('archived', false)
        .not('lat', 'is', null),
      supabase
        .schema('community')
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('to_account_id', account.id)
        .eq('relationship', 'follow')
        .eq('status', 'accepted'),
      supabase
        .schema('community')
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('from_account_id', account.id)
        .eq('relationship', 'follow')
        .eq('status', 'accepted'),
      loadProfileAboutDiscover(supabase, service, account.id, isSelf),
    ]);

    let isFollowing = false;
    let isFollowedBy = false;
    if (session && !isSelf) {
      const [{ data: outEdge }, { data: inEdge }] = await Promise.all([
        supabase
          .schema('community')
          .from('connections')
          .select('id')
          .eq('from_account_id', session.accountId)
          .eq('to_account_id', account.id)
          .eq('relationship', 'follow')
          .eq('status', 'accepted')
          .maybeSingle(),
        supabase
          .schema('community')
          .from('connections')
          .select('id')
          .eq('from_account_id', account.id)
          .eq('to_account_id', session.accountId)
          .eq('relationship', 'follow')
          .eq('status', 'accepted')
          .maybeSingle(),
      ]);
      isFollowing = Boolean(outEdge);
      isFollowedBy = Boolean(inEdge);
    }

    let standingLevel: PublicProfileStandingLevel | null = null;
    let standingStreak: PublicProfileStandingStreak | null = null;
    let standingDiscovers: PublicProfileStandingDiscovers | null = null;

    if (canSeeLevel || canSeeStreak || canSeeDiscovers) {
      const todayKey = chicagoDateKey();
      const { year, startKey } = calendarYearBounds(todayKey);
      const historyStartIso = new Date(`${year - 1}-12-30T00:00:00.000Z`).toISOString();

      const [levelRes, sessionsRes, collectionsRes, economyRes] = await Promise.all([
        canSeeLevel
          ? supabase
              .from('account_level_state')
              .select('total_xp, level')
              .eq('account_id', account.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        canSeeStreak
          ? supabase
              .from('account_world_sessions')
              .select('created_at')
              .eq('account_id', account.id)
              .gte('created_at', historyStartIso)
          : Promise.resolve({ data: null, error: null }),
        canSeeDiscovers
          ? createServiceRoleClient('world')
              .from('world_collections')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', account.id)
          : Promise.resolve({ count: null, error: null }),
        canSeeLevel
          ? supabase.rpc('game_economy_published' as never).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (canSeeLevel && !levelRes.error) {
        const totalXp = Number(levelRes.data?.total_xp) || 0;
        const level = Math.max(1, Number(levelRes.data?.level) || 1);
        const economy = economyRes.data as
          | { ceiling?: number; curve_exponent?: number }
          | null;
        const ceilingRaw = Number(economy?.ceiling);
        const ceiling = Number.isFinite(ceilingRaw) && ceilingRaw > 0 ? ceilingRaw : 1;
        const curveRaw = Number(economy?.curve_exponent);
        const curveExponent = Number.isFinite(curveRaw) && curveRaw > 0 ? curveRaw : 1;
        // Same ceil-threshold curve as /api/account/level + xpCurve helpers.
        const xpForCurrent = xpThresholdForLevel(level, ceiling, curveExponent);
        const xpForNext =
          level >= 99
            ? xpForCurrent
            : xpThresholdForLevel(level + 1, ceiling, curveExponent);
        const span = xpSpanForLevel(level, ceiling, curveExponent);
        const into = xpIntoLevel(totalXp, level, ceiling, curveExponent);
        standingLevel = {
          level,
          total_xp: totalXp,
          progress_pct: progressInLevel(totalXp, level, ceiling, curveExponent),
          xp_into_level: Math.min(span, into),
          xp_span: span,
          xp_for_current: xpForCurrent,
          xp_for_next: xpForNext,
          tier_name: getLevelTier(level).name,
        };
      }

      if (canSeeStreak && !sessionsRes.error && Array.isArray(sessionsRes.data)) {
        const activeDays = new Set<string>();
        for (const row of sessionsRes.data as Array<{ created_at: string }>) {
          const key = chicagoDateKey(new Date(row.created_at));
          if (key >= startKey && key <= todayKey) activeDays.add(key);
        }
        const sorted = [...activeDays].sort();
        standingStreak = {
          current_streak: computeCurrentStreak(activeDays, todayKey),
          longest_streak: computeLongestStreak(sorted),
          active_days_this_year: activeDays.size,
          year,
        };
      }

      if (canSeeDiscovers && !collectionsRes.error) {
        standingDiscovers = {
          items_found: collectionsRes.count ?? 0,
        };
      }
    }

    const profile: PublicProfile = {
      account: {
        id: account.id,
        username: account.username,
        first_name: account.first_name,
        last_name: account.last_name,
        image_url: account.image_url,
        cover_image_url: account.cover_image_url,
        bio: account.bio,
        traits: Array.isArray(account.traits) ? (account.traits as string[]) : [],
        plan: account.plan ?? null,
        profile_name_display:
          account.profile_name_display === 'username' ? 'username' : 'full_name',
        email: isSelf ? account.email ?? null : null,
        phone: isSelf ? account.phone ?? null : null,
      },
      posts_count: postsCount ?? 0,
      followers_count: !isSelf && account.hide_followers ? null : followersCount ?? 0,
      following_count: !isSelf && account.hide_following ? null : followingCount ?? 0,
      followers_private: Boolean(account.hide_followers),
      following_private: Boolean(account.hide_following),
      level_private: hideLevel,
      streak_private: hideStreak,
      discovers_private: hideDiscovers,
      standing_level: standingLevel,
      standing_streak: standingStreak,
      standing_discovers: standingDiscovers,
      about,
      is_following: isFollowing,
      is_followed_by: isFollowedBy,
      is_self: isSelf,
    };

    return NextResponse.json(profile, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[community/profile]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
