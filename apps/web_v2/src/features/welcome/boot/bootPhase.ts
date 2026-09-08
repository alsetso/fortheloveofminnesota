/**
 * Cold-start boot phases — game-style staged loader.
 * Splash art stays mounted; chrome + destination change with phase.
 */
export type BootPhase =
  | 'brand'
  | 'auth'
  | 'gate'
  | 'warm_location'
  | 'warm_territory'
  | 'warm_map'
  | 'ready'
  | 'error';

export type BootStatusCopy =
  | 'Signing you in…'
  | 'Loading your account…'
  | 'Finding your place…'
  | 'Mapping your territories…'
  | 'Preparing your map…'
  | 'Welcome'
  | 'Couldn’t reach your account…'
  | 'Loading…';

export const MIN_BRAND_MS = 1400;
/** Absolute max after auth is known — never stick if warm stalls. */
export const MAX_BOOT_MS = 12000;
export const LOCATION_BUDGET_MS = 5000;
export const TERRITORY_BUDGET_MS = 4000;
export const HANDOFF_MS = 280;

export function statusForPhase(
  phase: BootPhase,
  opts?: { accountLoading?: boolean },
): BootStatusCopy {
  switch (phase) {
    case 'brand':
    case 'auth':
      return opts?.accountLoading ? 'Loading your account…' : 'Signing you in…';
    case 'gate':
      return 'Welcome';
    case 'warm_location':
      return 'Finding your place…';
    case 'warm_territory':
      return 'Mapping your territories…';
    case 'warm_map':
      return 'Preparing your map…';
    case 'ready':
      return 'Welcome';
    case 'error':
      return 'Couldn’t reach your account…';
    default:
      return 'Loading…';
  }
}

/** Soft progress for the splash footer — segments, not fake precision. */
export function progressForPhase(phase: BootPhase): number {
  switch (phase) {
    case 'brand':
      return 0.12;
    case 'auth':
      return 0.28;
    case 'gate':
      return 0.4;
    case 'warm_location':
      return 0.55;
    case 'warm_territory':
      return 0.72;
    case 'warm_map':
      return 0.88;
    case 'ready':
      return 1;
    case 'error':
      return 0.28;
    default:
      return 0.1;
  }
}
