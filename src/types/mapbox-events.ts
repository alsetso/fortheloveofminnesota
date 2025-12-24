/**
 * Type definitions for Mapbox event handlers
 */

export interface MapboxMapInstance {
  _pinDragHandler?: {
    mousedown: (e: MapboxMouseEvent) => void;
    mousemove: (e: MapboxMouseEvent) => void;
    mouseup: (e: MapboxMouseEvent) => void;
  };
  removed?: boolean;
  _removed?: boolean;
  _drawObserver?: MutationObserver;
  _keyboardHandler?: (e: KeyboardEvent) => void;
  getSource: (sourceId: string) => ({ type: string; setData: (data: GeoJSON.FeatureCollection) => void } & { type: 'geojson' }) | null;
  on: (event: string, handler: (e: unknown) => void) => void;
  once: (event: string, handler: (e: unknown) => void) => void;
  off: (event: string, handler?: unknown) => void;
  getCenter: () => { lng: number; lat: number };
  getZoom: () => number;
  getBearing: () => number;
  getPitch: () => number;
  setStyle: (style: string) => void;
  setCenter: (center: [number, number] | { lng: number; lat: number }) => void;
  setZoom: (zoom: number) => void;
  setBearing: (bearing: number) => void;
  setPitch: (pitch: number) => void;
  zoomTo: (zoom: number, options?: { duration?: number }) => void;
  rotateTo: (bearing: number, options?: { duration?: number }) => void;
  flyTo: (options: {
    center: [number, number];
    zoom: number;
    duration?: number;
    bearing?: number;
    pitch?: number;
  }) => void;
  easeTo: (options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
  }) => void;
  remove: () => void;
  resize: () => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: { padding?: number; maxZoom?: number; duration?: number }) => void;
  addSource: (id: string, source: { type: string; data: GeoJSON.FeatureCollection }) => void;
  addLayer: (layer: { id: string; type: string; source: string; [key: string]: unknown }) => void;
  getLayer: (id: string) => { id: string; type: string; [key: string]: unknown } | null;
  getStyle: () => { layers?: Array<{ id: string; type: string; [key: string]: unknown }> } | undefined;
  setLayoutProperty: (layerId: string, property: string, value: unknown) => void;
}

export interface MapboxMouseEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  originalEvent: MouseEvent;
  target: unknown;
  [key: string]: unknown;
}

export interface MapboxDrawEvent {
  mode: string;
  [key: string]: unknown;
}

export interface MapboxSuggestion {
  center: [number, number];
  place_name: string;
  context?: Array<{
    id: string;
    text: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface MapboxFeature {
  id?: string | number;
  type: string;
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: number[] | number[][] | number[][][];
  };
  context?: Array<{
    id: string;
    text: string;
    [key: string]: unknown;
  }>;
}


