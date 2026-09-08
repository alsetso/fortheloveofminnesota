/**
 * Saved-address white dot markers on the Object Radar map.
 *
 * Renders a separate GeoJSON source + two circle layers (halo + solid dot)
 * in pure white — visually distinct from game-object dots — on the shared
 * Object Radar Mapbox instance (minimap dial + expanded Object Map sheet).
 *
 * On the minimap:  clipped to within rangeM so the source stays tight.
 * On the object-map: all saved addresses shown regardless of range.
 *
 * Called from paintObjectRadarScene so it fires every time the radar repaints.
 */

import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { SavedAddressPin } from '@/features/map/savedAddresses/savedAddressesStore';
import type { ObjectRadarSurface, ObjectRadarOrigin } from '@/features/map/game/objectRadar/types';
import { distanceMeters } from '@/features/map/game/objectRadar/range';

export const SAVED_ADDR_RADAR_SOURCE    = 'object-radar-saved-addresses';
export const SAVED_ADDR_RADAR_HALO      = 'object-radar-saved-addresses-halo';
export const SAVED_ADDR_RADAR_DOT       = 'object-radar-saved-addresses-dot';

const WHITE = '#FFFFFF';

// ── GeoJSON builder ────────────────────────────────────────────────────────────

function toFeatureCollection(
  pins: SavedAddressPin[],
  origin: ObjectRadarOrigin,
  rangeM: number,
  surface: ObjectRadarSurface,
): FeatureCollection<Point> {
  const features = pins
    .filter((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
      // Minimap: clip to within range (+ 10% edge buffer) to keep the GL source tight.
      if (surface === 'minimap') {
        return distanceMeters(origin, { lat: p.lat, lng: p.lng }) <= rangeM * 1.1;
      }
      return true; // object-map shows all
    })
    .map((p) => ({
      type: 'Feature' as const,
      id: p.id,
      properties: { id: p.id, label: p.label, tag: p.tag },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    }));

  return { type: 'FeatureCollection', features };
}

// ── Layer sync ─────────────────────────────────────────────────────────────────

/**
 * Create or update the saved-address white dot layers on the radar map.
 * Safe to call on every paint tick — uses setData when source already exists.
 */
export function syncSavedAddressMarkersOnRadar(
  map: MapboxMap,
  pins: SavedAddressPin[],
  surface: ObjectRadarSurface,
  origin: ObjectRadarOrigin,
  rangeM: number,
): void {
  if (!map.getStyle()) return;

  const data = toFeatureCollection(pins, origin, rangeM, surface);

  // Dot sizes tuned to complement the object dots without competing with them.
  const haloR   = surface === 'minimap' ? 6  : 9;
  const dotR    = surface === 'minimap' ? 3.5 : 4.5;

  const existing = map.getSource(SAVED_ADDR_RADAR_SOURCE) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
  } else {
    try {
      map.addSource(SAVED_ADDR_RADAR_SOURCE, {
        type: 'geojson',
        data,
        promoteId: 'id',
      });
    } catch {
      return; // style race — will retry on next paint
    }

    try {
      map.addLayer({
        id: SAVED_ADDR_RADAR_HALO,
        type: 'circle',
        source: SAVED_ADDR_RADAR_SOURCE,
        paint: {
          'circle-radius': haloR,
          'circle-color': WHITE,
          'circle-opacity': surface === 'minimap' ? 0.30 : 0.18,
          'circle-blur': surface === 'minimap' ? 0.2 : 0.5,
        },
      });
    } catch { /* raced */ }

    try {
      map.addLayer({
        id: SAVED_ADDR_RADAR_DOT,
        type: 'circle',
        source: SAVED_ADDR_RADAR_SOURCE,
        paint: {
          'circle-radius': dotR,
          'circle-color': WHITE,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': 'rgba(0,0,0,0.55)',
          'circle-opacity': 1,
        },
      });
    } catch { /* raced */ }
  }

  // Keep paint properties in sync when the source already existed
  // (surface can flip when the map transfers between minimap and object-map).
  try {
    if (map.getLayer(SAVED_ADDR_RADAR_HALO)) {
      map.setPaintProperty(SAVED_ADDR_RADAR_HALO, 'circle-radius', haloR);
      map.setPaintProperty(
        SAVED_ADDR_RADAR_HALO,
        'circle-opacity',
        surface === 'minimap' ? 0.30 : 0.18,
      );
      map.setPaintProperty(SAVED_ADDR_RADAR_HALO, 'circle-blur', surface === 'minimap' ? 0.2 : 0.5);
    }
    if (map.getLayer(SAVED_ADDR_RADAR_DOT)) {
      map.setPaintProperty(SAVED_ADDR_RADAR_DOT, 'circle-radius', dotR);
    }
  } catch { /* mid style swap */ }

  // Always on top so white dots read over the basemap.
  try {
    if (map.getLayer(SAVED_ADDR_RADAR_HALO)) map.moveLayer(SAVED_ADDR_RADAR_HALO);
    if (map.getLayer(SAVED_ADDR_RADAR_DOT))  map.moveLayer(SAVED_ADDR_RADAR_DOT);
  } catch { /* style race */ }
}

/** Remove source + layers — called on map teardown. */
export function removeSavedAddressMarkersOnRadar(map: MapboxMap): void {
  try {
    if (map.getLayer(SAVED_ADDR_RADAR_DOT))  map.removeLayer(SAVED_ADDR_RADAR_DOT);
    if (map.getLayer(SAVED_ADDR_RADAR_HALO)) map.removeLayer(SAVED_ADDR_RADAR_HALO);
    if (map.getSource(SAVED_ADDR_RADAR_SOURCE)) map.removeSource(SAVED_ADDR_RADAR_SOURCE);
  } catch { /* style gone */ }
}
