import type { FeedItem } from '@/app/api/community/feed/route';

export type { FeedItem };

export type FeedScope = 'all' | 'places' | 'following';

export type FeedPage = {
  items: FeedItem[];
  hasMore: boolean;
};

export async function fetchFeedPage(opts: {
  offset?: number;
  limit?: number;
  q?: string;
  /**
   * `all` — statewide public.
   * `places` — posts in your CTUs (or a single `unitId`).
   * `following` — posts from accounts you follow.
   */
  scope?: FeedScope;
  /** Focus Places / All on one territory unit. */
  unitId?: string;
  /** Profile timeline — posts from one account. */
  accountId?: string;
  signal?: AbortSignal;
}): Promise<FeedPage> {
  const params = new URLSearchParams();
  params.set('limit', String(opts.limit ?? 25));
  params.set('offset', String(opts.offset ?? 0));
  const q = opts.q?.trim();
  if (q && q.length >= 2) params.set('q', q);
  if (opts.scope && opts.scope !== 'all') params.set('scope', opts.scope);
  if (opts.unitId?.trim()) params.set('unit_id', opts.unitId.trim());
  if (opts.accountId?.trim()) params.set('account_id', opts.accountId.trim());

  const res = await fetch(`/api/community/feed?${params}`, {
    cache: 'no-store',
    credentials: 'include',
    signal: opts.signal,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Failed to load feed');
  }
  const json = (await res.json()) as { items?: FeedItem[]; hasMore?: boolean };
  return {
    items: json.items ?? [],
    hasMore: Boolean(json.hasMore),
  };
}
