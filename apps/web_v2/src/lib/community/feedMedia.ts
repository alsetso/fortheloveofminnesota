/**
 * Shared feed/timeline media strategy.
 *
 * Cards show a single thumbnail:
 * - Prefer the first *image* by sort_order
 * - Skip videos on list surfaces (detail still plays full media[])
 * - URLs are absolute public object URLs (R2). RLS must allow public read
 *   of post_media for public posts via community.post_id_is_publicly_readable.
 */

export type FeedMediaRow = {
  post_id: string;
  url: string | null;
  media_type: string | null;
  sort_order?: number | null;
};

export function isFeedVideoMedia(m: Pick<FeedMediaRow, 'url' | 'media_type'>): boolean {
  if (m.media_type === 'video') return true;
  if (m.media_type === 'image') return false;
  const url = m.url ?? '';
  return /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url);
}

/** First image URL per post_id. Videos are omitted from card thumbnails. */
export function firstFeedImageByPostId(
  rows: FeedMediaRow[] | null | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of rows ?? []) {
    if (!row?.post_id || !row.url) continue;
    if (isFeedVideoMedia(row)) continue;
    const pid = String(row.post_id);
    if (!out.has(pid)) out.set(pid, String(row.url));
  }
  return out;
}
