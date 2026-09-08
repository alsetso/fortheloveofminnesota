/**
 * Map rail / floating chrome — colors come from `[data-map-surface]` CSS vars.
 * Idle / active / label / error share the same glass tokens as the dock.
 */

import {
  MAP_DOCK_GLASS_FILL_CLASS,
  MAP_DOCK_GLASS_HOVER_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

const BLUR =
  '[backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)]';

/** Idle / default rail pill — black on streets, white on dark (via --foreground). */
export const RAIL_IDLE_CLASS = `border-map-glass ${MAP_DOCK_GLASS_FILL_CLASS} text-foreground ${MAP_DOCK_GLASS_HOVER_CLASS}`;

/** Active (Find Me / layers / dock-owned) — blue on streets, moss outdoors, white on satellite. */
export const RAIL_ACTIVE_CLASS = `border-map-rail-active bg-map-rail-active text-map-rail-active ring-2 ring-map-rail-active ${BLUR}`;

/** Time / label / back pill (foreground text). */
export const RAIL_LABEL_CLASS = `border-map-glass ${MAP_DOCK_GLASS_FILL_CLASS} text-foreground ${MAP_DOCK_GLASS_HOVER_CLASS}`;

/** Find Me error tone. */
export const RAIL_ERROR_CLASS = `border-map-danger bg-map-danger text-map-danger ${BLUR} hover:bg-map-danger-hover`;

export function railIdleClass(): string {
  return RAIL_IDLE_CLASS;
}

export function railActiveClass(): string {
  return RAIL_ACTIVE_CLASS;
}

export function railLabelClass(): string {
  return RAIL_LABEL_CLASS;
}

export function railErrorClass(): string {
  return RAIL_ERROR_CLASS;
}

