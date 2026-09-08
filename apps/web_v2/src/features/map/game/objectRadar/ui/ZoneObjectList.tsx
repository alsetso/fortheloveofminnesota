'use client';

/**
 * Zone Object Legend — compact bottom bar shown in ObjectMap when Explore Zone
 * is active. A single row of colored-dot + purpose-label + count pills, one per
 * object type present in the current zone. Matches the dot-legend reference design:
 *
 *   ● Collectible 3   ● Utility 2   ● Progress 1          6 in State Fair
 *
 * When non-collectible "other" objects exist in the zone, an accordion section
 * expands below the legend to list them by name and interaction type.
 */

import { useMemo, useState } from 'react';
import {
  PURPOSE_COLORS,
  purposeLegendOrder,
} from '@/features/map/game/objectRadar/radarPurpose';
import { ObjectMapColorKey } from '@/features/map/game/objectRadar/ui/ObjectLegend';
import { PURPOSE_BRANCH } from '@/features/map/game/world/modelVerbs';
import type {
  ObjectRadarFeatureCollection,
  ObjectRadarOrigin,
} from '@/features/map/game/objectRadar/types';
import { safePadBottom } from '@/lib/despia/safeArea';
import type { ModelPurpose } from '@/features/map/game/world/modelVerbs';

type LegendRow = {
  purpose: ModelPurpose;
  label: string;
  color: string;
  count: number;
};

/** Human-readable label for each interaction verb. */
const VERB_LABEL: Record<string, string> = {
  collect: 'Discovery',
  check_in: 'Check-in',
  info: 'Info',
  route: 'Route',
  unlock: 'Unlock',
  redeem: 'Redeem',
  challenge: 'Challenge',
  see: 'Scenery',
};

function buildLegendRows(objects: ObjectRadarFeatureCollection): LegendRow[] {
  const counts: Partial<Record<ModelPurpose, number>> = {};
  for (const f of objects.features) {
    const p = f.properties?.purpose as ModelPurpose | undefined;
    if (p) counts[p] = (counts[p] ?? 0) + 1;
  }
  return purposeLegendOrder()
    .filter((id) => (counts[id] ?? 0) > 0)
    .map((id) => ({
      purpose: id,
      label: PURPOSE_BRANCH[id].label,
      color: PURPOSE_COLORS[id],
      count: counts[id]!,
    }));
}

type OtherItem = {
  id: string;
  label: string;
  verb: string;
};

function buildOtherItems(objects: ObjectRadarFeatureCollection): OtherItem[] {
  return objects.features
    .map((f) => ({
      id: String(f.properties?.id ?? f.id ?? ''),
      label: f.properties?.label ?? f.properties?.slug ?? '—',
      verb: f.properties?.interaction ?? 'see',
    }))
    .filter((item) => item.id)
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ── Verb icon (emoji-free, single-char visual key) ───────────────────────────
const VERB_BADGE_COLORS: Record<string, string> = {
  check_in: '#34C759',
  info: '#5BA3FF',
  route: '#FF9F0A',
  collect: '#AF52DE',  // discovery (collect+stay)
  unlock: '#FFD60A',
  redeem: '#FFD60A',
  challenge: '#FF6B6B',
  see: '#9ca3af',
};

export function ZoneObjectList({
  objects,
  otherObjects,
  origin: _origin,
  zoneName,
  bottomClearance,
}: {
  objects: ObjectRadarFeatureCollection;
  otherObjects?: ObjectRadarFeatureCollection;
  origin: ObjectRadarOrigin;
  zoneName: string;
  bottomClearance?: string;
}) {
  const rows = useMemo(() => buildLegendRows(objects), [objects]);
  const total = objects.features.length;
  const otherItems = useMemo(
    () => (otherObjects ? buildOtherItems(otherObjects) : []),
    [otherObjects],
  );
  const [accordionOpen, setAccordionOpen] = useState(false);

  return (
    <div
      data-object-radar="zone-object-legend"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3"
      style={{
        paddingBottom: bottomClearance
          ? `calc(${bottomClearance} + 0.5rem)`
          : safePadBottom('0.85rem'),
      }}
    >
      <div className="mx-auto max-w-md overflow-hidden rounded-[18px] border border-violet-400/30 bg-black/82 backdrop-blur-md">
        {/* Header + collectible legend */}
        <div className="px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <ObjectMapColorKey />
            {total > 0 && (
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-300/65">
                {total} in {zoneName}
              </span>
            )}
          </div>
          {rows.length > 0 ? (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-white/[0.08] pt-2">
              {rows.map((row) => (
                <div key={row.purpose} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/30"
                    style={{ backgroundColor: row.color }}
                    aria-hidden
                  />
                  <span className="text-[12px] font-medium text-white/90">
                    {row.label}
                  </span>
                  <span className="text-[12px] tabular-nums text-white/45">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-white/35">No objects in zone</p>
          )}
        </div>

        {/* "More objects" accordion — only when non-collectibles exist */}
        {otherItems.length > 0 && (
          <div className="pointer-events-auto border-t border-white/[0.08]">
            {/* Accordion trigger */}
            <button
              type="button"
              onClick={() => setAccordionOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3.5 py-2 text-left"
              aria-expanded={accordionOpen}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: '#9ca3af' }}
                  aria-hidden
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
                  More in this zone
                </span>
                <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] tabular-nums text-white/40">
                  {otherItems.length}
                </span>
              </div>
              <svg
                className="shrink-0 text-white/30 transition-transform duration-200"
                style={{ transform: accordionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Accordion body */}
            {accordionOpen && (
              <ul className="max-h-44 overflow-y-auto px-3.5 pb-3">
                {otherItems.map((item) => {
                  const verbLabel = VERB_LABEL[item.verb] ?? item.verb;
                  const badgeColor = VERB_BADGE_COLORS[item.verb] ?? '#9ca3af';
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-2.5 border-t border-white/[0.05] py-1.5 first:border-t-0"
                    >
                      {/* Grey dot */}
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: '#9ca3af' }}
                        aria-hidden
                      />
                      {/* Object name */}
                      <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">
                        {item.label}
                      </span>
                      {/* Verb badge */}
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]"
                        style={{
                          color: badgeColor,
                          backgroundColor: `${badgeColor}22`,
                        }}
                      >
                        {verbLabel}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact stacked legend — used inside ObjectMiniMap below the radar dial.
 * Shows the top purpose types with a dot + short label + count, at a size
 * that fits within the 84 px minimap column.
 */
export function ZoneMiniLegend({
  objects,
}: {
  objects: ObjectRadarFeatureCollection;
}) {
  const rows = useMemo(() => buildLegendRows(objects).slice(0, 3), [objects]);

  if (rows.length === 0) return null;

  return (
    <div
      data-object-radar="zone-mini-legend"
      className="pointer-events-none flex flex-col items-start gap-0.5 px-1"
      aria-hidden
    >
      {rows.map((row) => (
        <div key={row.purpose} className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          <span className="text-[9px] font-medium leading-none text-white/70">
            {row.label}
          </span>
          <span className="text-[9px] tabular-nums leading-none text-white/40">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
