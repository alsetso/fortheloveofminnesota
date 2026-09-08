'use client';

/** Object Map — Still out / Collected mode toggle. */

import type { ObjectRadarMode } from '@/features/map/game/objectRadar/types';

const OPTIONS: readonly { id: ObjectRadarMode; label: string }[] = [
  { id: 'still-out', label: 'Still out' },
  { id: 'collected', label: 'Collected' },
] as const;

export function CollectToggle({
  mode,
  onChange,
  zoneAccent = false,
}: {
  mode: ObjectRadarMode;
  onChange: (mode: ObjectRadarMode) => void;
  /** Experience-zone Object Map chrome. */
  zoneAccent?: boolean;
}) {
  return (
    <div
      data-object-radar="collect-toggle"
      className={`pointer-events-auto inline-flex rounded-full p-0.5 backdrop-blur-md ${
        zoneAccent
          ? 'border border-violet-400/35 bg-violet-950/70 shadow-[0_0_16px_rgba(124,58,237,0.22)]'
          : 'border border-white/15 bg-black/70'
      }`}
      role="group"
      aria-label="Show collected or still-out objects"
    >
      {OPTIONS.map((opt) => {
        const on = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={on}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              on
                ? zoneAccent
                  ? 'bg-violet-500 text-white shadow-sm'
                  : 'bg-white text-black shadow-sm'
                : zoneAccent
                  ? 'text-violet-100/70 active:bg-violet-500/20'
                  : 'text-white/70 active:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
