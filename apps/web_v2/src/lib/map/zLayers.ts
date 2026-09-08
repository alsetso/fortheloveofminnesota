/**
 * Ordered stacking layers for the map shell and overlays.
 *
 * One source of truth — consumers import Tailwind class tokens or the numeric
 * values; never invent inline z-[N] literals for these surfaces.
 *
 * Order (bottom → top):
 *   map canvas → map chrome → dock → callouts → hover → chooser →
 *   setup → full-screen sheets → app overlays (above tab bar) → critical dialogs
 */

export const Z_LAYER = {
  MAP_CHROME: 40,
  DOCK: 50,
  CALLOUT: 55,
  HOVER: 60,
  CHOOSER: 70,
  SETUP: 80,
  SHEET: 90,
  /** Above the Own tab bar (also SHEET) — account card, etc. */
  APP_OVERLAY: 95,
  CRITICAL_DIALOG: 250,
} as const;

export type ZLayerName = keyof typeof Z_LAYER;

/** Tailwind z-* / arbitrary-value classes matching Z_LAYER. */
export const Z_LAYER_CLASS = {
  MAP_CHROME: 'z-40',
  DOCK: 'z-50',
  CALLOUT: 'z-[55]',
  HOVER: 'z-[60]',
  CHOOSER: 'z-[70]',
  SETUP: 'z-[80]',
  SHEET: 'z-[90]',
  APP_OVERLAY: 'z-[95]',
  CRITICAL_DIALOG: 'z-[250]',
} as const;
