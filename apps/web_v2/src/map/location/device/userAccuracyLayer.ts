/**
 * GPS accuracy circle rendered as a Mapbox GL fill layer.
 * Scales automatically with map zoom; sits beneath DOM markers.
 *
 * Usage:
 *   showAccuracyCircle(map, coords)   — creates/updates source + layer
 *   updateAccuracyCircle(map, coords) — update position/radius in place
 *   hideAccuracyCircle(map)           — removes layer + source
 */

import type { Map as MapboxMap } from 'mapbox-gl';
import type { UserCoords } from '@/map/location/device/geolocation';

const SOURCE_ID = 'user-accuracy-source';
const LAYER_ID = 'user-accuracy-layer';

/** Mapbox metres-per-pixel formula (equatorial metres, corrected for latitude). */
function accuracyPx(accuracyM: number, lat: number, zoom: number): number {
  if (!Number.isFinite(accuracyM) || accuracyM <= 0) return 0;
  const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  if (mpp <= 0) return 0;
  return Math.max(0, accuracyM / mpp);
}

function buildGeoJSON(coords: UserCoords) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { accuracy: coords.accuracy ?? 20 },
        geometry: {
          type: 'Point' as const,
          coordinates: [coords.lng, coords.lat],
        },
      },
    ],
  };
}

/** Find the first symbol layer so we can insert below it (keeps circle under labels). */
function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try {
    const layers = map.getStyle()?.layers ?? [];
    return layers.find((l) => l.type === 'symbol')?.id;
  } catch {
    return undefined;
  }
}

function applyRadius(map: MapboxMap, coords: UserCoords) {
  const accuracy = typeof coords.accuracy === 'number' ? coords.accuracy : 20;
  const r = accuracyPx(accuracy, coords.lat, map.getZoom());
  map.setPaintProperty(LAYER_ID, 'circle-radius', r);
}

/**
 * Show or refresh the accuracy circle. Safe to call on every GPS fix.
 * Pass the same map reference until you call hideAccuracyCircle.
 */
export function showAccuracyCircle(map: MapboxMap, coords: UserCoords): void {
  try {
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(buildGeoJSON(coords));
      applyRadius(map, coords);
      return;
    }

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: buildGeoJSON(coords),
    });

    map.addLayer(
      {
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': accuracyPx(
            typeof coords.accuracy === 'number' ? coords.accuracy : 20,
            coords.lat,
            map.getZoom(),
          ),
          'circle-color': '#4A90E2',
          'circle-opacity': 0.15,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#4A90E2',
          'circle-stroke-opacity': 0.35,
          'circle-pitch-alignment': 'map',
        },
      },
      firstSymbolLayerId(map),
    );
  } catch (err) {
    // Map style not ready — caller should retry when style.load fires.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[accuracyCircle] add failed:', err);
    }
  }
}

/** Update the circle position + radius without tearing down the layer. */
export function updateAccuracyCircle(map: MapboxMap, coords: UserCoords): void {
  try {
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) {
      showAccuracyCircle(map, coords);
      return;
    }
    source.setData(buildGeoJSON(coords));
    applyRadius(map, coords);
  } catch {
    // ignore
  }
}

/** Recalculate pixel radius after zoom (no position change). */
export function refreshAccuracyRadius(map: MapboxMap, coords: UserCoords): void {
  try {
    if (!map.getLayer(LAYER_ID)) return;
    applyRadius(map, coords);
  } catch {
    // ignore
  }
}

/** Remove the accuracy circle layer + source from the map. */
export function hideAccuracyCircle(map: MapboxMap): void {
  try {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  } catch {
    // ignore — map may be mid-style-swap
  }
}
