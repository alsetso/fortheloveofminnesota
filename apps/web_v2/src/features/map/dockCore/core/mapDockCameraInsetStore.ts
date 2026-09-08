/**
 * Live dock footprint for camera padding (Find Me, etc.).
 * MapDockShell writes; map camera helpers read — Find Me sits above MapDockProvider.
 */

type Listener = () => void;

/** Collapsed pill + float gap — matches MAP_CONFIG.FIND_ME_PADDING_BOTTOM_PX intent. */
const DEFAULT_OCCUPIED_BOTTOM_PX = 80;

let occupiedBottomPx = DEFAULT_OCCUPIED_BOTTOM_PX;
const listeners = new Set<Listener>();

export function getMapDockOccupiedBottomPx(): number {
  return occupiedBottomPx;
}

export function setMapDockOccupiedBottomPx(next: number): void {
  const value = Math.max(0, Math.round(next));
  if (value === occupiedBottomPx) return;
  occupiedBottomPx = value;
  for (const listener of listeners) listener();
}

export function subscribeMapDockOccupiedBottom(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
