'use client';

/**
 * Object Map legend — color key (red / gold dots + purple zones) plus
 * nearby counts by purpose (still-out) or classic collectible slugs (collected).
 */

import type { ComponentType } from 'react';
import {
  IconChest,
  IconCoin,
  IconHeart,
} from '@/features/map/dockCore/core/icons';
import {
  CLASSIC_COLLECTIBLE_COLORS,
  OBJECT_MAP_ZONE_FILL,
  OBJECT_MAP_ZONE_STROKE,
  PURPOSE_COLORS,
  purposeLegendOrder,
  type ObjectRadarPurposeCounts,
} from '@/features/map/game/objectRadar/radarPurpose';
import { OBJECT_RADAR_LEGEND } from '@/features/map/game/objectRadar/types';
import type { ObjectRadarCounts, ObjectRadarSlug } from '@/features/map/game/objectRadar/types';
import { PURPOSE_BRANCH, type ModelPurpose } from '@/features/map/game/world/modelVerbs';
import { safePadBottom } from '@/lib/despia/safeArea';

const ICONS: Record<
  ObjectRadarSlug,
  ComponentType<{ className?: string; solid?: boolean }>
> = {
  'heart-quaternius': IconHeart,
  'coin-quaternius': IconCoin,
  'treasure-chest-safayan': IconChest,
};

function KeyDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5" role="listitem">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/40"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-[12px] font-medium text-white/90">{label}</span>
    </div>
  );
}

/** Always-on color key: red collectibles, gold credits, purple experience zones. */
export function ObjectMapColorKey() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5"
      role="list"
      aria-label="Map color key"
    >
      <KeyDot
        color={CLASSIC_COLLECTIBLE_COLORS['heart-quaternius']}
        label="Collectible"
      />
      <KeyDot
        color={CLASSIC_COLLECTIBLE_COLORS['coin-quaternius']}
        label="Credit"
      />
      <div className="flex items-center gap-1.5" role="listitem">
        <span
          className="h-2.5 w-3.5 shrink-0 rounded-[3px]"
          style={{
            backgroundColor: `${OBJECT_MAP_ZONE_FILL}66`,
            boxShadow: `inset 0 0 0 1.5px ${OBJECT_MAP_ZONE_STROKE}`,
          }}
          aria-hidden
        />
        <span className="text-[12px] font-medium text-white/90">Zone</span>
      </div>
    </div>
  );
}

export function ObjectLegend({
  purposeCounts,
  slugCounts,
  mode,
  modeLabel,
  bottomClearance,
}: {
  purposeCounts: ObjectRadarPurposeCounts;
  slugCounts: ObjectRadarCounts;
  mode: 'still-out' | 'collected';
  modeLabel: string;
  /** Extra bottom inset so the card clears floating chrome (Minimaps nav). */
  bottomClearance?: string;
}) {
  const purposeRows = purposeLegendOrder()
    .map((id) => ({
      id,
      label: PURPOSE_BRANCH[id].label,
      color: PURPOSE_COLORS[id],
      count: purposeCounts[id] ?? 0,
    }))
    .filter((row) => row.count > 0);

  return (
    <div
      data-object-radar="legend"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3"
      style={{
        paddingBottom: bottomClearance
          ? `calc(${bottomClearance} + 0.5rem)`
          : safePadBottom('0.85rem'),
      }}
    >
      <div className="mx-auto max-w-md rounded-[18px] border border-white/10 bg-black/78 px-3 py-2.5 backdrop-blur-md">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {modeLabel}
        </p>

        <div className="mb-2.5">
          <ObjectMapColorKey />
        </div>

        {mode === 'collected' ? (
          <div className="flex items-stretch gap-2">
            {OBJECT_RADAR_LEGEND.map((item) => {
              const Icon = ICONS[item.slug];
              const count = slugCounts[item.slug] ?? 0;
              return (
                <div
                  key={item.slug}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `${item.color}28`,
                      color: item.color,
                    }}
                  >
                    <Icon className="h-4 w-4" solid />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-white">
                      {item.shortLabel}
                    </span>
                    <span className="block text-[11px] tabular-nums text-white/50">
                      {count.toLocaleString()} nearby
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : purposeRows.length === 0 ? (
          <p className="text-[12px] text-white/45">Nothing interactive nearby</p>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {purposeRows.map((row) => (
              <div key={row.id} className="flex min-w-[5.5rem] items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-semibold text-white">
                    {row.label}
                  </span>
                  <span className="block text-[11px] tabular-nums text-white/50">
                    {row.count.toLocaleString()} nearby
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { ModelPurpose };
