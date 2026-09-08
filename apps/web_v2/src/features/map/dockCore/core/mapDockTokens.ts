/**
 * Shared layout/timing tokens for the `/game` explore dock — cloned from ios v1
 * (`apps/ios/.../mapDockTokens.ts`). Tune heights/insets/timing here.
 *
 * Glass / ink colors are CSS vars on `[data-map-surface]` (see globals.css) so
 * streets (light), outdoors (neutral), and satellite (dark) flip without per-pane dual classes.
 *
 * Four snap heights:
 * - collapsed — pill peek; same float pad as half
 * - quarter — browse peek / content-fit sheets
 * - half — browse / detail; float pad around panel
 * - full — ~92% height, flush L/R/bottom; inner body scroll enabled
 */

import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

/** Peek height when collapsed — chrome capsule (top pad + search + bottom pad). */
export const MAP_DOCK_PILL_PEEK_PX = 72;
/**
 * Chrome vertical rhythm — pad above search (handle band) equals pad below search.
 * Handle is absolutely centered in the top band.
 */
export const MAP_DOCK_HEADER_PAD_TOP_PX = 12;
/** Handle band height — matches {@link MAP_DOCK_HEADER_PAD_TOP_PX}. */
export const MAP_DOCK_HANDLE_SLOT_PX = MAP_DOCK_HEADER_PAD_TOP_PX;
/** Space below the search/title row — matches top pad. */
export const MAP_DOCK_HEADER_PAD_BOTTOM_PX = MAP_DOCK_HEADER_PAD_TOP_PX;
/**
 * Fallback quarter height when entry content hasn’t measured yet.
 * Prefer measured header + {@link MapDockProvider} `quarterContentPx`.
 */
export const MAP_DOCK_QUARTER_HEIGHT_VH = 18;
/** Gap kept between content-fit quarter and half so the detents stay distinct. */
export const MAP_DOCK_QUARTER_HALF_GAP_PX = 24;
/** Mid-height browse state — fraction of the map shell. */
export const MAP_DOCK_HALF_HEIGHT_VH = 46;
/** Full takeover — fraction of the map shell (~8% shorter than edge-to-edge). */
export const MAP_DOCK_FULL_HEIGHT_VH = 92;

/**
 * Float padding around the dock panel + rails (px).
 * collapsed → wider correlating inset (~5% width / side); half → compact;
 * half → full shrinks to 0 (flush L/R/bottom).
 *
 * Paired with Despia `--screen-radius`: sheet radius = screenRadius − pad
 * for concentric corners against the device bezel.
 * @see https://setup.despia.com/native-features/screen-radius
 */
export const MAP_DOCK_DOCK_PAD_HALF_PX = 10;
export const MAP_DOCK_DOCK_PAD_FULL_PX = 0;
/** Per-side pad when closed — fraction of dock column width (~10% total inset). */
export const MAP_DOCK_DOCK_PAD_COLLAPSED_RATIO = 0.05;
export const MAP_DOCK_DOCK_PAD_COLLAPSED_MIN_PX = 18;
export const MAP_DOCK_DOCK_PAD_COLLAPSED_MAX_PX = 36;

/** Closed-state float pad from layout width (rails + pill share this inset). */
export function mapDockCollapsedPadPx(layoutWidthPx: number): number {
  const raw = layoutWidthPx * MAP_DOCK_DOCK_PAD_COLLAPSED_RATIO;
  return Math.round(
    Math.min(
      MAP_DOCK_DOCK_PAD_COLLAPSED_MAX_PX,
      Math.max(MAP_DOCK_DOCK_PAD_COLLAPSED_MIN_PX, raw),
    ),
  );
}
/**
 * Fallback float radius when `--screen-radius` is unavailable (should be rare;
 * prefer {@link mapDockFloatingRadiusPx}).
 */
export const MAP_DOCK_SHEET_RADIUS_PX = 34;
/** Extra roundness on the closed pill vs half (clamped to half-height). */
export const MAP_DOCK_SHEET_RADIUS_COLLAPSED_BOOST_PX = 12;
/** Top corners when fully flush (full snap). */
export const MAP_DOCK_SHEET_RADIUS_FULL_TOP_PX = 20;

/** Re-exports from the shared stacking scale — prefer importing from zLayers. */
export { Z_LAYER_CLASS as MAP_DOCK_Z } from '@/lib/map/zLayers';
export const MAP_DOCK_DOCK_Z = Z_LAYER_CLASS.DOCK;
export const MAP_DOCK_FLOATING_CONTROLS_Z = Z_LAYER_CLASS.MAP_CHROME;

export const MAP_DOCK_TRANSITION_MS = 200;
export const MAP_DOCK_TRANSITION_CLASS =
  'transition-[border-radius,box-shadow,background-color,border-color,color] duration-200 ease-out';

/**
 * Sheet settle — height/padding only (no transform, so backdrop-filter samples the map).
 * Ease-out without overshoot so half→closed snaps down cleanly.
 */
export const MAP_DOCK_SHEET_SPRING_CLASS =
  'transition-[height,padding,border-radius] duration-[380ms] ease-[cubic-bezier(0.2,0,0,1)]';

/**
 * Soft flick (px/ms) — from full, a soft downward flick lands on **half**.
 * Opening flicks / one-step advances also use this threshold.
 */
export const MAP_DOCK_FLICK_VELOCITY = 0.18;
/**
 * Complete flick (px/ms) — from full, a hard downward flick skips half and
 * goes to **close** (card dismiss / dock collapsed). ~2.5× soft flick.
 */
export const MAP_DOCK_STRONG_FLICK_VELOCITY = 0.45;
export const MAP_DOCK_DRAG_TAP_SLOP_PX = 6;
/**
 * Soft pull travel (px) from start to commit the **next** detent (e.g. full→half).
 */
export const MAP_DOCK_ADVANCE_DRAG_PX = 56;
/**
 * Click-vs-drag arming window on interactive chrome (search, avatar, buttons, cards).
 * Within this window, only a clear swipe ({@link MAP_DOCK_DRAG_FORCE_SLOP_PX}) steals
 * the gesture; after it, any movement past {@link MAP_DOCK_DRAG_TAP_SLOP_PX} claims resize.
 * A tap with no movement still fires the control's click.
 */
export const MAP_DOCK_DRAG_CLAIM_MS = 120;
/** Immediate drag claim distance on interactive chrome (before claim delay elapses). */
export const MAP_DOCK_DRAG_FORCE_SLOP_PX = 18;
export const MAP_DOCK_WHEEL_SETTLE_MS = 90;
export const MAP_DOCK_WHEEL_OFFSET_SCALE = 1;

export function mapDockRubberBand(excess: number, dimension: number): number {
  if (excess <= 0 || dimension <= 0) return 0;
  const c = 0.55;
  return (1 - 1 / ((excess * c) / dimension + 1)) * dimension;
}

/** Safe-area helpers for content (not panel float — panel pad interpolates in the shell). */
export const MAP_DOCK_BOTTOM_INSET =
  'max(0.75rem, var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)))';
export const MAP_DOCK_LEFT_INSET =
  'max(0.75rem, var(--safe-area-left, env(safe-area-inset-left, 0px)))';
export const MAP_DOCK_RIGHT_INSET =
  'max(0.75rem, var(--safe-area-right, env(safe-area-inset-right, 0px)))';
/** Full snap top inset — prior 12px + 2.25rem (36px) so the sheet clears status chrome. */
export const MAP_DOCK_FULL_TOP_GAP_PX = 48;

export const MAP_DOCK_COLUMN_GUTTER_CLASS = 'px-3 sm:px-4';
export const MAP_DOCK_CIRCLE_SIZE_CLASS = 'h-11 w-11';

const MAP_GLASS_BLUR =
  '[backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]';

/** Dock sheet underlay only — more transparent than elevated glass. */
export const MAP_DOCK_SHEET_FILL_CLASS = `bg-map-sheet ${MAP_GLASS_BLUR}`;

/**
 * Elevated frosted glass — rows, rails, pill slots. Color from `--map-glass-fill`.
 * Must not sit under a `transform`ed ancestor or the blur samples an empty layer.
 */
export const MAP_DOCK_GLASS_FILL_CLASS = `bg-map-glass ${MAP_GLASS_BLUR}`;
export const MAP_DOCK_GLASS_BORDER_CLASS = 'border border-map-glass';
export const MAP_DOCK_GLASS_CHIP_CLASS = 'bg-map-glass-chip backdrop-blur-sm';
export const MAP_DOCK_GLASS_HOVER_CLASS = 'hover:bg-map-glass-hover active:bg-map-glass-hover';
/**
 * Search field shell — blur lives on a wrapper (not the `<input>`; form controls
 * often ignore `backdrop-filter`). Same 20px frost as dock / rails so the map
 * shows through when the sheet is collapsed.
 */
export const MAP_DOCK_SEARCH_PILL_SHELL_CLASS = `bg-map-search-fill ${MAP_GLASS_BLUR} transition-[background-color] duration-150 focus-within:bg-map-search-focus`;
/** @deprecated Prefer {@link MAP_DOCK_SEARCH_PILL_SHELL_CLASS} on a wrapper. */
export const MAP_DOCK_SEARCH_INPUT_FILL_CLASS = MAP_DOCK_SEARCH_PILL_SHELL_CLASS;
export const MAP_DOCK_INK_SUBTLE_CLASS = 'bg-map-ink-subtle';
export const MAP_DOCK_INK_FAINT_CLASS = 'bg-map-ink-faint';
export const MAP_DOCK_HANDLE_CLASS = 'bg-map-handle group-hover:bg-map-handle-hover';

export function mapDockVhPx(vh: number, containerPx: number): number {
  const winH = typeof window !== 'undefined' ? window.innerHeight : containerPx;
  return Math.min(containerPx, winH * (vh / 100));
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Float padding (px) for a live sheet height — continuous with drag/wheel open progress.
 * collapsed → correlating inset; collapsed → half: lerp to half pad; half → full: → 0.
 */
export function mapDockPadPx(
  visiblePx: number,
  collapsedPx: number,
  halfPx: number,
  fullPx: number,
  layoutWidthPx: number,
): number {
  const collapsedPad = mapDockCollapsedPadPx(layoutWidthPx);
  const halfPad = MAP_DOCK_DOCK_PAD_HALF_PX;

  if (visiblePx <= collapsedPx + 0.5) {
    return collapsedPad;
  }

  if (visiblePx < halfPx) {
    const t = clamp01((visiblePx - collapsedPx) / Math.max(1, halfPx - collapsedPx));
    return lerp(collapsedPad, halfPad, t);
  }

  if (fullPx <= halfPx + 1) return halfPad;
  const t = clamp01((visiblePx - halfPx) / Math.max(1, fullPx - halfPx));
  return lerp(halfPad, MAP_DOCK_DOCK_PAD_FULL_PX, t);
}

/**
 * Concentric sheet radius for a given float pad: `screenRadius − pad`.
 * Matches Despia screen-radius guidance so the dock curves with the bezel.
 */
export function mapDockFloatingRadiusPx(screenRadiusPx: number, padPx: number): number {
  const pad = Math.max(0, padPx);
  if (screenRadiusPx > 1) {
    return Math.max(0, screenRadiusPx - pad);
  }
  return Math.max(MAP_DOCK_SHEET_RADIUS_PX, pad * 3.2);
}

/**
 * Sheet corner radii from live height + float pad + device screen radius.
 * collapsed → rounder pill; half → concentric with bezel; full → top only.
 */
export function mapDockSheetCornerRadiiPx(
  visiblePx: number,
  collapsedPx: number,
  halfPx: number,
  dockPadPx: number,
  screenRadiusPx: number,
): { top: number; bottom: number } {
  const halfPad = MAP_DOCK_DOCK_PAD_HALF_PX;
  const concentricHalf = mapDockFloatingRadiusPx(screenRadiusPx, halfPad);
  const collapsedRadius = Math.min(
    Math.max(0, collapsedPx / 2),
    concentricHalf + MAP_DOCK_SHEET_RADIUS_COLLAPSED_BOOST_PX,
  );

  let floatingRadius: number;
  if (visiblePx <= collapsedPx) {
    floatingRadius = collapsedRadius;
  } else if (visiblePx >= halfPx) {
    // Live concentric as pad shrinks half → full.
    floatingRadius =
      dockPadPx > 0.5
        ? mapDockFloatingRadiusPx(screenRadiusPx, dockPadPx)
        : MAP_DOCK_SHEET_RADIUS_FULL_TOP_PX;
  } else {
    const t = clamp01((visiblePx - collapsedPx) / Math.max(1, halfPx - collapsedPx));
    floatingRadius = lerp(collapsedRadius, concentricHalf, t);
  }
  // Never exceed a half-capsule for the live height.
  floatingRadius = Math.min(floatingRadius, Math.max(0, visiblePx / 2));

  const padT =
    dockPadPx <= 0 || halfPad <= 0 ? 0 : clamp01(dockPadPx / halfPad);

  return {
    top:
      padT < 1
        ? lerp(MAP_DOCK_SHEET_RADIUS_FULL_TOP_PX, floatingRadius, padT)
        : floatingRadius,
    bottom: floatingRadius * padT,
  };
}
