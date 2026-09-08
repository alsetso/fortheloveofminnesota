'use client';

import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';

export type AtlasFeaturePopoverState = {
  id: string;
  name: string;
  /** Collection label — Parks, IBI lakes, … */
  type: string;
  description: string | null;
  /** Viewport X (clientX) */
  x: number;
  /** Viewport Y (clientY) */
  y: number;
  /**
   * @deprecated Click opens dock details; pinned cards are ignored.
   */
  pinned?: boolean;
} | null;

/**
 * Floating atlas feature card — name, type, description.
 * Hover preview only; click opens dock details instead of pinning.
 */
export function AtlasFeaturePopover({
  state,
}: {
  state: AtlasFeaturePopoverState;
  onDismiss?: () => void;
}) {
  if (!state || state.pinned) return null;

  return (
    <div
      className={`fixed ${Z_LAYER_CLASS.HOVER} pointer-events-none max-w-[min(280px,78vw)] -translate-x-1/2 -translate-y-[calc(100%+14px)]`}
      style={{ left: state.x, top: state.y }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-2xl px-3.5 py-2.5 shadow-md ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
            {state.type}
          </p>
          <p className="mt-0.5 truncate text-[14px] font-semibold tracking-tight text-foreground">
            {state.name}
          </p>
          {state.description ? (
            <p className="mt-1 text-[12px] font-medium leading-snug text-foreground-muted line-clamp-4">
              {state.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
