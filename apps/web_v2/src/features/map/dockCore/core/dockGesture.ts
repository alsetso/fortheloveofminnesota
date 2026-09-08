/**
 * dockGesture — pure snap/flick physics for the explore dock.
 *
 * Offsets: distance from layout top to sheet top (smaller = taller sheet).
 * Velocity: px/ms; positive = moving down (collapsing).
 *
 * ## Down from full (soft vs complete)
 *
 * | Gesture                         | Result                                      |
 * |---------------------------------|---------------------------------------------|
 * | Soft flick / short pull / mid   | **half**                                    |
 * | Complete flick / pull past half | **close** (card) or bottom snap (dock)      |
 *
 * Soft = FLICK_VELOCITY or ADVANCE_DRAG_PX / midpoint to half.
 * Complete = STRONG_FLICK_VELOCITY or release past the half detent.
 */

import {
  MAP_DOCK_ADVANCE_DRAG_PX,
  MAP_DOCK_DRAG_TAP_SLOP_PX,
  MAP_DOCK_FLICK_VELOCITY,
  MAP_DOCK_STRONG_FLICK_VELOCITY,
} from '@/features/map/dockCore/core/mapDockTokens';

/** Weight given to the newest movement sample in the velocity EMA. */
export const DOCK_VELOCITY_SMOOTHING = 0.8;
const DEFAULT_SAMPLE_DT_MS = 16;

export type VelocityTracker = {
  start: (timeStamp: number) => void;
  addSample: (deltaPx: number, timeStamp: number) => void;
  readonly value: number;
  reset: () => void;
};

export function createVelocityTracker(startTimeStamp?: number): VelocityTracker {
  let velocity = 0;
  let lastT: number | null = startTimeStamp ?? null;
  return {
    start(timeStamp: number) {
      lastT = timeStamp;
    },
    addSample(deltaPx: number, timeStamp: number) {
      const dt = lastT == null ? DEFAULT_SAMPLE_DT_MS : timeStamp - lastT;
      lastT = timeStamp;
      if (dt <= 0) return;
      const instantaneous = deltaPx / Math.max(dt, 1);
      velocity =
        velocity * (1 - DOCK_VELOCITY_SMOOTHING) +
        instantaneous * DOCK_VELOCITY_SMOOTHING;
    },
    get value() {
      return velocity;
    },
    reset() {
      velocity = 0;
      lastT = null;
    },
  };
}

export type Detent<T extends string = string> = readonly [name: T, offset: number];

function advanceInDirection<T extends string>(
  sorted: Detent<T>[],
  movingDown: boolean,
  fromOffset: number,
): T | null {
  const inDirection = sorted.filter(([, o]) =>
    movingDown ? o > fromOffset + 1 : o < fromOffset - 1,
  );
  if (inDirection.length === 0) return null;
  return movingDown ? inDirection[0][0] : inDirection[inDirection.length - 1][0];
}

function nearestDetent<T extends string>(
  sorted: Detent<T>[],
  releaseOffset: number,
): T {
  let best = sorted[0];
  for (const d of sorted) {
    if (Math.abs(d[1] - releaseOffset) < Math.abs(best[1] - releaseOffset)) best = d;
  }
  return best[0];
}

/**
 * True when the gesture started on (or rubber-banded at) the tallest detent.
 */
function startedFromTallest<T extends string>(
  sorted: Detent<T>[],
  fromOffset: number,
): boolean {
  return fromOffset <= sorted[0][1] + 8;
}

/**
 * Down from full:
 * - complete → bottom detent (card `close`, dock `collapsed`)
 * - soft → next detent only (`half`)
 * Returns null when this special case does not apply.
 */
function resolveDownFromFull<T extends string>(
  sorted: Detent<T>[],
  releaseOffset: number,
  velocity: number,
  fromOffset: number,
  dragDelta: number | null,
): T | null {
  if (sorted.length < 2) return null;
  if (!startedFromTallest(sorted, fromOffset)) return null;

  const movingDown =
    (dragDelta != null && dragDelta > MAP_DOCK_DRAG_TAP_SLOP_PX) ||
    velocity > MAP_DOCK_FLICK_VELOCITY;
  if (!movingDown) return null;

  const next = sorted[1]; // half (or only step below full)
  const bottom = sorted[sorted.length - 1];
  const halfOffset = next[1];

  const completeFlick = velocity >= MAP_DOCK_STRONG_FLICK_VELOCITY;
  // Pull through half — finger crossed the half detent (complete scroll).
  const pulledPastHalf = releaseOffset >= halfOffset + MAP_DOCK_ADVANCE_DRAG_PX;
  if (completeFlick || pulledPastHalf) {
    return bottom[0];
  }

  // Soft flick / soft pull / past midpoint toward half → half only.
  const softFlick =
    velocity > MAP_DOCK_FLICK_VELOCITY &&
    velocity < MAP_DOCK_STRONG_FLICK_VELOCITY;
  const softPull =
    dragDelta != null && dragDelta > MAP_DOCK_ADVANCE_DRAG_PX;
  const midToHalf = (fromOffset + halfOffset) / 2;
  const pastMidToHalf = releaseOffset >= midToHalf;
  if (softFlick || softPull || pastMidToHalf) {
    return next[0];
  }

  return null;
}

/**
 * Pick the snap detent for a release.
 *
 * Up / general:
 * 1. Soft flick (agrees with drag) → one step from start
 * 2. Soft pull > ADVANCE → one step from start
 * 3. Past midpoint to next → that detent
 * 4. Nearest
 *
 * Down from full (see resolveDownFromFull): soft → half, complete → close/bottom.
 */
export function pickSnapDetent<T extends string>(
  detents: ReadonlyArray<Detent<T>>,
  releaseOffset: number,
  velocity: number,
  startOffset?: number,
): T {
  const sorted = [...detents].sort((a, b) => a[1] - b[1]);
  const dragDelta = startOffset != null ? releaseOffset - startOffset : null;
  const fromOffset = startOffset ?? releaseOffset;

  const fromFull = resolveDownFromFull(
    sorted,
    releaseOffset,
    velocity,
    fromOffset,
    dragDelta,
  );
  if (fromFull != null) return fromFull;

  if (Math.abs(velocity) > MAP_DOCK_FLICK_VELOCITY) {
    const flickDown = velocity > 0;
    const hasDirectedDrag =
      dragDelta != null && Math.abs(dragDelta) > MAP_DOCK_DRAG_TAP_SLOP_PX;
    const agreesWithDrag =
      dragDelta == null ||
      (hasDirectedDrag && (flickDown ? dragDelta > 0 : dragDelta < 0));
    if (agreesWithDrag) {
      const result = advanceInDirection(sorted, flickDown, fromOffset);
      if (result) return result;
    }
  }

  if (dragDelta != null && Math.abs(dragDelta) > MAP_DOCK_ADVANCE_DRAG_PX) {
    const result = advanceInDirection(sorted, dragDelta > 0, fromOffset);
    if (result) return result;
  }

  if (dragDelta != null && Math.abs(dragDelta) > MAP_DOCK_DRAG_TAP_SLOP_PX) {
    const movingDown = dragDelta > 0;
    const next = advanceInDirection(sorted, movingDown, fromOffset);
    if (next) {
      const nextOffset = sorted.find(([name]) => name === next)?.[1];
      if (nextOffset != null) {
        const mid = (fromOffset + nextOffset) / 2;
        const pastMid = movingDown ? releaseOffset >= mid : releaseOffset <= mid;
        if (pastMid) return next;
      }
    }
  }

  return nearestDetent(sorted, releaseOffset);
}

/** Card dismiss sits just past half — same travel as a soft pull step. */
export const DOCK_CARD_CLOSE_HYSTERESIS_PX = MAP_DOCK_ADVANCE_DRAG_PX;

/**
 * Card release: full ⇄ half, or dismiss.
 * From full: soft → half, complete flick / pull past half → close.
 */
export function resolveDockCardRelease(
  releaseOffset: number,
  velocity: number,
  halfOffset: number,
  fullOffset: number,
  startOffset?: number,
): 'half' | 'full' | 'close' {
  const closeOffset = halfOffset + DOCK_CARD_CLOSE_HYSTERESIS_PX;
  return pickSnapDetent(
    [
      ['full', fullOffset],
      ['half', halfOffset],
      ['close', closeOffset],
    ],
    releaseOffset,
    velocity,
    startOffset,
  );
}
