/**
 * Community social / activity APIs — Followers / Following (product), plus
 * Notifications / Analytics (still under Dev admin). Thin fetch wrappers around
 * `/api/community/*` routes backed by `community.connections`, `platform.alerts`,
 * and `platform.analytics_events`.
 */

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

export type SocialGraph = {
  followers: SocialGraphEntry[];
  following: SocialGraphEntry[];
  /** null when the owner has hidden this list from the current viewer. */
  followers_count: number | null;
  following_count: number | null;
  friend_count: number;
};

export async function fetchSocialGraph(
  opts?: { accountId?: string; signal?: AbortSignal },
): Promise<SocialGraph> {
  const query = opts?.accountId
    ? `?account_id=${encodeURIComponent(opts.accountId)}`
    : '';
  const res = await fetch(`/api/community/social-graph${query}`, {
    cache: 'no-store',
    credentials: 'include',
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error('Failed to load followers / following');
  return (await res.json()) as SocialGraph;
}

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  read: boolean;
  archived: boolean;
  created_at: string;
};

export async function fetchNotifications(signal?: AbortSignal): Promise<{
  items: NotificationItem[];
  unread_count: number;
}> {
  const res = await fetch('/api/community/notifications', {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error('Failed to load notifications');
  return (await res.json()) as { items: NotificationItem[]; unread_count: number };
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch('/api/community/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
    credentials: 'include',
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch('/api/community/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ all: true }),
    credentials: 'include',
  });
}

export type EngagementKind = 'view' | 'like' | 'comment';

export type EngagementEvent = {
  kind: EngagementKind;
  /** Who did it — null for anonymous views. */
  actor: SocialGraphAccount | null;
  /** Which of your pins it happened on. */
  post: {
    id: string;
    body_snippet: string | null;
    media_url: string | null;
  };
  occurred_at: string;
  /** Present when kind === 'comment'. */
  comment_preview?: string | null;
};

export type SightingKind = 'pin_view' | 'profile_view';

export type SightingEvent = {
  kind: SightingKind;
  actor: SocialGraphAccount | null;
  post: {
    id: string;
    body_snippet: string | null;
    media_url: string | null;
  } | null;
  occurred_at: string;
};

export type AnalyticsRange = '30d' | 'all';

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
  views_in_range: number;
  series: AnalyticsSeriesPoint[];
  views: {
    count: number;
    items: EngagementEvent[];
  };
  sightings: {
    count: number;
    items: SightingEvent[];
  };
  engagement: {
    count: number;
    items: EngagementEvent[];
  };
};

export async function fetchAnalyticsSummary(
  signal?: AbortSignal,
  range: AnalyticsRange = '30d',
): Promise<AnalyticsSummary> {
  const qs = new URLSearchParams({ range });
  const res = await fetch(`/api/community/analytics-summary?${qs}`, {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) throw new Error('Failed to load analytics');
  return (await res.json()) as AnalyticsSummary;
}

export function socialAccountLabel(account: SocialGraphAccount | null | undefined): string {
  if (!account) return 'Someone';
  if (account.username?.trim()) return `@${account.username.trim()}`;
  const name = [account.first_name, account.last_name].filter(Boolean).join(' ').trim();
  return name || 'Someone';
}
