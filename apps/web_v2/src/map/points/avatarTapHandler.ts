/** Module-level tap handler — set by Game surface to open account card. */
let _handler: (() => void) | null = null;

export function setFindMeAvatarTapHandler(fn: (() => void) | null): void {
  _handler = fn;
}

export function getFindMeAvatarTapHandler(): (() => void) | null {
  return _handler;
}
