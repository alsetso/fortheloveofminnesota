'use client';

import {
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type UIEvent,
} from 'react';
import {
  PageScrollContextProvider,
  usePageScrollContext,
  usePageScrollListenerRef,
} from '@/features/appShell/pageScrollContext';
import { useShellScrollNotify } from '@/features/appShell/shellChromeContext';
import { IconSpinner } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';

/** Breathing room under last content — tab bar clearance lives in AppShell spacer. */
const PAGE_SCROLL_TAIL_PAD = '1.5rem';

const PTR_THRESHOLD = 72;
const PTR_MAX = 112;
const PTR_RESISTANCE = 2.35;
const PTR_HOLD = 44;
const PTR_MIN_MS = 480;

/**
 * Scroll column for non-map tabs — fills the AppShell content column.
 * AppShell owns tab-bar / home-indicator clearance via an in-flow spacer;
 * this trail pad is only breathing room under the last content block.
 *
 * Pass `onRefresh` to enable native-feeling pull-to-refresh (spinner at top).
 */
export function PageScroll({
  children,
  onRefresh,
  onScroll,
  className = '',
}: {
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
  /** Fires on the scroll column — used for collapsing chrome (e.g. feed search). */
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const armedRef = useRef(false);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const parentScroll = usePageScrollContext();
  const localScroll = usePageScrollListenerRef();
  const shellNotify = useShellScrollNotify();

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      onScroll?.(event);
      if (shellNotify) shellNotify(event);
      else localScroll.notify(event);
    },
    [localScroll, onScroll, shellNotify],
  );

  const setPullDistance = useCallback((next: number) => {
    pullRef.current = next;
    setPull(next);
  }, []);

  const onTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!onRefresh || refreshing) return;
      const el = scrollerRef.current;
      if (!el || el.scrollTop > 1) {
        pullingRef.current = false;
        return;
      }
      pullingRef.current = true;
      armedRef.current = false;
      startYRef.current = e.touches[0]?.clientY ?? 0;
    },
    [onRefresh, refreshing],
  );

  const onTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!onRefresh || refreshing || !pullingRef.current) return;
      const el = scrollerRef.current;
      const y = e.touches[0]?.clientY ?? 0;
      const dy = y - startYRef.current;
      if (!el || dy <= 0 || el.scrollTop > 1) {
        if (pullRef.current !== 0) setPullDistance(0);
        return;
      }
      const distance = Math.min(PTR_MAX, dy / PTR_RESISTANCE);
      setPullDistance(distance);
      if (distance >= PTR_THRESHOLD && !armedRef.current) {
        armedRef.current = true;
        haptic.toggle();
      } else if (distance < PTR_THRESHOLD) {
        armedRef.current = false;
      }
    },
    [onRefresh, refreshing, setPullDistance],
  );

  const finishGesture = useCallback(async () => {
    if (!onRefresh || refreshing) {
      pullingRef.current = false;
      return;
    }
    if (!pullingRef.current) {
      setPullDistance(0);
      return;
    }
    pullingRef.current = false;
    if (pullRef.current < PTR_THRESHOLD) {
      setPullDistance(0);
      armedRef.current = false;
      return;
    }
    setRefreshing(true);
    setPullDistance(PTR_HOLD);
    haptic.play('light');
    const started = Date.now();
    try {
      await Promise.resolve(onRefresh());
    } finally {
      const wait = Math.max(0, PTR_MIN_MS - (Date.now() - started));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setRefreshing(false);
      setPullDistance(0);
      armedRef.current = false;
    }
  }, [onRefresh, refreshing, setPullDistance]);

  const indicatorHeight = refreshing ? PTR_HOLD : pull;
  const spin = refreshing || pull >= PTR_THRESHOLD;
  const opacity = refreshing ? 1 : Math.min(1, pull / PTR_THRESHOLD);
  const subscribe = parentScroll?.subscribe ?? localScroll.subscribe;

  return (
    <PageScrollContextProvider value={{ subscribe }}>
      <div
        ref={scrollerRef}
        className={`relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${className}`}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => void finishGesture()}
        onTouchCancel={() => void finishGesture()}
      >
        {onRefresh ? (
          <div
            className="pointer-events-none flex shrink-0 items-center justify-center overflow-hidden"
            style={{ height: indicatorHeight }}
            aria-hidden={!refreshing}
            aria-busy={refreshing}
          >
            <span className="transition-opacity" style={{ opacity }}>
              <IconSpinner
                className={`h-5 w-5 text-lake-blue ${spin ? 'animate-spin' : ''}`}
              />
            </span>
          </div>
        ) : null}
        {children}
        <div style={{ height: PAGE_SCROLL_TAIL_PAD }} aria-hidden />
      </div>
    </PageScrollContextProvider>
  );
}
