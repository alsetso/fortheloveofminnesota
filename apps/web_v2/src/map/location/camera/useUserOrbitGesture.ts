'use client';

/**
 * Custom one-finger rotate: while Live holds the camera center pinned to the
 * user's geopoint, dragging a finger left/right anywhere on the map orbits
 * the bearing around that fixed point. Vertical movement is ignored entirely
 * (no pitch change, no accidental pan attempt).
 *
 * This exists because Mapbox's native dragRotate is two-finger-only on
 * touch. We attach raw pointer listeners directly to the map canvas instead
 * of using any Mapbox interaction handler, and only ever call setBearing /
 * easeTo-around — center is never panned here.
 *
 * Multi-touch guard: if a second finger touches down (pinch zoom), abort the
 * orbit immediately so Live's center-locked pinch can own the gesture.
 */

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { suppressNextMapClick } from '@/map/engine/mapClickGate';

export type UseUserOrbitGestureOptions = {
  /** Only orbit when true — i.e. Follow Me is active/locked. */
  enabled: boolean;
  /** Degrees of bearing change per pixel of horizontal drag. Tune to feel. */
  sensitivity?: number;
  /** Minimum px of movement before a drag counts as intentional (not a tap). */
  dragThresholdPx?: number;
  /**
   * Called when the user starts/stops actively orbiting, e.g. to pause
   * competing easeTo center updates while dragging.
   */
  onOrbitStart?: () => void;
  onOrbitEnd?: () => void;
  /**
   * Return the real GPS position of the player avatar. When provided, each
   * bearing step uses `easeTo({ around })` so the avatar stays fixed on screen
   * as the world rotates beneath it — not the look-ahead offset point.
   */
  around?: () => { lng: number; lat: number } | null;
};

export function useUserOrbitGesture(
  map: MapboxMap | null,
  options: UseUserOrbitGestureOptions,
): void {
  const {
    enabled,
    sensitivity = 0.35,
    dragThresholdPx = 6,
    onOrbitStart,
    onOrbitEnd,
    around,
  } = options;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onOrbitStartRef = useRef(onOrbitStart);
  onOrbitStartRef.current = onOrbitStart;
  const onOrbitEndRef = useRef(onOrbitEnd);
  onOrbitEndRef.current = onOrbitEnd;
  const aroundRef = useRef(around);
  aroundRef.current = around;

  useEffect(() => {
    if (!map) return;

    const canvas = map.getCanvas();

    let activePointerId: number | null = null;
    let lastX = 0;
    let startX = 0;
    let startY = 0;
    /** Past the drag threshold — actively rotating. */
    let isOrbiting = false;
    /** Any intentional finger travel (incl. vertical) — treat release as drag, not tap. */
    let significantMove = false;

    const cancel = () => {
      if (activePointerId != null) {
        try {
          canvas.releasePointerCapture(activePointerId);
        } catch {
          /* pointer may already be released */
        }
      }
      const wasOrbiting = isOrbiting;
      const wasDrag = significantMove || wasOrbiting;
      activePointerId = null;
      isOrbiting = false;
      significantMove = false;
      if (wasDrag) {
        // Custom pointer drag — browser still emits `click` on release.
        // Suppress so selected-point / place-mode only fire on deliberate taps.
        suppressNextMapClick();
      }
      if (wasOrbiting) onOrbitEndRef.current?.();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!enabledRef.current) return;
      if (activePointerId != null) {
        // Second finger mid-gesture — abort, don't garble bearing.
        cancel();
        return;
      }
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      lastX = e.clientX;
      isOrbiting = false;
      significantMove = false;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId) return;
      if (!enabledRef.current) {
        cancel();
        return;
      }

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!significantMove && Math.hypot(dx, dy) >= dragThresholdPx) {
        significantMove = true;
      }

      if (!isOrbiting) {
        if (Math.abs(dx) < dragThresholdPx) return; // tap / jitter / vertical-only
        isOrbiting = true;
        onOrbitStartRef.current?.();
      }

      const stepDx = e.clientX - lastX;
      lastX = e.clientX;

      // Drag right → turn the world right under the finger (globe convention).
      const nextBearing = normalizeBearing(map.getBearing() - stepDx * sensitivity);
      const pivot = aroundRef.current?.();
      if (pivot) {
        // Rotate around the avatar's exact GPS position so the character stays
        // locked to the same screen pixel — not the look-ahead offset center.
        map.easeTo({ bearing: nextBearing, around: pivot, duration: 0 });
      } else {
        map.setBearing(nextBearing);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId) return;
      cancel();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      cancel();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [map, sensitivity, dragThresholdPx]);
}

function normalizeBearing(deg: number): number {
  const n = deg % 360;
  return n < 0 ? n + 360 : n;
}
