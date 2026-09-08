/**
 * Despia native haptics — one service for all tactile feedback.
 * @see https://setup.despia.com/native-features/haptic-feedback
 *
 * Call from user event handlers only (not useEffect / derived state).
 */
import { despiaCall, isDespia } from '@/lib/despia/despia';

export type DespiaHaptic =
  | 'light'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error';

const SCHEMES: Record<DespiaHaptic, string> = {
  light: 'lighthaptic://',
  heavy: 'heavyhaptic://',
  success: 'successhaptic://',
  warning: 'warninghaptic://',
  error: 'errorhaptic://',
};

/** Fire-and-forget native haptic. No-op outside Despia. */
export function despiaHaptic(kind: DespiaHaptic): void {
  if (!isDespia()) return;
  void despiaCall(SCHEMES[kind]);
}

/**
 * Semantic haptic triggers used across the app.
 * Prefer these over raw `despiaHaptic` at call sites.
 */
export const haptic = {
  /** Toggle flip / layer on-off / minor selection. */
  toggle: () => despiaHaptic('light'),

  findMe: {
    /** Location lock succeeded — sharing is live. */
    success: () => despiaHaptic('success'),
    /** User stopped sharing. */
    stop: () => despiaHaptic('warning'),
    /** Permission / geolocation / out-of-MN failure. */
    error: () => despiaHaptic('error'),
  },

  collect: {
    /** Placement collected — reward paid out. */
    success: () => despiaHaptic('success'),
    /** Collect attempt rejected (already claimed, unavailable, etc). */
    error: () => despiaHaptic('error'),
  },

  /** Escape hatch for one-off patterns. */
  play: despiaHaptic,
} as const;
