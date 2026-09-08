'use client';

/**
 * MapDockShell — explore dock snap / drag / wheel / glass underlay.
 * Presentational only. No product services.
 *
 * Snaps: collapsed → quarter → half → full (flush L/R/bottom).
 * Idle browse: Game caps at quarter; Explore allows half (controls body).
 * Search focus → full. Panel padding + height share open progress; body scroll at full.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { LOCAL_GOV_MAP_CHROME_COLUMN_CLASS } from '@/lib/map/mapChrome';
import {
  useMapDock,
  type MapDockSnap,
} from '@/features/map/dockCore/shell/MapDockContext';
import { dockPaneScrollKey } from '@/features/map/dockCore/core/dockPanes';
import {
  DOCK_SCROLL_OFF_CLASS,
  useDockScrollReset,
} from '@/features/map/dockCore/core/dockScroll';
import {
  createVelocityTracker,
  pickSnapDetent,
  resolveDockCardRelease,
  type VelocityTracker,
} from '@/features/map/dockCore/core/dockGesture';
import { setMapDockOccupiedBottomPx } from '@/features/map/dockCore/core/mapDockCameraInsetStore';
import {
  MAP_DOCK_COLUMN_GUTTER_CLASS,
  MAP_DOCK_DOCK_Z,
  MAP_DOCK_DRAG_CLAIM_MS,
  MAP_DOCK_DRAG_FORCE_SLOP_PX,
  MAP_DOCK_DRAG_TAP_SLOP_PX,
  MAP_DOCK_FULL_HEIGHT_VH,
  MAP_DOCK_FULL_TOP_GAP_PX,
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_SHEET_FILL_CLASS,
  MAP_DOCK_HALF_HEIGHT_VH,
  MAP_DOCK_HEADER_PAD_BOTTOM_PX,
  MAP_DOCK_HEADER_PAD_TOP_PX,
  MAP_DOCK_PILL_PEEK_PX,
  MAP_DOCK_QUARTER_HALF_GAP_PX,
  MAP_DOCK_QUARTER_HEIGHT_VH,
  MAP_DOCK_SHEET_SPRING_CLASS,
  MAP_DOCK_TRANSITION_CLASS,
  MAP_DOCK_WHEEL_OFFSET_SCALE,
  MAP_DOCK_WHEEL_SETTLE_MS,
  mapDockPadPx,
  mapDockRubberBand,
  mapDockSheetCornerRadiiPx,
  mapDockVhPx,
} from '@/features/map/dockCore/core/mapDockTokens';
import { readScreenRadiusPx } from '@/lib/despia/screenRadius';
import { DockCardPopover } from '@/features/map/dockCore/dockCard';
import ContributeSheet from '@/features/community/ContributeSheet';
import {
  subscribeContributeSheet,
  getContributeSheetSnapshot,
} from '@/features/community/contributeSheetStore';

type MapDockShellProps = {
  pill: ReactNode;
  children: ReactNode;
  sideRails?: ReactNode;
  /**
   * When true, idle browse at collapsed is 0px (fully hidden).
   * Default true for legacy callers; game + campaign pass false so the
   * search/account pill always peeks.
   */
  hideIdleBrowseWhenCollapsed?: boolean;
};

type DragMode = 'sheet' | 'scroll' | 'undecided' | 'pending';

type DragState = {
  pointerId: number;
  startClientY: number;
  startOffset: number;
  startT: number;
  lastClientY: number;
  tracker: VelocityTracker;
  moved: boolean;
  mode: DragMode;
  /** Scrollable element under the pointer (body or nested pane scroller). */
  scrollEl: HTMLElement | null;
  /** Started on a control — wait for claim delay + slop before stealing the gesture. */
  interactive: boolean;
};

function readSheetOffset(el: HTMLElement | null, sheetH: number, fallback: number): number {
  if (!el || sheetH <= 0) return fallback;
  return Math.max(0, sheetH - el.getBoundingClientRect().height);
}

function isVerticallyScrollable(node: HTMLElement): boolean {
  const style = window.getComputedStyle(node);
  const oy = style.overflowY;
  return (
    (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
    node.scrollHeight > node.clientHeight + 1
  );
}

function findScrollableAncestor(
  from: EventTarget | null,
  root: HTMLElement | null,
): HTMLElement | null {
  if (!from || !(from instanceof Element) || !root) return null;
  let node: Element | null = from;
  while (node && node !== root) {
    if (node instanceof HTMLElement && isVerticallyScrollable(node)) return node;
    node = node.parentElement;
  }
  if (root instanceof HTMLElement && isVerticallyScrollable(root)) return root;
  return null;
}

function canConsumeWheelScroll(
  from: EventTarget | null,
  root: HTMLElement | null,
  deltaY: number,
): boolean {
  if (!from || !(from instanceof Element) || !root || deltaY === 0) return false;
  let node: Element | null = from;
  while (node && node !== root) {
    if (node instanceof HTMLElement && isVerticallyScrollable(node)) {
      const max = node.scrollHeight - node.clientHeight;
      if (deltaY > 0 && node.scrollTop < max - 1) return true;
      if (deltaY < 0 && node.scrollTop > 1) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** Opt-out only — search, avatar, buttons, cards participate via pending claim. */
function shouldIgnoreSheetDragTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return true;
  return Boolean(target.closest('[data-no-sheet-drag]'));
}

/** Controls that should still receive a clean tap unless the gesture becomes a drag. */
function isInteractiveSheetTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  // Dedicated handle chrome always owns the gesture immediately.
  if (target.closest('[data-sheet-drag-handle]')) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, label, [role="button"], [role="link"], [data-sheet-drag-interactive]',
    ),
  );
}

export default function MapDockShell({
  pill,
  children,
  sideRails,
  hideIdleBrowseWhenCollapsed = true,
}: MapDockShellProps) {
  const {
    snap,
    setSnap,
    setVisiblePx,
    back,
    dragging,
    setDragging,
    settleSnap,
    dockCardOpen,
    closeDockCard,
    pane,
    quarterContentPx,
    halfContentPx,
  } = useMapDock();
  /**
   * Any dock card popover (account, controls/layers, activity, wallet, pin, …) is
   * full-bleed content with no tap-to-close chrome — min half-open, swipe past
   * half (or flick down) to dismiss. Regular browse/pane snapping is untouched.
   */
  const dockCardActive = dockCardOpen;
  const contributeSheetState = useSyncExternalStore(
    subscribeContributeSheet,
    getContributeSheetSnapshot,
    getContributeSheetSnapshot,
  );
  /** Anything that should hide the dock header chrome (search + account pill). */
  const headerHidden = dockCardOpen || contributeSheetState.open;
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const wheelOffsetRef = useRef<number | null>(null);
  /** Offset when the current wheel gesture began — enables committed-drag settle. */
  const wheelStartOffsetRef = useRef<number | null>(null);
  const wheelTrackerRef = useRef<VelocityTracker | null>(null);
  const wheelSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheetH, setSheetH] = useState(640);
  const [sheetW, setSheetW] = useState(390);
  const [headerH, setHeaderH] = useState(72);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [screenRadiusPx, setScreenRadiusPx] = useState(44);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setSheetH(Math.max(1, container.clientHeight));
    setSheetW(Math.max(1, container.clientWidth));
    setScreenRadiusPx(readScreenRadiusPx());
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const collapsed = snap === 'collapsed';
  const full = snap === 'full';

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measureHeader = () => setHeaderH(Math.max(1, el.offsetHeight));
    measureHeader();
    const ro = new ResizeObserver(measureHeader);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed, snap]);

  /**
   * Full layout column — shell stays full-screen (Despia prevent-autoscroll).
   * Keyboard overlays the dock; bottom edge never lifts with `--keyboard-inset`.
   */
  const layoutH = Math.max(1, sheetH);
  const defaultHalfVisiblePx = Math.min(
    layoutH,
    mapDockVhPx(MAP_DOCK_HALF_HEIGHT_VH, layoutH),
  );
  /**
   * Dock cards (esp. short text-only pins) may request a shorter half detent via
   * {@link halfContentPx}. Always capped by the default half so pull-up to full
   * stays available; floored so footer + handle still fit.
   */
  const halfVisiblePx =
    dockCardActive && halfContentPx != null && halfContentPx > 0
      ? Math.min(defaultHalfVisiblePx, Math.max(220, halfContentPx))
      : defaultHalfVisiblePx;
  /** Full snap — ~92% of the column, never taller than the status-chrome top gap allows. */
  const fullVisiblePx = Math.min(
    Math.max(0, layoutH - MAP_DOCK_FULL_TOP_GAP_PX),
    mapDockVhPx(MAP_DOCK_FULL_HEIGHT_VH, layoutH),
  );
  const minOffset = Math.max(0, layoutH - fullVisiblePx);
  /**
   * Closed detent: fully hide when idle browse with no card (game-only surface).
   * The dock rises when the user taps the map, opens search, or a card/pane is activated.
   */
  const collapsedVisiblePx =
    pane.id === 'browse' && !dockCardOpen && hideIdleBrowseWhenCollapsed
      ? 0
      : Math.max(MAP_DOCK_PILL_PEEK_PX, headerH);
  /**
   * Selected-point entry wraps to header + measured dual-action body.
   * Other panes keep a short fallback vh so the detent stays between collapsed + half.
   */
  const quarterFallbackPx = Math.min(
    layoutH,
    mapDockVhPx(MAP_DOCK_QUARTER_HEIGHT_VH, layoutH),
  );
  const quarterContentFitPx =
    pane.id === 'selected-point' && quarterContentPx != null && quarterContentPx > 0
      ? headerH + quarterContentPx
      : quarterFallbackPx;
  const quarterVisiblePx = Math.min(
    Math.max(0, halfVisiblePx - MAP_DOCK_QUARTER_HALF_GAP_PX),
    Math.max(collapsedVisiblePx + 16, quarterContentFitPx),
  );
  const snapOffsets: Record<MapDockSnap, number> = {
    full: minOffset,
    half: Math.max(minOffset, layoutH - halfVisiblePx),
    quarter: Math.max(minOffset, layoutH - quarterVisiblePx),
    collapsed: Math.max(0, layoutH - collapsedVisiblePx),
  };
  /**
   * Idle browse max detent — game caps at quarter (never half, never full).
   * Non-browse panes and open dock cards lift the cap so details/cards can go full.
   */
  const browseIdleMax: MapDockSnap | null =
    pane.id === 'browse' && !dockCardOpen ? 'quarter' : null;
  const dragMinOffset =
    browseIdleMax === 'quarter'
      ? snapOffsets.quarter
      : browseIdleMax === 'half'
        ? snapOffsets.half
        : minOffset;
  const offset = dragOffset ?? snapOffsets[snap];
  const visiblePx = layoutH - offset;
  const maxOffset = Math.max(dragMinOffset, layoutH - collapsedVisiblePx);
  const liveDockPadPx = mapDockPadPx(
    visiblePx,
    collapsedVisiblePx,
    halfVisiblePx,
    fullVisiblePx,
    sheetW,
  );
  // Dock card popover fills the sheet flush — no float pad while open.
  const dockPadPx = dockCardOpen ? 0 : liveDockPadPx;
  /** Footprint free-map chrome should clear (sheet height + float pad). */
  const occupiedBottomPx = visiblePx + dockPadPx;
  const chromeH = headerHidden ? 0 : headerH;

  useEffect(() => {
    setVisiblePx(occupiedBottomPx);
    // Find Me camera padding lives outside MapDockProvider — mirror footprint.
    setMapDockOccupiedBottomPx(occupiedBottomPx);
  }, [occupiedBottomPx, setVisiblePx]);

  useEffect(() => {
    if (snap === 'full') return;
    const body = bodyRef.current;
    if (body && body.scrollTop !== 0) body.scrollTop = 0;
    const cardScroll = body?.querySelector('[data-dock-card-scroll]');
    if (cardScroll instanceof HTMLElement && cardScroll.scrollTop !== 0) {
      cardScroll.scrollTop = 0;
    }
  }, [snap]);

  /**
   * Navigating to new pane content (e.g. county→county, or list row→details)
   * often keeps the same snap height, so the snap-keyed reset above never
   * fires — the new pane would otherwise inherit the old pane's scroll
   * position. Reset on content identity instead, independent of snap.
   */
  useDockScrollReset(bodyRef, dockPaneScrollKey(pane));

  // Dock card popover lives in the sheet — drop it when the sheet collapses away.
  useEffect(() => {
    if (snap === 'collapsed' && dockCardOpen) closeDockCard();
  }, [snap, dockCardOpen, closeDockCard]);

  // Idle browse cannot sit above its max (e.g. leftover full after closing a card).
  useEffect(() => {
    if (!browseIdleMax) return;
    if (browseIdleMax === 'quarter' && (snap === 'half' || snap === 'full')) {
      settleSnap('quarter');
    }
  }, [browseIdleMax, snap, settleSnap]);

  /**
   * Dock card popover release — half ⇄ full while dragging; must cross
   * meaningfully past half (or flick down) to close (rules in dockGesture.ts).
   * Applies uniformly to every dock card (account, controls, activity, wallet,
   * pin, …) since they all render through the one shared `DockCardPopover`.
   */
  const settleDockCardRelease = useCallback(
    (releaseOffset: number, velocity: number, startOffset?: number) => {
      // Same flick / 56px-drag / nearest tiers as the dock — cards only expose
      // full ⇄ half, with dismiss as the step below half.
      const result = resolveDockCardRelease(
        releaseOffset,
        velocity,
        snapOffsets.half,
        snapOffsets.full,
        startOffset,
      );
      if (result === 'close') {
        setSnap('quarter');
        closeDockCard();
        return;
      }
      settleSnap(result);
    },
    [
      snapOffsets.half,
      snapOffsets.full,
      setSnap,
      closeDockCard,
      settleSnap,
    ],
  );

  const pickSnapTarget = useCallback(
    (releaseOffset: number, velocity: number, startOffset?: number): MapDockSnap => {
      // Flick / committed-drag / nearest tiers live in dockGesture.ts.
      const allowed: MapDockSnap[] =
        browseIdleMax === 'quarter'
          ? ['collapsed', 'quarter']
          : browseIdleMax === 'half'
            ? ['collapsed', 'quarter', 'half']
            : ['collapsed', 'quarter', 'half', 'full'];
      const detents = (
        Object.entries(snapOffsets) as [MapDockSnap, number][]
      ).filter(([name]) => allowed.includes(name));
      return pickSnapDetent(detents, releaseOffset, velocity, startOffset);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      layoutH,
      quarterVisiblePx,
      halfVisiblePx,
      collapsedVisiblePx,
      pane.id,
      quarterContentPx,
      browseIdleMax,
      halfContentPx,
    ],
  );

  const clampOffset = useCallback(
    (raw: number): number => {
      if (raw < dragMinOffset) {
        return dragMinOffset - mapDockRubberBand(dragMinOffset - raw, layoutH);
      }
      if (raw > maxOffset) return maxOffset + mapDockRubberBand(raw - maxOffset, layoutH);
      return raw;
    },
    [maxOffset, dragMinOffset, layoutH],
  );

  const settleWheel = useCallback(() => {
    wheelSettleTimerRef.current = null;
    const raw = wheelOffsetRef.current;
    if (raw == null) return;
    const releaseOffset = Math.min(Math.max(raw, dragMinOffset), maxOffset);
    const velocity = wheelTrackerRef.current?.value ?? 0;
    const startOffset = wheelStartOffsetRef.current ?? undefined;
    wheelOffsetRef.current = null;
    wheelStartOffsetRef.current = null;
    wheelTrackerRef.current?.reset();
    setDragOffset(null);
    setDragging(false);
    if (dockCardActive) {
      settleDockCardRelease(releaseOffset, velocity, startOffset);
      return;
    }
    settleSnap(pickSnapTarget(releaseOffset, velocity, startOffset));
  }, [
    maxOffset,
    dragMinOffset,
    pickSnapTarget,
    setDragging,
    settleSnap,
    dockCardActive,
    settleDockCardRelease,
  ]);

  const applyWheelToSheet = useCallback(
    (deltaY: number, timeStamp: number) => {
      const sheetDelta = -deltaY * MAP_DOCK_WHEEL_OFFSET_SCALE;
      wheelTrackerRef.current ??= createVelocityTracker();
      wheelTrackerRef.current.addSample(sheetDelta, timeStamp);
      const base =
        wheelOffsetRef.current ?? readSheetOffset(sheetRef.current, layoutH, snapOffsets[snap]);
      if (wheelStartOffsetRef.current == null) {
        wheelStartOffsetRef.current = base;
      }
      const next = clampOffset(base + sheetDelta);
      wheelOffsetRef.current = next;
      setDragging(true);
      setDragOffset(next);
      if (wheelSettleTimerRef.current) clearTimeout(wheelSettleTimerRef.current);
      wheelSettleTimerRef.current = setTimeout(settleWheel, MAP_DOCK_WHEEL_SETTLE_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clampOffset, settleWheel, setDragging, snap, layoutH, halfVisiblePx, collapsedVisiblePx],
  );

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      if (dragRef.current?.moved) return;
      const deltaY = e.deltaY;
      if (deltaY === 0) return;
      const atFull = snap === 'full' && wheelOffsetRef.current == null;
      if (atFull && canConsumeWheelScroll(e.target, sheet, deltaY)) return;
      if (atFull && deltaY > 0) return;
      e.preventDefault();
      applyWheelToSheet(deltaY, e.timeStamp);
    };

    sheet.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      sheet.removeEventListener('wheel', onWheel, true);
      if (wheelSettleTimerRef.current) clearTimeout(wheelSettleTimerRef.current);
    };
  }, [applyWheelToSheet, snap, layoutH, halfVisiblePx, collapsedVisiblePx]);

  const claimSheetDrag = useCallback(
    (
      e: ReactPointerEvent<HTMLDivElement>,
      drag: DragState,
      /** When true, rebase start to the claim point (scroll→sheet handoff). */
      rebaseStart: boolean,
    ) => {
      drag.mode = 'sheet';
      if (rebaseStart) {
        drag.startClientY = e.clientY;
        drag.startOffset = readSheetOffset(sheetRef.current, layoutH, snapOffsets[snap]);
      }
      drag.lastClientY = e.clientY;
      drag.tracker.start(e.timeStamp);
      drag.moved = true;
      setDragging(true);
      // Drop keyboard/caret so the sheet owns the gesture over search/inputs.
      const active = document.activeElement;
      if (active instanceof HTMLElement && sheetRef.current?.contains(active)) {
        active.blur();
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      e.preventDefault();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutH, setDragging, snap, halfVisiblePx, collapsedVisiblePx, fullVisiblePx],
  );

  /**
   * Whole-sheet drag (Maps-style). At half/collapsed every vertical drag moves the sheet.
   * Interactive chrome (search, avatar, buttons, cards) arms after a short claim delay so
   * a clean tap still clicks; movement past slop then steals the gesture for resize.
   * At full, compete with body/pane scroll: pull down from scrollTop≈0 → sheet; otherwise scroll.
   */
  const handleSheetPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (shouldIgnoreSheetDragTarget(e.target)) return;

      if (wheelSettleTimerRef.current) {
        clearTimeout(wheelSettleTimerRef.current);
        wheelSettleTimerRef.current = null;
      }
      wheelOffsetRef.current = null;

      const targetNode = e.target instanceof Node ? e.target : null;
      const fromBody = !!(targetNode && bodyRef.current?.contains(targetNode));
      const scrollEl = fromBody
        ? (findScrollableAncestor(e.target, bodyRef.current) ??
          (bodyRef.current && isVerticallyScrollable(bodyRef.current) ? bodyRef.current : null))
        : null;
      const interactive = isInteractiveSheetTarget(e.target);
      // Header/chrome always moves the sheet. Body competes with scroll when full.
      // Interactive targets stay pending until claim delay + slop so taps still click.
      const mode: DragMode =
        full && scrollEl ? 'undecided' : interactive ? 'pending' : 'sheet';

      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: e.pointerId,
        startClientY: e.clientY,
        startOffset: readSheetOffset(sheetRef.current, layoutH, snapOffsets[snap]),
        startT: e.timeStamp,
        lastClientY: e.clientY,
        tracker: createVelocityTracker(e.timeStamp),
        moved: false,
        mode,
        scrollEl,
        interactive,
      };

      // Capture immediately when sheet owns the gesture (not competing with scroll/tap).
      if (mode === 'sheet') {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap, layoutH, halfVisiblePx, collapsedVisiblePx, fullVisiblePx, full],
  );

  const handleSheetPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (drag.mode === 'scroll') return;

      const dy = e.clientY - drag.startClientY;

      if (drag.mode === 'pending') {
        const absDy = Math.abs(dy);
        if (absDy < MAP_DOCK_DRAG_TAP_SLOP_PX) return;
        const armed = e.timeStamp - drag.startT >= MAP_DOCK_DRAG_CLAIM_MS;
        // Before the claim window, only a clear swipe steals the tap; after, any slop claims.
        if (!armed && absDy < MAP_DOCK_DRAG_FORCE_SLOP_PX) return;
        claimSheetDrag(e, drag, false);
      } else if (drag.mode === 'undecided') {
        if (Math.abs(dy) < MAP_DOCK_DRAG_TAP_SLOP_PX) return;
        const scrollTop = drag.scrollEl?.scrollTop ?? bodyRef.current?.scrollTop ?? 0;
        // Finger down + at top of scroll → claim sheet immediately (skip interactive
        // claim delay so nested card scrollers can't rubber-band / steal the gesture).
        // Clean taps never reach here (dy < tap slop).
        if (dy > 0 && scrollTop <= 1) {
          claimSheetDrag(e, drag, true);
        } else {
          drag.mode = 'scroll';
          dragRef.current = null;
          return;
        }
      }

      if (drag.mode !== 'sheet') return;

      drag.tracker.addSample(e.clientY - drag.lastClientY, e.timeStamp);
      drag.lastClientY = e.clientY;
      const sheetDy = e.clientY - drag.startClientY;
      if (!drag.moved) {
        if (Math.abs(sheetDy) < MAP_DOCK_DRAG_TAP_SLOP_PX) return;
        drag.moved = true;
        setDragging(true);
      }
      e.preventDefault();
      setDragOffset(clampOffset(drag.startOffset + sheetDy));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [claimSheetDrag, clampOffset, setDragging, layoutH, snap, halfVisiblePx, collapsedVisiblePx],
  );

  const handleSheetPointerEnd = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* already released */
      }
      if (drag.mode !== 'sheet' || !drag.moved) {
        setDragOffset(null);
        return;
      }
      suppressClickRef.current = true;
      const raw = drag.startOffset + (drag.lastClientY - drag.startClientY);
      const releaseOffset = Math.min(Math.max(raw, dragMinOffset), maxOffset);
      setDragOffset(null);
      setDragging(false);
      const velocity = drag.tracker.value;
      if (dockCardActive) {
        settleDockCardRelease(releaseOffset, velocity, drag.startOffset);
        return;
      }
      settleSnap(pickSnapTarget(releaseOffset, velocity, drag.startOffset));
    },
    [
      maxOffset,
      dragMinOffset,
      pickSnapTarget,
      setDragging,
      settleSnap,
      dockCardActive,
      settleDockCardRelease,
    ],
  );

  const handleSheetClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const bodyScrollable = full && dragOffset == null;
  const padTransition = dragging ? '' : MAP_DOCK_SHEET_SPRING_CLASS;
  const { top: topRadiusPx, bottom: bottomRadiusPx } = mapDockSheetCornerRadiiPx(
    visiblePx,
    collapsedVisiblePx,
    halfVisiblePx,
    dockPadPx,
    screenRadiusPx,
  );
  const flushEdges = dockPadPx < 0.5;
  const sheetRadiusStyle = {
    borderTopLeftRadius: topRadiusPx,
    borderTopRightRadius: topRadiusPx,
    borderBottomLeftRadius: bottomRadiusPx,
    borderBottomRightRadius: bottomRadiusPx,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 ${MAP_DOCK_DOCK_Z} overflow-visible`}
      data-map-shell-dock=""
    >
      <div
        aria-hidden
        // Dock card popovers are swipe-to-dismiss only — no tap-outside close.
        onClick={full && !dockCardActive ? back : undefined}
        className={`absolute inset-0 transition-colors duration-200 ${
          full ? 'pointer-events-auto bg-black/10' : 'pointer-events-none bg-transparent'
        }`}
      />
      {/* Float pad only — keyboard overlays; dock bottom stays pinned to the shell. */}
      <div
        className={`flex h-full w-full flex-col items-center justify-end ${padTransition}`}
        style={
          {
            paddingLeft: `${dockPadPx}px`,
            paddingRight: `${dockPadPx}px`,
            paddingBottom: `${dockPadPx}px`,
          } as CSSProperties
        }
      >
        <div
          ref={sheetRef}
          className={`pointer-events-auto relative flex w-full flex-col ${
            bodyScrollable ? '' : 'touch-none'
          } ${LOCAL_GOV_MAP_CHROME_COLUMN_CLASS} ${MAP_DOCK_TRANSITION_CLASS} ${
            dragging ? '' : MAP_DOCK_SHEET_SPRING_CLASS
          }`}
          style={{ height: `${Math.max(0, visiblePx)}px` } as CSSProperties}
          role="region"
          aria-label="Explore Minnesota"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerEnd}
          onPointerCancel={handleSheetPointerEnd}
          onClickCapture={handleSheetClickCapture}
        >
          {/*
            Keep sideRails mounted when a dock card opens — opacity only.
            Unmounting freezes WebGL hosts (game Object MiniMap goes solid black).
          */}
          {sideRails ? (
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-full z-10 mb-3 ${
                dockCardOpen || contributeSheetState.open ? 'opacity-0' : ''
              }`}
              aria-hidden={dockCardOpen || undefined}
            >
              {sideRails}
            </div>
          ) : null}
          <div
            className={`relative flex h-full min-h-0 flex-col overflow-hidden ${padTransition}`}
            style={sheetRadiusStyle}
          >
            {/* Glass capsule stays mounted when collapsed — only the sheet height clips away. */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 ${MAP_DOCK_SHEET_FILL_CLASS} ${padTransition} ${
                flushEdges
                  ? ''
                  : `${MAP_DOCK_GLASS_BORDER_CLASS} shadow-[0_-6px_28px_rgba(0,0,0,0.12)]`
              }`}
              style={sheetRadiusStyle}
            />
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
              {/* Sticky chrome — hidden while a dock card or contribute sheet owns the sheet. */}
              <div
                ref={headerRef}
                className={`pointer-events-none absolute inset-x-0 top-0 z-20 select-none transition-[opacity,transform] duration-280 ease-[cubic-bezier(0.2,0,0,1)] ${MAP_DOCK_COLUMN_GUTTER_CLASS} ${
                  headerHidden
                    ? 'pointer-events-none -translate-y-2 opacity-0'
                    : 'opacity-100'
                }`}
                style={
                  {
                    paddingTop: MAP_DOCK_HEADER_PAD_TOP_PX,
                    paddingBottom: MAP_DOCK_HEADER_PAD_BOTTOM_PX,
                  } as CSSProperties
                }
                aria-hidden={headerHidden || undefined}
              >
                <div className={`pointer-events-auto ${headerHidden ? 'pointer-events-none' : ''}`}>
                  {pill}
                </div>
              </div>
              <div
                ref={bodyRef}
                className={`flex min-h-0 flex-1 flex-col overscroll-contain scrollbar-hide [-webkit-overflow-scrolling:touch] ${
                  collapsed
                    ? 'invisible pointer-events-none'
                    : dockCardOpen
                      ? DOCK_SCROLL_OFF_CLASS
                      : bodyScrollable
                        ? 'overflow-y-auto touch-pan-y'
                        : DOCK_SCROLL_OFF_CLASS
                }`}
                style={{ ['--dock-chrome-h' as string]: `${chromeH}px` } as CSSProperties}
                aria-hidden={collapsed || undefined}
              >
                {/* Spacer matches chrome height; collapses to 0 while a dock card is open. */}
                <div
                  aria-hidden
                  className="shrink-0 transition-[height] duration-280 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{ height: chromeH }}
                />
                {/*
                  Pane stack + DockCardPopover. Card fills the sheet; all dock
                  chrome/panes/rails hide while open.
                */}
                <div className="relative min-h-0 flex-1">
                  <div
                    className={`h-full min-h-0 transition-[opacity,transform] duration-280 ease-[cubic-bezier(0.2,0,0,1)] ${
                      dockCardOpen
                        ? 'pointer-events-none invisible absolute inset-0 opacity-0'
                        : 'relative opacity-100'
                    }`}
                    aria-hidden={dockCardOpen || undefined}
                  >
                    {/* Keep panes mounted while collapsed/card-open so state survives. */}
                    {children}
                  </div>
                  <DockCardPopover />
                  <ContributeSheet />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
