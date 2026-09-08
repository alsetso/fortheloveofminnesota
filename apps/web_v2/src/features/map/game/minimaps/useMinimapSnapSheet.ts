'use client';

/**
 * useMinimapSnapSheet — snap-sheet physics for the minimap territory detail panel.
 *
 * Two detents:
 *   peek  (~46 vh) — initial state; map still visible behind the sheet
 *   full  (92 vh, capped at layoutH - 48px) — full takeover, scroll unlocked
 *
 * Drag is captured on the handle/header only. Content scrolls freely at `full`.
 * Physics reuse the same `pickSnapDetent` + `createVelocityTracker` from the
 * main dock; tokens (VH values, flick thresholds, rubber-band) are shared too.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createVelocityTracker,
  pickSnapDetent,
  type Detent,
} from '@/features/map/dockCore/core/dockGesture';
import {
  MAP_DOCK_FULL_HEIGHT_VH,
  MAP_DOCK_FULL_TOP_GAP_PX,
  MAP_DOCK_HALF_HEIGHT_VH,
  mapDockRubberBand,
  mapDockVhPx,
} from '@/features/map/dockCore/core/mapDockTokens';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MinimapSnap = 'peek' | 'full';

// Detent tuple typed for our two snaps
const DETENTS = (fullOff: number, peekOff: number): ReadonlyArray<Detent<MinimapSnap>> => [
  ['full', fullOff],
  ['peek', peekOff],
];

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMinimapSnapSheet(initialSnap: MinimapSnap = 'peek') {
  const [snap, setSnapState] = useState<MinimapSnap>(initialSnap);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [layoutH, setLayoutH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );

  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const velocityRef = useRef(createVelocityTracker());
  const startOffsetRef = useRef<number | null>(null);
  const startYRef = useRef(0);

  // Track window height for correct snap offsets on resize / orientation change.
  useEffect(() => {
    const onResize = () => setLayoutH(window.innerHeight);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Snap geometry ─────────────────────────────────────────────────────────

  // peek ≈ MAP_DOCK_HALF_HEIGHT_VH (46%) — map still visible behind
  const peekH   = mapDockVhPx(MAP_DOCK_HALF_HEIGHT_VH, layoutH);
  // full ≈ MAP_DOCK_FULL_HEIGHT_VH (92%) capped by safe top gap
  const fullH    = Math.min(layoutH - MAP_DOCK_FULL_TOP_GAP_PX, mapDockVhPx(MAP_DOCK_FULL_HEIGHT_VH, layoutH));

  const peekOffset = layoutH - peekH;
  const fullOffset = layoutH - fullH;

  const snapOffsets: Record<MinimapSnap, number> = { peek: peekOffset, full: fullOffset };

  const activeOffset = dragOffset ?? snapOffsets[snap];
  const sheetH = Math.max(0, layoutH - activeOffset);

  const dragging   = dragOffset !== null;
  const scrollable = snap === 'full' && !dragging;

  // ── Programmatic snap ─────────────────────────────────────────────────────

  const setSnap = useCallback(
    (target: MinimapSnap) => {
      setDragOffset(null);
      setSnapState(target);
      if (target !== 'full' && scrollBodyRef.current) {
        scrollBodyRef.current.scrollTop = 0;
      }
    },
    [],
  );

  // ── Drag handlers (attach to handle / header only) ────────────────────────

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // At full snap, only start drag if scroll body is at the top.
      if (snap === 'full') {
        const el = scrollBodyRef.current;
        if (el && el.scrollTop > 0) return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      startYRef.current = e.clientY;
      // Capture the live drag offset as the gesture start point.
      startOffsetRef.current = dragOffset ?? snapOffsets[snap];
      velocityRef.current.start(e.timeStamp);
      setDragOffset(startOffsetRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap, dragOffset, peekOffset, fullOffset],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (startOffsetRef.current == null) return;
      const dy = e.clientY - startYRef.current;
      velocityRef.current.addSample(dy, e.timeStamp);
      const raw = startOffsetRef.current + dy;
      // Rubber-band above full detent; hard-stop before sheet gets too small.
      const minOffset = fullOffset;
      const maxOffset = peekOffset + peekH * 0.6; // can't close below 40% of peek height
      const clamped =
        raw < minOffset
          ? minOffset - mapDockRubberBand(minOffset - raw, layoutH)
          : Math.min(raw, maxOffset);
      setDragOffset(clamped);
    },
    [fullOffset, peekOffset, peekH, layoutH],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (startOffsetRef.current == null) return;
      const release = dragOffset ?? startOffsetRef.current;
      const velocity = velocityRef.current.value;
      const target = pickSnapDetent(
        DETENTS(fullOffset, peekOffset),
        release,
        velocity,
        startOffsetRef.current,
      );
      startOffsetRef.current = null;
      velocityRef.current.reset();
      setSnap(target);
    },
    [dragOffset, fullOffset, peekOffset, setSnap],
  );

  // Attach to the drag-handle element: <div {...handleProps} />
  const handleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    // Prevent text selection while dragging
    style: { touchAction: 'none', userSelect: 'none' } as React.CSSProperties,
  };

  return {
    snap,
    setSnap,
    sheetH,
    dragging,
    scrollable,
    scrollBodyRef,
    handleProps,
  };
}
