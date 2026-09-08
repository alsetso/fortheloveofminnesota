import type { FeedAdItem } from '@/features/feed/feedStream';
import type { PlatformPlacementSlot } from '@/lib/ads/placementSlots';

export type { FeedAdItem };

export async function fetchFeedAds(opts: {
  slot: PlatformPlacementSlot;
  limit?: number;
  signal?: AbortSignal;
}): Promise<FeedAdItem[]> {
  const params = new URLSearchParams();
  params.set('slot', opts.slot);
  params.set('limit', String(opts.limit ?? 12));

  const res = await fetch(`/api/ads/feed?${params}`, {
    cache: 'no-store',
    credentials: 'include',
    signal: opts.signal,
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: FeedAdItem[] };
  return json.items ?? [];
}
