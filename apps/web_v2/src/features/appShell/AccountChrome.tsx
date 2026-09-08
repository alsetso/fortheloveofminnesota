'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import ContactsSheet from '@/features/contacts/ui/ContactsSheet';
import { AccountMenuProvider } from '@/features/appShell/AccountMenuContext';
import AccountMenuShell from '@/features/appShell/AccountMenuShell';
import {
  MapDockProvider,
  useMapDock,
  type MapDockSnap,
} from '@/features/map/dockCore/shell/MapDockContext';
import { DockCardPopover } from '@/features/map/dockCore/dockCard';
import {
  createVelocityTracker,
  resolveDockCardRelease,
  type VelocityTracker,
} from '@/features/map/dockCore/core/dockGesture';
import {
  MAP_DOCK_DRAG_CLAIM_MS,
  MAP_DOCK_DRAG_FORCE_SLOP_PX,
  MAP_DOCK_DRAG_TAP_SLOP_PX,
  MAP_DOCK_FULL_HEIGHT_VH,
  MAP_DOCK_FULL_TOP_GAP_PX,
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_HALF_HEIGHT_VH,
  MAP_DOCK_SHEET_SPRING_CLASS,
  MAP_DOCK_TRANSITION_CLASS,
  mapDockRubberBand,
  mapDockSheetCornerRadiiPx,
  mapDockVhPx,
} from '@/features/map/dockCore/core/mapDockTokens';
import { LOCAL_GOV_MAP_CHROME_COLUMN_CLASS } from '@/lib/map/mapChrome';
import { readScreenRadiusPx } from '@/lib/despia/screenRadius';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

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
  scrollEl: HTMLElement | null;
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

function shouldIgnoreSheetDragTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return true;
  return Boolean(target.closest('[data-no-sheet-drag]'));
}

function isInteractiveSheetTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  if (target.closest('[data-sheet-drag-handle]')) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, label, [role="button"], [role="link"], [data-sheet-drag-interactive]',
    ),
  );
}

/**
 * Non-map tabs (Feed / Discover) — X-style push account menu + the same
 * account dock card stack as Map / Discover. Swipe-down dismiss on cards
 * (half ⇄ full), no dim overlay, stacks above the shell tab bar.
 */
export default function AccountChrome({ children }: { children: ReactNode }) {
  return (
    <MapDockProvider>
      <AccountMenuProvider>
        <AccountMenuShell>{children}</AccountMenuShell>
        <AppAccountCardSheet />
        <AppContactsSheetHost />
      </AccountMenuProvider>
    </MapDockProvider>
  );
}

function AppContactsSheetHost() {
  const { contactsSheet, closeContactsSheet } = useMapDock();
  if (!contactsSheet) return null;
  return <ContactsSheet state={contactsSheet} onClose={closeContactsSheet} />;
}

function AppAccountCardSheet() {
  const {
    dockCardOpen,
    closeDockCard,
    snap,
    setSnap,
    settleSnap,
    dragging,
    setDragging,
    halfContentPx,
  } = useMapDock();

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const [layoutH, setLayoutH] = useState(640);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [screenRadiusPx, setScreenRadiusPx] = useState(44);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setLayoutH(Math.max(1, container.clientHeight));
    setScreenRadiusPx(readScreenRadiusPx());
  }, []);

  useEffect(() => {
    if (!dockCardOpen) return;
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
  }, [dockCardOpen, measure]);

  // Card opens at least half — match map openDockCard.
  useEffect(() => {
    if (!dockCardOpen) return;
    if (snap === 'collapsed' || snap === 'quarter') setSnap('half');
  }, [dockCardOpen, snap, setSnap]);

  const defaultHalfVisiblePx = Math.min(
    layoutH,
    mapDockVhPx(MAP_DOCK_HALF_HEIGHT_VH, layoutH),
  );
  const halfVisiblePx =
    halfContentPx != null && halfContentPx > 0
      ? Math.min(defaultHalfVisiblePx, Math.max(220, halfContentPx))
      : defaultHalfVisiblePx;
  const fullVisiblePx = Math.min(
    Math.max(0, layoutH - MAP_DOCK_FULL_TOP_GAP_PX),
    mapDockVhPx(MAP_DOCK_FULL_HEIGHT_VH, layoutH),
  );
  const minOffset = Math.max(0, layoutH - fullVisiblePx);
  const halfOffset = Math.max(minOffset, layoutH - halfVisiblePx);
  /** Dismiss travel — pull past half toward a short peek. */
  const dismissPeekPx = 72;
  const maxOffset = Math.max(halfOffset, layoutH - dismissPeekPx);

  const snapOffsets: Record<'half' | 'full', number> = {
    full: minOffset,
    half: halfOffset,
  };
  const activeSnap: 'half' | 'full' = snap === 'full' ? 'full' : 'half';
  const offset = dragOffset ?? snapOffsets[activeSnap];
  const visiblePx = Math.max(0, layoutH - offset);
  const full = activeSnap === 'full' && dragOffset == null;

  const clampOffset = useCallback(
    (raw: number): number => {
      if (raw < minOffset) {
        return minOffset - mapDockRubberBand(minOffset - raw, layoutH);
      }
      if (raw > maxOffset) return maxOffset + mapDockRubberBand(raw - maxOffset, layoutH);
      return raw;
    },
    [maxOffset, minOffset, layoutH],
  );

  const settleRelease = useCallback(
    (releaseOffset: number, velocity: number, startOffset?: number) => {
      const result = resolveDockCardRelease(
        releaseOffset,
        velocity,
        snapOffsets.half,
        snapOffsets.full,
        startOffset,
      );
      if (result === 'close') {
        closeDockCard();
        return;
      }
      settleSnap(result as MapDockSnap);
    },
    [snapOffsets.half, snapOffsets.full, closeDockCard, settleSnap],
  );

  const claimSheetDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, drag: DragState, force: boolean) => {
      drag.mode = 'sheet';
      drag.startClientY = e.clientY;
      drag.lastClientY = e.clientY;
      drag.startOffset = readSheetOffset(sheetRef.current, layoutH, snapOffsets[activeSnap]);
      drag.startT = e.timeStamp;
      drag.tracker = createVelocityTracker(e.timeStamp);
      if (force) suppressClickRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [layoutH, snapOffsets, activeSnap],
  );

  const handleSheetPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (shouldIgnoreSheetDragTarget(e.target)) return;

      const targetNode = e.target instanceof Node ? e.target : null;
      const fromBody = !!(targetNode && bodyRef.current?.contains(targetNode));
      const scrollEl = fromBody
        ? (findScrollableAncestor(e.target, bodyRef.current) ??
          (bodyRef.current && isVerticallyScrollable(bodyRef.current)
            ? bodyRef.current
            : null))
        : null;
      const interactive = isInteractiveSheetTarget(e.target);
      const mode: DragMode =
        full && scrollEl ? 'undecided' : interactive ? 'pending' : 'sheet';

      suppressClickRef.current = false;
      dragRef.current = {
        pointerId: e.pointerId,
        startClientY: e.clientY,
        startOffset: readSheetOffset(sheetRef.current, layoutH, snapOffsets[activeSnap]),
        startT: e.timeStamp,
        lastClientY: e.clientY,
        tracker: createVelocityTracker(e.timeStamp),
        moved: false,
        mode,
        scrollEl,
        interactive,
      };

      if (mode === 'sheet') {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [full, layoutH, snapOffsets, activeSnap],
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
        if (!armed && absDy < MAP_DOCK_DRAG_FORCE_SLOP_PX) return;
        claimSheetDrag(e, drag, false);
      } else if (drag.mode === 'undecided') {
        if (Math.abs(dy) < MAP_DOCK_DRAG_TAP_SLOP_PX) return;
        const scrollTop = drag.scrollEl?.scrollTop ?? bodyRef.current?.scrollTop ?? 0;
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
    [claimSheetDrag, clampOffset, setDragging],
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
      const releaseOffset = Math.min(Math.max(raw, minOffset), maxOffset);
      setDragOffset(null);
      setDragging(false);
      settleRelease(releaseOffset, drag.tracker.value, drag.startOffset);
    },
    [maxOffset, minOffset, setDragging, settleRelease],
  );

  const handleSheetClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!dockCardOpen) return null;

  const padTransition = dragging ? '' : MAP_DOCK_SHEET_SPRING_CLASS;
  const { top: topRadiusPx, bottom: bottomRadiusPx } = mapDockSheetCornerRadiiPx(
    visiblePx,
    dismissPeekPx,
    halfVisiblePx,
    0,
    screenRadiusPx,
  );
  const sheetRadiusStyle = {
    borderTopLeftRadius: topRadiusPx,
    borderTopRightRadius: topRadiusPx,
    borderBottomLeftRadius: bottomRadiusPx,
    borderBottomRightRadius: bottomRadiusPx,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none fixed inset-0 ${Z_LAYER_CLASS.APP_OVERLAY}`}
      data-app-account-card=""
      role="presentation"
    >
      {/* No dim overlay — swipe-to-dismiss only, same as map dock cards. */}
      <div
        className={`flex h-full w-full flex-col items-center justify-end ${padTransition}`}
      >
        <div
          ref={sheetRef}
          className={`pointer-events-auto relative flex w-full flex-col ${
            full ? '' : 'touch-none'
          } ${LOCAL_GOV_MAP_CHROME_COLUMN_CLASS} ${MAP_DOCK_TRANSITION_CLASS} ${
            dragging ? '' : MAP_DOCK_SHEET_SPRING_CLASS
          }`}
          style={{ height: `${Math.max(0, visiblePx)}px`, ...sheetRadiusStyle }}
          role="dialog"
          aria-modal="true"
          aria-label="Account"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerEnd}
          onPointerCancel={handleSheetPointerEnd}
          onClickCapture={handleSheetClickCapture}
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 bg-white/92 shadow-[0_-6px_28px_rgba(0,0,0,0.14)] [backdrop-filter:blur(24px)] [-webkit-backdrop-filter:blur(24px)] ${MAP_DOCK_GLASS_BORDER_CLASS}`}
            style={sheetRadiusStyle}
          />
          <div
            ref={bodyRef}
            className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DockCardPopover />
          </div>
        </div>
      </div>
    </div>
  );
}
