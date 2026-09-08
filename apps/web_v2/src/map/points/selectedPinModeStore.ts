/**
 * Selected-pin UI mode store.
 *
 * Tracks the visual state of the dropped pin beacon:
 *   default        → red pulse beacon
 *   save-pending   → grey (user tapped Save, form is open)
 *   saved          → grey (address saved to contacts)
 *   post-composing → blue (user opened the inline post composer)
 *   posted         → blue (post submitted — pin stays blue permanently this session)
 *   page-composing → green (user opened Create a Page for this point)
 *
 * Resets to 'default' whenever a new point is committed or the pane is dismissed.
 */

export type SelectedPinMode = 'default' | 'save-pending' | 'saved' | 'post-composing' | 'posted' | 'page-composing';

let _mode: SelectedPinMode = 'default';
const _subscribers = new Set<() => void>();

function notify() {
  _subscribers.forEach((fn) => fn());
}

export function getSelectedPinMode(): SelectedPinMode {
  return _mode;
}

export function subscribeSelectedPinMode(fn: () => void): () => void {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

export function setSelectedPinMode(mode: SelectedPinMode): void {
  if (_mode === mode) return;
  _mode = mode;
  notify();
}

export function resetSelectedPinMode(): void {
  setSelectedPinMode('default');
}
