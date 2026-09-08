/**
 * Reactive store for normalized geographic features at the selected map point.
 *
 * Written synchronously by the map click handler (queryRenderedFeatures is
 * instant — GPU memory).  Cleared when the selected point is committed or
 * dismissed.  Read by GeoFeaturesDebugPanel in DockSelectedPointPane.
 */

import type { AppGeoFeature } from './appGeoFeature';

type Listener = () => void;

type MapGeoFeaturesState = {
  /** lat/lng key matching pointAtLocationCacheKey — prevents stale renders. */
  key: string | null;
  features: AppGeoFeature[];
};

let state: MapGeoFeaturesState = { key: null, features: [] };
let snapshot: MapGeoFeaturesState = state;
const listeners = new Set<Listener>();

function emit() {
  snapshot = { ...state };
  for (const l of listeners) l();
}

export function getMapGeoFeaturesSnapshot(): MapGeoFeaturesState {
  return snapshot;
}

export function subscribeMapGeoFeatures(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMapGeoFeatures(key: string, features: AppGeoFeature[]): void {
  state = { key, features };
  emit();
}

export function clearMapGeoFeatures(): void {
  if (state.key === null && state.features.length === 0) return;
  state = { key: null, features: [] };
  emit();
}
