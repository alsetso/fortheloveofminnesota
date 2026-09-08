import type { Map as MapboxMap } from 'mapbox-gl';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import type { UserCoords } from '@/map/location/device/geolocation';
import {
  ensureMapPointFormatStyles,
  getMapPointFormat,
} from '@/map/points/registry';
import type {
  MapPointFormatId,
  MapPointMarkerHandle,
} from '@/map/points/types';

export type { MapPointFormatId, MapPointMarkerHandle } from '@/map/points/types';
export type { MapPointFormat } from '@/map/points/types';
export { getMapPointFormat, listMapPointFormats } from '@/map/points/registry';

function isMapAlive(map: MapboxMap): boolean {
  return !(map as MapboxMap & { _removed?: boolean })._removed;
}

export type UpsertMapPointMarkerOptions = {
  format: MapPointFormatId;
  coords: UserCoords;
};

/**
 * Single path for all geo-anchored HTML points.
 * Mapbox owns `.mapboxgl-marker` transform — never override it in CSS.
 * Format switch recreates the marker so anchor/geometry stay correct.
 */
export async function upsertMapPointMarker(
  map: MapboxMap,
  handleRef: { current: MapPointMarkerHandle | null },
  options: UpsertMapPointMarkerOptions,
): Promise<void> {
  if (!isMapAlive(map)) return;

  const format = getMapPointFormat(options.format);
  const { coords } = options;

  const reuse =
    handleRef.current &&
    handleRef.current.formatId === format.id &&
    handleRef.current.styleId === format.styleId;

  if (reuse && handleRef.current) {
    handleRef.current.marker.setLngLat([coords.lng, coords.lat]);
    format.onCoordsApplied?.(handleRef.current, coords);
    if (format.id === 'user-location') {
      applyPendingFindMeAvatar(handleRef.current);
    }
    return;
  }

  if (handleRef.current) {
    removeMapPointMarker(handleRef);
  }

  ensureMapPointFormatStyles(format);
  const mapboxgl = await loadMapboxGL();
  if (!isMapAlive(map)) return;

  const { element, parts = {} } = format.build();
  const marker = new mapboxgl.Marker({
    element,
    anchor: format.anchor,
    offset: format.offset ?? [0, 0],
    pitchAlignment: format.pitchAlignment ?? 'viewport',
    rotationAlignment: format.rotationAlignment ?? 'viewport',
  })
    .setLngLat([coords.lng, coords.lat])
    .addTo(map);

  const handle: MapPointMarkerHandle = {
    marker,
    formatId: format.id,
    styleId: format.styleId,
    parts,
  };
  handleRef.current = handle;
  // Account photo may have been set before the marker existed — paint now.
  if (format.id === 'user-location') {
    applyPendingFindMeAvatar(handle);
  }
  format.onCoordsApplied?.(handle, coords);
}

export function removeMapPointMarker(handleRef: {
  current: MapPointMarkerHandle | null;
}): void {
  if (!handleRef.current) return;
  try {
    handleRef.current.marker.remove();
  } catch {
    /* map may already be gone */
  }
  handleRef.current = null;
}

export type MapPointAvatarOpts = {
  imageUrl?: string | null;
  initials?: string | null;
};

export { setFindMeAvatarTapHandler } from '@/map/points/avatarTapHandler';

/** Last requested Find Me chrome — applied when the marker is (re)created. */
let pendingFindMeAvatar: MapPointAvatarOpts = {};

export function getPendingFindMeAvatar(): MapPointAvatarOpts {
  return pendingFindMeAvatar;
}

function paintUserLocationAvatar(
  handle: MapPointMarkerHandle,
  opts: MapPointAvatarOpts,
): void {
  if (handle.formatId !== 'user-location') return;
  const img = handle.parts.avatarImg as HTMLImageElement | undefined;
  const fallback = handle.parts.avatarFallback;
  const root = handle.marker.getElement();
  if (!img || !fallback) return;

  const initials = (opts.initials?.trim() || '?').slice(0, 2).toUpperCase();
  fallback.textContent = initials;

  const src = opts.imageUrl?.trim() || '';
  if (!src) {
    img.onload = null;
    img.onerror = null;
    img.classList.remove('is-on');
    img.removeAttribute('src');
    fallback.classList.remove('is-off');
    root.classList.remove('has-photo');
    return;
  }

  const showPhoto = () => {
    img.classList.add('is-on');
    fallback.classList.add('is-off');
    root.classList.add('has-photo');
  };
  const showFallback = () => {
    img.classList.remove('is-on');
    img.removeAttribute('src');
    fallback.classList.remove('is-off');
    root.classList.remove('has-photo');
  };

  // Already loaded this URL — keep photo visible.
  if (img.getAttribute('src') === src && img.complete && img.naturalWidth > 0) {
    showPhoto();
    return;
  }

  // Keep initials up until the photo actually loads (avoids empty blue hole).
  img.classList.remove('is-on');
  fallback.classList.remove('is-off');
  root.classList.remove('has-photo');

  img.onload = () => {
    if (img.getAttribute('src') !== src) return;
    showPhoto();
  };
  img.onerror = () => {
    if (img.getAttribute('src') !== src) return;
    showFallback();
  };

  if (img.getAttribute('src') !== src) {
    img.src = src;
  } else if (img.complete) {
    // Cached fail/success with same src attribute.
    if (img.naturalWidth > 0) showPhoto();
    else showFallback();
  }
}

/** Paint account photo (or initials) into the Find Me avatar circle. */
export function setMapPointMarkerAvatar(
  handleRef: { current: MapPointMarkerHandle | null },
  opts: MapPointAvatarOpts,
): void {
  pendingFindMeAvatar = {
    imageUrl: opts.imageUrl ?? null,
    initials: opts.initials ?? null,
  };
  const handle = handleRef.current;
  if (!handle) return;
  paintUserLocationAvatar(handle, pendingFindMeAvatar);
}

/** Re-apply pending account chrome after marker create / format switch. */
export function applyPendingFindMeAvatar(handle: MapPointMarkerHandle): void {
  paintUserLocationAvatar(handle, pendingFindMeAvatar);
}

import type { LocomotionMode } from '@/map/location/device/locomotion';

const MODE_LABELS: Record<LocomotionMode, string> = {
  stationary: 'still',
  walking: 'walking',
  movingFast: 'moving fast',
};

/** Show locomotion mode label below the Find Me avatar. */
export function setMapPointMarkerMode(
  handleRef: { current: MapPointMarkerHandle | null },
  mode: LocomotionMode | null,
): void {
  const handle = handleRef.current;
  if (!handle || handle.formatId !== 'user-location') return;
  const label = handle.parts.modeLabel;
  if (!label) return;

  if (!mode) {
    label.classList.remove('is-visible');
    return;
  }
  label.textContent = MODE_LABELS[mode];
  label.classList.add('is-visible');
}
