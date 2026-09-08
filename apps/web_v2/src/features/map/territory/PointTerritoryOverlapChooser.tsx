'use client';

import DialogBackdrop from '@/components/sheets/DialogBackdrop';
import type { DockEntity } from '@/features/map/dockCore/core/dockPanes';
import { IconLock } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

export type PointTerritoryChooserEntry = {
  entity: DockEntity;
  /** Overlay fill color shared with the map layer. */
  color?: string;
  /** Passport-locked — show lock affordance. */
  locked?: boolean;
};

export type PointTerritoryChooserState = {
  entries: PointTerritoryChooserEntry[];
} | null;

/**
 * Static, centered picker for overlapping point-territory overlays.
 * Large boundaries (e.g. a congressional district) blanket the smaller ones,
 * so a map tap on stacked polygons opens this chooser — one clickable row per
 * territory, color-matched to its boundary on the map.
 */
export function PointTerritoryOverlapChooser({
  state,
  onPick,
  onClose,
}: {
  state: PointTerritoryChooserState;
  onPick: (entity: DockEntity) => void;
  onClose: () => void;
}) {
  if (!state || state.entries.length === 0) return null;

  return (
    <DialogBackdrop
      onClose={onClose}
      layer="CHOOSER"
      dimClassName="bg-black/25"
      frameIsDialog
      ariaLabel="Choose an area"
    >
      <div
        className={`mx-auto w-[min(320px,86vw)] rounded-2xl p-2 shadow-xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          Areas here
        </p>
        <div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
          {state.entries.map(({ entity, color, locked }) => (
            <button
              key={`${entity.kind}:${entity.id}`}
              type="button"
              onClick={() => onPick(entity)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-map-glass-hover active:bg-map-ink-subtle"
            >
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: color ?? '#1a4d42' }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-foreground">
                  {entity.title}
                </span>
                <span className="block truncate text-[11px] text-foreground-muted">
                  {locked
                    ? 'Travel to unlock'
                    : (entity.subtitle ?? entity.kindLabel ?? entity.kind)}
                </span>
              </span>
              {locked ? (
                <IconLock className="h-4 w-4 shrink-0 text-foreground-muted" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </DialogBackdrop>
  );
}
