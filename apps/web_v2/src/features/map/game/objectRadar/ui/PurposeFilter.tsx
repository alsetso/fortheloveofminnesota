'use client';

/** Object Map purpose lens — All / Collectible / Utility / … */

import {
  OBJECT_RADAR_PURPOSE_FILTERS,
  PURPOSE_COLORS,
  type ObjectRadarPurposeFilter,
} from '@/features/map/game/objectRadar/radarPurpose';
import type { ModelPurpose } from '@/features/map/game/world/modelVerbs';

export function PurposeFilter({
  value,
  onChange,
  available,
  zoneAccent = false,
}: {
  value: ObjectRadarPurposeFilter;
  onChange: (next: ObjectRadarPurposeFilter) => void;
  /** Purposes with at least one nearby (or in FC) — hide empty when provided. */
  available?: ReadonlySet<ObjectRadarPurposeFilter>;
  /** Experience-zone Object Map chrome. */
  zoneAccent?: boolean;
}) {
  const options = OBJECT_RADAR_PURPOSE_FILTERS.filter((opt) => {
    if (opt.id === 'all') return true;
    if (!available) return true;
    return available.has(opt.id);
  });

  return (
    <div
      data-object-radar="purpose-filter"
      className={`pointer-events-auto flex max-w-[min(100vw-7rem,22rem)] gap-1 overflow-x-auto rounded-full p-1 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        zoneAccent
          ? 'border border-violet-400/25 bg-violet-950/65'
          : 'bg-black/65'
      }`}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        const swatch =
          opt.id === 'all'
            ? zoneAccent
              ? '#C4B5FD'
              : '#ffffff'
            : PURPOSE_COLORS[opt.id as ModelPurpose];
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              active
                ? zoneAccent
                  ? 'bg-violet-500 text-white'
                  : 'bg-white text-black'
                : zoneAccent
                  ? 'bg-transparent text-violet-100/65 hover:text-violet-50'
                  : 'bg-transparent text-white/70 hover:text-white'
            }`}
          >
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{
                backgroundColor: active
                  ? zoneAccent
                    ? '#fff'
                    : '#111'
                  : swatch,
              }}
            />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
