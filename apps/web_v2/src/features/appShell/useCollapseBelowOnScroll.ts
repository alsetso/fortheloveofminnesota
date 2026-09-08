'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from 'react';
import { usePageScrollContext, usePageScrollListener } from '@/features/appShell/pageScrollContext';

const TOP_REVEAL_PX = 12;
const DIRECTION_DELTA_PX = 10;

function findScrollParent(from: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = from?.parentElement ?? null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Hide TopBar `below` chrome when scrolling down; reveal on scroll up.
 * Prefers the AppShell PageScroll hub (TopBar portaled out of the scroller);
 * falls back to finding a scroll parent when rendered in-place.
 */
export function useCollapseBelowOnScroll(
  headerRef: RefObject<HTMLElement | null>,
  belowRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [collapsed, setCollapsed] = useState(false);
  const lastYRef = useRef(0);
  const collapsedRef = useRef(false);
  const pinnedRef = useRef(false);
  const pageScroll = usePageScrollContext();

  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  const apply = useCallback((next: boolean) => {
    if (pinnedRef.current) {
      if (collapsedRef.current) setCollapsed(false);
      return;
    }
    if (collapsedRef.current === next) return;
    setCollapsed(next);
  }, []);

  const onScrollY = useCallback(
    (y: number) => {
      const dy = y - lastYRef.current;
      lastYRef.current = y;

      if (y <= TOP_REVEAL_PX) {
        apply(false);
        return;
      }
      if (dy > DIRECTION_DELTA_PX) apply(true);
      else if (dy < -DIRECTION_DELTA_PX) apply(false);
    },
    [apply],
  );

  usePageScrollListener(
    useCallback(
      (event: UIEvent<HTMLDivElement>) => {
        if (!enabled || !pageScroll) return;
        onScrollY(event.currentTarget.scrollTop);
      },
      [enabled, onScrollY, pageScroll],
    ),
  );

  useEffect(() => {
    if (!enabled) {
      setCollapsed(false);
      return;
    }
    // Shell hub handles scroll when present.
    if (pageScroll) return;

    const header = headerRef.current;
    const below = belowRef.current;
    if (!header) return;

    const scroller = findScrollParent(header);
    if (!scroller) return;

    lastYRef.current = scroller.scrollTop;

    const onScroll = () => onScrollY(scroller.scrollTop);

    const onFocusIn = (e: FocusEvent) => {
      if (!below) return;
      const t = e.target;
      if (!(t instanceof Node) || !below.contains(t)) return;
      pinnedRef.current = true;
      apply(false);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!below) return;
      const next = e.relatedTarget;
      if (next instanceof Node && below.contains(next)) return;
      pinnedRef.current = false;
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', onFocusIn);
    header.addEventListener('focusout', onFocusOut);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', onFocusIn);
      header.removeEventListener('focusout', onFocusOut);
      pinnedRef.current = false;
    };
  }, [apply, belowRef, enabled, headerRef, onScrollY, pageScroll]);

  // Focus pin while using shell hub (header is outside the scroller).
  useEffect(() => {
    if (!enabled || !pageScroll) return;
    const header = headerRef.current;
    const below = belowRef.current;
    if (!header) return;

    const onFocusIn = (e: FocusEvent) => {
      if (!below) return;
      const t = e.target;
      if (!(t instanceof Node) || !below.contains(t)) return;
      pinnedRef.current = true;
      apply(false);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!below) return;
      const next = e.relatedTarget;
      if (next instanceof Node && below.contains(next)) return;
      pinnedRef.current = false;
    };

    header.addEventListener('focusin', onFocusIn);
    header.addEventListener('focusout', onFocusOut);
    return () => {
      header.removeEventListener('focusin', onFocusIn);
      header.removeEventListener('focusout', onFocusOut);
      pinnedRef.current = false;
    };
  }, [apply, belowRef, enabled, headerRef, pageScroll]);

  return enabled ? collapsed : false;
}
