'use client';

import { useEffect, useRef, type RefObject } from 'react';
import {
  postAdEvent,
  recordPostFeedView,
} from '@/features/feed/feedAnalytics';

/**
 * Fires once when the element enters view (≥25% visible).
 * Use for feed post impressions and ad impressions.
 */
export function useFeedVisibilityOnce(
  enabled: boolean,
  onVisible: () => void,
): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  const sent = useRef(false);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    sent.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || sent.current) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || sent.current) return;
        sent.current = true;
        onVisibleRef.current();
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

export function useFeedPostImpression(postId: string, enabled = true) {
  return useFeedVisibilityOnce(enabled, () => recordPostFeedView(postId));
}

export function useFeedAdImpression(
  creativeId: string,
  placementId: string,
  enabled = true,
) {
  return useFeedVisibilityOnce(enabled, () =>
    postAdEvent(creativeId, placementId, 'impression'),
  );
}
