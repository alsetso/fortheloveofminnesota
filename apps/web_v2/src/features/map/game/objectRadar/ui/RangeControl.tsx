'use client';

/**
 * Object Map — edit Range (meters from the player).
 */

import {
  OBJECT_RADAR_RANGE_MAX_M,
  OBJECT_RADAR_RANGE_MIN_M,
  OBJECT_RADAR_RANGE_STEP_M,
} from '@/features/map/game/objectRadar/constants';
import { clampRangeM, formatRangeM } from '@/features/map/game/objectRadar/range';

export function RangeControl({
  rangeM,
  onChange,
  zoneAccent = false,
}: {
  rangeM: number;
  onChange: (meters: number) => void;
  /** Experience-zone Object Map chrome. */
  zoneAccent?: boolean;
}) {
  const atMin = rangeM <= OBJECT_RADAR_RANGE_MIN_M;
  const atMax = rangeM >= OBJECT_RADAR_RANGE_MAX_M;

  return (
    <div
      data-object-radar="range-control"
      className={`pointer-events-auto inline-flex items-center gap-1 rounded-full p-0.5 backdrop-blur-md ${
        zoneAccent
          ? 'border border-violet-400/35 bg-violet-950/70 shadow-[0_0_16px_rgba(124,58,237,0.22)]'
          : 'border border-white/15 bg-black/70'
      }`}
      role="group"
      aria-label="Object range"
    >
      <button
        type="button"
        disabled={atMin}
        onClick={() => onChange(clampRangeM(rangeM - OBJECT_RADAR_RANGE_STEP_M))}
        aria-label="Narrow range"
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-semibold transition active:scale-90 disabled:opacity-35 ${
          zoneAccent
            ? 'text-violet-100 active:bg-violet-500/25'
            : 'text-white active:bg-white/10'
        }`}
      >
        −
      </button>
      <span
        className={`min-w-[3.5rem] text-center text-[12px] font-semibold tabular-nums ${
          zoneAccent ? 'text-violet-50' : 'text-white/90'
        }`}
      >
        {formatRangeM(rangeM)}
      </span>
      <button
        type="button"
        disabled={atMax}
        onClick={() => onChange(clampRangeM(rangeM + OBJECT_RADAR_RANGE_STEP_M))}
        aria-label="Widen range"
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-semibold transition active:scale-90 disabled:opacity-35 ${
          zoneAccent
            ? 'text-violet-100 active:bg-violet-500/25'
            : 'text-white active:bg-white/10'
        }`}
      >
        +
      </button>
    </div>
  );
}
