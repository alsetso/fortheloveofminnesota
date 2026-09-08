/**
 * Reactive store for Mapbox surface features at the selected point.
 * Written by the map click handler via queryRenderedFeatures;
 * read by DockSelectedPointPane to render surface chips.
 */

import type { SurfaceFeature } from '@/map/surface/parseMapSurfaceFeatures';

type Listener = () => void;

type MapSurfaceState = {
  /** lat/lng key so stale results from a previous click don't bleed in. */
  key: string | null;
  features: SurfaceFeature[];
};

let state: MapSurfaceState = { key: null, features: [] };
let snapshot: MapSurfaceState = state;
const listeners = new Set<Listener>();

function emit() {
  snapshot = { ...state };
  for (const l of listeners) l();
}

export function getMapSurfaceSnapshot(): MapSurfaceState {
  return snapshot;
}

export function subscribeMapSurface(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMapSurface(key: string, features: SurfaceFeature[]): void {
  state = { key, features };
  emit();
}

export function clearMapSurface(): void {
  if (state.key === null && state.features.length === 0) return;
  state = { key: null, features: [] };
  emit();
}
