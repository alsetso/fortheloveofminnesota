/**
 * Shared basemap id — Controls picker + map chrome (rails) stay in sync.
 * Streets → light · Outdoors → neutral (brown/moss) · Satellite → dark.
 */

export type MapBasemapId = 'streets' | 'outdoors' | 'satellite';

/** Dock / rail / pill chrome tone — set on `[data-map-surface]`. */
export type MapSurfaceId = 'light' | 'neutral' | 'dark';

type Snapshot = { value: MapBasemapId };
type Listener = () => void;

let value: MapBasemapId = 'streets';
let snapshot: Snapshot = { value };
const listeners = new Set<Listener>();

const PREVIEW_STYLE_SLUG: Record<MapBasemapId, string> = {
  streets: 'streets-v12',
  outdoors: 'outdoors-v12',
  satellite: 'satellite-streets-v12',
};

const BASEMAP_SURFACE: Record<MapBasemapId, MapSurfaceId> = {
  streets: 'light',
  outdoors: 'neutral',
  satellite: 'dark',
};

function emit() {
  snapshot = { value };
  for (const listener of listeners) listener();
}

export function getBasemapSnapshot(): Snapshot {
  return snapshot;
}

export function subscribeBasemap(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setBasemapId(next: MapBasemapId): void {
  if (next === value) return;
  value = next;
  emit();
}

/** Chrome surface for a basemap (or the live selection). */
export function basemapSurface(id: MapBasemapId = value): MapSurfaceId {
  return BASEMAP_SURFACE[id];
}

/** Satellite imagery — inverted (dark) chrome. */
export function basemapIsDarkSurface(id: MapBasemapId = value): boolean {
  return basemapSurface(id) === 'dark';
}

/** Label chip on the basemap preview — light / neutral tiles need dark text. */
export function basemapPreviewLabelIsLight(id: MapBasemapId): boolean {
  return basemapSurface(id) !== 'dark';
}

/**
 * Small Mapbox Static Images preview for the basemap picker
 * (falls back to CSS gradient when token is missing).
 */
export function mapboxBasemapPreviewUrl(
  kind: MapBasemapId,
  token: string,
  size = 104,
): string | null {
  if (!token) return null;
  const styleSlug = PREVIEW_STYLE_SLUG[kind];
  const lon = -93.265;
  const lat = 44.95;
  const z = 5.4;
  return `https://api.mapbox.com/styles/v1/mapbox/${styleSlug}/static/${lon},${lat},${z},0/${size}x${size}@2x?access_token=${encodeURIComponent(token)}`;
}
