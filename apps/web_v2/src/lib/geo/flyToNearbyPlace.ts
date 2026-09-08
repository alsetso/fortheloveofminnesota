'use client';

import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { selectedPointFocusPadding } from '@/lib/geo/selectedPointFocusPadding';
import type { NearbyPlaceHit } from '@/lib/geo/nearby/nearbyPlacesTypes';

/**
 * Fly the camera to a nearby place — same framing as Selected Point, but
 * with no reverse-geocode / territory lookups / selected-point store writes.
 * Use for the "What's nearby" listing flow (card or pin tap).
 */
export function flyToNearbyPlace(map: MapboxMap, place: NearbyPlaceHit): void {
  const padding = selectedPointFocusPadding(map);
  map.flyTo({
    center: [place.lng, place.lat],
    zoom: MAP_CONFIG.SELECTED_POINT_ZOOM,
    padding,
    speed: 0.85,
    curve: 1.55,
    essential: true,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}
