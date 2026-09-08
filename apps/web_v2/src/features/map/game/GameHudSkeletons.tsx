'use client';

/**
 * Skeleton primitives for the game HUD.
 *
 * Every visible text / numeric element in the free-chrome has a matching
 * skeleton so there is never a blank flash while data is in flight.
 * All skeletons use `animate-pulse` (Tailwind) — the project-wide shimmer
 * convention established by DockSkeletonRows / StandingMetricSkeleton.
 *
 * Usage:
 *   import { GameStatsHudSkeleton, SkeletonPulse } from './GameHudSkeletons';
 */

import type { CSSProperties } from 'react';

// ─── Base primitive ───────────────────────────────────────────────────────────

type SkeletonPulseProps = {
  /** Width as a Tailwind class or inline style */
  width?: string;
  /** Height as a Tailwind class or inline style */
  height?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Single pulsing rectangle that matches the visual weight of a text element.
 * Rounded to pill shape by default.
 */
export function SkeletonPulse({
  width = 'w-10',
  height = 'h-3',
  className = '',
  style,
}: SkeletonPulseProps) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-pulse rounded-full bg-white/20 ${width} ${height} ${className}`}
      style={style}
    />
  );
}

// ─── Composite skeletons ──────────────────────────────────────────────────────

/**
 * Skeleton for the full GameStatsHud:
 *   [handle pill]  [Lv ##]
 *   [────── XP bar ──────]
 *   [##]📍  [##]🪙  [##]❤️
 *
 * Sizes mirror the real element exactly so the layout doesn't shift when data
 * arrives. Controlled by `showStats` to match the demo-gating logic.
 */
export function GameStatsHudSkeleton({ showStats = false }: { showStats?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-end gap-1 text-right">
      {/* Row 1 — handle + level */}
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-baseline gap-1.5">
          {/* @handle — text-[11px] tracking-tight */}
          <SkeletonPulse width="w-14" height="h-2.5" />
          {/* Lv ## — text-[13px] bold */}
          <SkeletonPulse width="w-8" height="h-3" />
        </div>
        {/* XP progress bar — h-1, full width of parent */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
          <span
            aria-hidden
            className="block h-full w-2/3 animate-pulse rounded-full bg-white/30"
          />
        </div>
      </div>

      {/* Row 2 — area · coin · heart counts */}
      {showStats && (
        <div className="flex items-center gap-2.5">
          {/* Areas count + pin icon placeholder */}
          <span className="flex items-center gap-1">
            <SkeletonPulse width="w-5" height="h-3" />
            <span className="h-3.5 w-3.5 animate-pulse rounded-sm bg-white/20" aria-hidden />
          </span>
          {/* Coins count + coin icon placeholder */}
          <span className="flex items-center gap-1">
            <SkeletonPulse width="w-6" height="h-3" />
            <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" aria-hidden />
          </span>
          {/* Hearts count + heart icon placeholder */}
          <span className="flex items-center gap-1">
            <SkeletonPulse width="w-4" height="h-3" />
            <span className="h-3.5 w-3.5 animate-pulse rounded-sm bg-white/20" aria-hidden />
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton for a single stat badge (areas / coins / hearts).
 * Used when the stat row is visible but an individual count hasn't loaded.
 */
export function StatCountSkeleton() {
  return <SkeletonPulse width="w-5" height="h-3" />;
}

/**
 * Skeleton for the XP progress bar only (when level number is known but
 * progress hasn't resolved yet).
 */
export function XpBarSkeleton() {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/20" aria-hidden>
      <span className="block h-full w-1/2 animate-pulse rounded-full bg-white/30" />
    </div>
  );
}
