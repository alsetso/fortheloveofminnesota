import type { FeedItem } from '@/features/feed/feedApi';

/** Served creative shaped for feed cards (matches GET /api/ads/feed). */
export type FeedAdItem = {
  placementId: string;
  creativeId: string;
  advertiserPageId: string;
  advertiserSlug: string;
  advertiserTitle: string;
  advertiserLogoUrl: string | null;
  caption: string;
  imageUrl: string;
  destinationUrl: string;
  ctaLabel: string;
};

export type FeedStreamPost = { kind: 'post'; key: string; post: FeedItem };
export type FeedStreamAd = { kind: 'ad'; key: string; ad: FeedAdItem };
export type FeedStreamItem = FeedStreamPost | FeedStreamAd;

/**
 * Insert an ad after every 2–3 organic posts (alternating cadence so the
 * stream never feels metronomic). Ads cycle when the pool is smaller than needed.
 */
export function interleaveFeedAds(
  posts: FeedItem[],
  ads: FeedAdItem[],
  opts?: { startAdIndex?: number },
): { items: FeedStreamItem[]; nextAdIndex: number } {
  if (!posts.length) return { items: [], nextAdIndex: opts?.startAdIndex ?? 0 };
  if (!ads.length) {
    return {
      items: posts.map((post) => ({
        kind: 'post' as const,
        key: `post:${post.id}`,
        post,
      })),
      nextAdIndex: opts?.startAdIndex ?? 0,
    };
  }

  const gapPattern: number[] = [2, 3];
  let gapIdx = 0;
  let postsSinceAd = 0;
  let nextGap = gapPattern[0]!;
  let adIndex = opts?.startAdIndex ?? 0;
  const items: FeedStreamItem[] = [];

  for (const post of posts) {
    items.push({ kind: 'post', key: `post:${post.id}`, post });
    postsSinceAd += 1;
    if (postsSinceAd >= nextGap) {
      const ad = ads[adIndex % ads.length]!;
      items.push({
        kind: 'ad',
        key: `ad:${ad.placementId}:${adIndex}`,
        ad,
      });
      adIndex += 1;
      postsSinceAd = 0;
      gapIdx = (gapIdx + 1) % gapPattern.length;
      nextGap = gapPattern[gapIdx]!;
    }
  }

  return { items, nextAdIndex: adIndex };
}
