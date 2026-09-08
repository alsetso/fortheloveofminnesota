import { getAdSessionId } from '@/lib/ads/adSession';

export function postAdEvent(
  creativeId: string,
  placementId: string | null | undefined,
  eventType: 'impression' | 'click',
): void {
  void fetch('/api/analytics/ad-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      creative_id: creativeId,
      placement_id: placementId ?? null,
      event_type: eventType,
      session_id: getAdSessionId(),
    }),
  });
}

export function recordPostFeedView(postId: string): void {
  void fetch(`/api/community/posts/${encodeURIComponent(postId)}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ source: 'feed' }),
  });
}
