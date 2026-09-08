'use client';

/**
 * Dock scroll primitives — single source of truth for when and how inner dock
 * regions scroll. The shell body, the dock-card host, and cards with their own
 * scrollers all consume these instead of re-deriving gates, reset effects, and
 * class strings, so scroll feel cannot drift between surfaces.
 *
 * Rules encoded here:
 * - Inner regions scroll only at the full snap while the sheet is not mid-drag
 *   (below full, every vertical gesture belongs to the sheet).
 * - A scroller resets to top whenever its content identity changes, even when
 *   the snap height stays the same (pane→pane, card→card navigation).
 * - Scroll chrome is always: hidden scrollbars, pan-y, momentum scrolling,
 *   contained overscroll bounce.
 */

import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';

/** Inner regions scroll only at full snap while the sheet is not mid-drag. */
export function useDockScrollEnabled(): boolean {
  const { snap, dragging } = useMapDock();
  return snap === 'full' && !dragging;
}

/** Reset a scroller to top when its content identity changes (pane/card nav). */
export function useDockScrollReset(
  ref: RefObject<HTMLElement | null>,
  scrollKey: string,
): void {
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollTop !== 0) el.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);
}

/** Canonical scroll-enabled chrome — pan-y, momentum, contained bounce. */
export const DOCK_SCROLL_ON_CLASS = 'overflow-y-auto touch-pan-y overscroll-y-contain';
/** Scroll locked — any snap below full, or while the sheet is mid-drag. */
export const DOCK_SCROLL_OFF_CLASS = 'overflow-hidden';

type DockScrollRegionProps = {
  children: ReactNode;
  /** Content identity — scroll resets to top when this changes. */
  scrollKey?: string;
  /** Layout classes (padding, spacing) appended after the scroll chrome. */
  className?: string;
  style?: CSSProperties;
};

/**
 * The canonical dock-card scroller. Owns the enable gate, the reset-on-key
 * effect, the `data-dock-card-scroll` hook the shell targets on snap resets,
 * and the full scroll className set.
 */
export function DockScrollRegion({
  children,
  scrollKey = '',
  className = '',
  style,
}: DockScrollRegionProps) {
  const enabled = useDockScrollEnabled();
  const ref = useRef<HTMLDivElement>(null);
  useDockScrollReset(ref, scrollKey);
  return (
    <div
      ref={ref}
      data-dock-card-scroll
      className={`scrollbar-hide min-h-0 flex-1 overflow-x-hidden [-webkit-overflow-scrolling:touch] ${
        enabled ? DOCK_SCROLL_ON_CLASS : DOCK_SCROLL_OFF_CLASS
      } ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
