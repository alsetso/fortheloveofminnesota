import type { Marker, MarkerOptions } from 'mapbox-gl';
import type { UserCoords } from '@/map/location/device/geolocation';

/** Built-in point visuals. Add formats here — all share `upsertMapPointMarker`. */
export type MapPointFormatId = 'selected' | 'user-location' | 'user-location-dot';

export type MapPointMarkerHandle = {
  marker: Marker;
  formatId: MapPointFormatId;
  /** Recreate when format visual/anchor revisions change. */
  styleId: string;
  /** Format-private DOM hooks (e.g. pulse ring). */
  parts: Record<string, HTMLElement>;
};

export type MapPointBuildResult = {
  /** Root element passed to Mapbox — never apply CSS `transform` on this node. */
  element: HTMLElement;
  parts?: Record<string, HTMLElement>;
};

export type MapPointFormat = {
  id: MapPointFormatId;
  /** Injected once into document.head. */
  styleId: string;
  styleText: string;
  /** Mapbox anchor — must match the visual tip/center of `element`. */
  anchor: NonNullable<MarkerOptions['anchor']>;
  offset?: [number, number];
  /**
   * Keep screen-upright billboards. Do not set `pitchAlignment: 'map'` for pins —
   * that lays HTML flat and fights tip accuracy.
   */
  pitchAlignment?: NonNullable<MarkerOptions['pitchAlignment']>;
  rotationAlignment?: NonNullable<MarkerOptions['rotationAlignment']>;
  build: () => MapPointBuildResult;
  /** Optional per-fix feedback (e.g. GPS pulse). */
  onCoordsApplied?: (handle: MapPointMarkerHandle, coords: UserCoords) => void;
};
