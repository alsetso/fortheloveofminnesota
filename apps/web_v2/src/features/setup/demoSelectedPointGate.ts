/**
 * Module-level gate controlling whether MapDockContext.openSelectedPoint fires.
 *
 * During the /setup demo, all steps before `select_point` keep this blocked=true
 * so accidental map taps don't open the dock card prematurely. The bridge sets
 * it false when the select_point step activates, and clears it on unmount
 * (demo ends or page navigates away).
 *
 * Zero React dependency — no context needed. Reads are synchronous.
 */

let _blocked = false;

export function setDemoSelectedPointBlocked(val: boolean): void {
  _blocked = val;
}

export function isDemoSelectedPointBlocked(): boolean {
  return _blocked;
}
