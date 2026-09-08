/**
 * Public profile — fetch wrappers around `/api/community/profile` +
 * `/api/community/follow`. Backs `ProfileDockCard` and the `/:username` page.
 */

import type { ProfileAboutDiscover } from '@/features/community/profileAboutDiscover';
import { usernamePath } from '@/lib/routes/routePolicy';

export type { ProfileAboutDiscover };
export type ProfileNameDisplay = 'full_name' | 'username';

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
  profile_name_display: ProfileNameDisplay;
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
  /** XP required to clear the current level band (next − current threshold). */
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
  /** Public timeline posts — always visible to every viewer. */
  posts_count: number;
  /**
   * Self-only: count of `only_me` posts still on the owner's timeline.
   * null for other viewers.
   */
  posts_only_me_count: number | null;
  /** null when the owner has hidden this list from the current viewer. */
  followers_count: number | null;
  following_count: number | null;
  /** True when the owner hid this list from others (owner still sees counts). */
  followers_private: boolean;
  following_private: boolean;
  level_private: boolean;
  streak_private: boolean;
  discovers_private: boolean;
  standing_level: PublicProfileStandingLevel | null;
  standing_streak: PublicProfileStandingStreak | null;
  standing_discovers: PublicProfileStandingDiscovers | null;
  /** Interests / places / schools for the About tab. */
  about: ProfileAboutDiscover;
  is_following: boolean;
  is_followed_by: boolean;
  is_self: boolean;
};

async function fetchPublicProfileByQuery(
  query: string,
  signal?: AbortSignal,
): Promise<PublicProfile | null> {
  const res = await fetch(`/api/community/profile?${query}`, {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load profile');
  return (await res.json()) as PublicProfile;
}

/** Resolves `null` when the account doesn't exist — the "non-existing user" branch. */
export async function fetchPublicProfile(
  accountId: string,
  signal?: AbortSignal,
): Promise<PublicProfile | null> {
  return fetchPublicProfileByQuery(`id=${encodeURIComponent(accountId)}`, signal);
}

/** Lookup by handle for the `/:username` profile link. */
export async function fetchPublicProfileByUsername(
  username: string,
  signal?: AbortSignal,
): Promise<PublicProfile | null> {
  const handle = username.trim().replace(/^@/, '').toLowerCase();
  if (!handle) return null;
  return fetchPublicProfileByQuery(
    `username=${encodeURIComponent(handle)}`,
    signal,
  );
}

/** App path for an account's public profile link (`/:username`). */
export function accountProfilePath(
  username: string | null | undefined,
): string | null {
  const u = username?.trim().replace(/^@/, '');
  if (!u) return null;
  return usernamePath(u);
}

/** How the profile was opened — drives Back vs owner compose chrome. */
export type ProfileNavFrom = 'post' | 'map';

/** Append `?from=` so the profile header can show Back. */
export function profilePathWithFrom(
  path: string | null | undefined,
  from: ProfileNavFrom,
): string | null {
  if (!path) return null;
  const url = new URL(path, 'https://ftlom.local');
  url.searchParams.set('from', from);
  return `${url.pathname}${url.search}`;
}

const ACCOUNT_ID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when a `/:username` segment is an account UUID (feed fallback). */
export function isAccountIdProfileSegment(segment: string): boolean {
  return ACCOUNT_ID_SEGMENT.test(segment.trim());
}

/** Profile link for feed/post authors — username first, account id fallback. */
export function feedAuthorProfilePath(
  author: { username?: string | null; id?: string | null } | null | undefined,
  accountId?: string | null,
  from: ProfileNavFrom = 'post',
): string | null {
  const fromUsername = accountProfilePath(author?.username);
  if (fromUsername) return profilePathWithFrom(fromUsername, from);
  const id = author?.id?.trim() || accountId?.trim();
  if (!id) return null;
  return profilePathWithFrom(`/${encodeURIComponent(id)}`, from);
}

/** Absolute share URL when a public site origin is configured. */
export function accountProfileShareUrl(
  username: string | null | undefined,
): string | null {
  const path = accountProfilePath(username);
  if (!path) return null;
  const origin = (
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ''
  ).replace(/\/+$/, '');
  if (origin) return `${origin}${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** Fire-and-forget profile view log — skips self on the server. */
export async function recordProfileView(
  accountId: string,
  source: 'profile_card' | 'direct' | 'search' | 'follow' = 'profile_card',
): Promise<void> {
  try {
    await fetch(`/api/community/profile/${encodeURIComponent(accountId)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
      credentials: 'include',
    });
  } catch {
    // Non-blocking — never surface view-log failures to the profile UI.
  }
}

export async function followAccount(targetAccountId: string): Promise<void> {
  const res = await fetch('/api/community/follow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_account_id: targetAccountId }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Failed to follow');
  }
}

export async function unfollowAccount(targetAccountId: string): Promise<void> {
  const res = await fetch('/api/community/follow', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_account_id: targetAccountId }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Failed to unfollow');
  }
}

/** Owner removes an inbound follow (them → me). */
export async function removeFollower(followerAccountId: string): Promise<void> {
  const res = await fetch('/api/community/follow', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_account_id: followerAccountId,
      remove_follower: true,
    }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Failed to remove follower');
  }
}

export function publicProfileDisplayName(account: PublicProfileAccount): string {
  const name = [account.first_name, account.last_name].filter(Boolean).join(' ').trim();
  const handle = account.username?.trim()
    ? `@${account.username.trim().replace(/^@/, '')}`
    : null;
  if (account.profile_name_display === 'username') {
    if (handle) return handle;
    if (name) return name;
    return 'Account';
  }
  if (name) return name;
  if (handle) return handle;
  return 'Account';
}

export function publicProfileHandle(account: PublicProfileAccount): string | null {
  const u = account.username?.trim();
  return u ? `@${u}` : null;
}
