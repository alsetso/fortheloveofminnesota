/**
 * Tile grid feature state.
 *
 * Game paints grid lines by default (no Controls toggle for players).
 * Satellite stays opt-in for staff / future surfaces.
 *
 * Uses the same external-store pattern as the rest of the map stores so it
 * works with React's `useSyncExternalStore` without a 3rd-party dependency.
 */

export type TileGridState = {
  /** Show Mapbox Satellite imagery as a ground plane. */
  showSatellite: boolean;
  /** Overlay tile boundary lines + z/x/y labels. */
  showGridLines: boolean;
  /**
   * How many tiles outward from the player tile to fetch (radius in tiles).
   * radius=2 → 5×5 grid (25 tiles, ~390m across at zoom 18, Minneapolis).
   * radius=3 → 7×7 grid (49 tiles, ~546m across).
   */
  radius: number;
};

let state: TileGridState = {
  showSatellite: false,
  showGridLines: true,
  radius: 2,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function getTileGridState(): TileGridState {
  return state;
}

export function subscribeTileGrid(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTileGridSatellite(on: boolean): void {
  if (state.showSatellite === on) return;
  state = { ...state, showSatellite: on };
  notify();
}

export function setTileGridLines(on: boolean): void {
  if (state.showGridLines === on) return;
  state = { ...state, showGridLines: on };
  notify();
}

export function setTileGridRadius(radius: number): void {
  const clamped = Math.max(1, Math.min(5, radius));
  if (state.radius === clamped) return;
  state = { ...state, radius: clamped };
  notify();
}

/** Toggle both overlays together — convenience for the game controls UI. */
export function toggleTileGrid(): void {
  const next = !state.showSatellite;
  state = { ...state, showSatellite: next, showGridLines: next };
  notify();
}
