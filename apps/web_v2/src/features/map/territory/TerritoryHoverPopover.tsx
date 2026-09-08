'use client';

import { IconLock } from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type TerritoryHoverPopoverState = {
  name: string;
  subtitle?: string | null;
  /** Passport-locked — show lock + Travel to unlock. */
  locked?: boolean;
  /** Viewport X (clientX) */
  x: number;
  /** Viewport Y (clientY) */
  y: number;
} | null;

/**
 * Floating name label for the territory currently under the cursor.
 * Works for any territory layer (county, CTU, school district, …).
 */
export function TerritoryHoverPopover({ hover }: { hover: TerritoryHoverPopoverState }) {
  if (!hover) return null;

  return (
    <div
      className={`pointer-events-none fixed ${Z_LAYER_CLASS.HOVER} max-w-[min(260px,70vw)] -translate-x-1/2 -translate-y-[calc(100%+12px)]`}
      style={{ left: hover.x, top: hover.y }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-xl px-3 py-1.5 shadow-md ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {hover.locked ? (
            <IconLock className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
          ) : null}
          <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {hover.name}
          </p>
        </div>
        {hover.locked ? (
          <p className="mt-0.5 truncate text-[11px] font-medium leading-snug text-foreground-muted">
            Travel to unlock
          </p>
        ) : hover.subtitle ? (
          <p className="truncate text-[11px] font-medium leading-snug text-foreground-muted">
            {hover.subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
