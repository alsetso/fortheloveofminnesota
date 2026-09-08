'use client';

/**
 * GameMapRadiusRing — dashed zone ring + zoom-gated spatial labels.
 *
 * Live only — Scout (Capitol spawn / free pose) has no GPS contribution
 * zone, so the blue dashed perimeter and "You" label stay off.
 *
 * Renders on the main game map while Live:
 *   1. Blue dashed ring at the object-radar rangeM radius
 *   2. At zoom ≤ 15 (city-level view), floating labels:
 *        • "You"          — over the user's real GPS position
 *        • "{N} m zone"   — on the north edge of the ring
 *        • "Pin"          — over a dropped selected-point pin (when present)
 *
 * All three labels fade out as you zoom into street level so they don't
 * crowd the close-up avatar view (zoom 16+).
 */

import { useEffect } from 'react';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import type { GeoJSONSource } from 'mapbox-gl';
import { useMapContext } from '@/map/MapProvider';
import { isMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  getPresenceOrigin,
  isPresenceLive,
  subscribePresenceOrigin,
} from '@/map/location/positionMode/playerPresenceOrigin';
import { subscribePresence } from '@/map/location/positionMode/positionModeStore';
import { subscribeObjectRadar, getObjectRadarState } from '@/features/map/game/objectRadar/objectRadarStore';
import {
  subscribeSelectedPointCoords,
  getSelectedPointCoordsSnapshot,
} from '@/map/location/camera/selectedPointCoordsStore';

// ─── Source / layer IDs ───────────────────────────────────────────────────────

const RING_SOURCE_ID  = 'game-map-radius-ring';
const RING_LAYER_ID   = 'game-map-radius-ring-line';
const LABEL_SOURCE_ID = 'game-map-zone-labels';
const LABEL_LAYER_ID  = 'game-map-zone-labels-text';

const EMPTY_POLY: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
const EMPTY_PTS:  FeatureCollection<Point>   = { type: 'FeatureCollection', features: [] };

/** Maximum zoom at which spatial labels are displayed (exclusive upper bound). */
const LABEL_MAX_ZOOM = 15.5;
/** Minimum zoom at which labels appear — below the city frame they're too small. */
const LABEL_MIN_ZOOM = 11;

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function circlePolygon(lng: number, lat: number, rangeM: number, steps = 64): Feature<Polygon> {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const dLng  = (rangeM * Math.cos(angle)) / (111_320 * Math.max(0.2, cosLat));
    const dLat  = (rangeM * Math.sin(angle)) / 110_540;
    coords.push([lng + dLng, lat + dLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** Offset from `lat` by `meters` northward. */
function northPoint(lng: number, lat: number, rangeM: number): [number, number] {
  return [lng, lat + rangeM / 110_540];
}

// ─── Build label FeatureCollection ───────────────────────────────────────────

type LabelFeature = Feature<Point, { label: string; offset: [number, number]; anchor: string }>;

function buildLabels(
  userLng: number,
  userLat: number,
  rangeM: number,
  pinLng: number | null,
  pinLat: number | null,
): FeatureCollection<Point> {
  const features: LabelFeature[] = [];

  // "You" label — centered on the user's GPS position, floats above
  features.push({
    type: 'Feature',
    properties: { label: 'You', offset: [0, -1.4], anchor: 'bottom' },
    geometry: { type: 'Point', coordinates: [userLng, userLat] },
  });

  // Zone ring label — sits on the north edge of the ring
  const [rLng, rLat] = northPoint(userLng, userLat, rangeM);
  features.push({
    type: 'Feature',
    properties: { label: `${Math.round(rangeM)} m zone`, offset: [0, -0.5], anchor: 'bottom' },
    geometry: { type: 'Point', coordinates: [rLng, rLat] },
  });

  // Dropped-pin label — only when a selected point exists
  if (pinLng !== null && pinLat !== null) {
    features.push({
      type: 'Feature',
      properties: { label: 'Pin', offset: [0, 0.8], anchor: 'top' },
      geometry: { type: 'Point', coordinates: [pinLng, pinLat] },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ─── Layer setup ──────────────────────────────────────────────────────────────

function ensureLayers(map: mapboxgl.Map): boolean {
  if (!isMapStyleReady(map)) return false;
  try {
    // Ring line source + layer
    if (!map.getSource(RING_SOURCE_ID)) {
      map.addSource(RING_SOURCE_ID, { type: 'geojson', data: EMPTY_POLY });
      map.addLayer({
        id: RING_LAYER_ID,
        type: 'line',
        source: RING_SOURCE_ID,
        paint: {
          'line-color': '#5BA3FF',
          'line-opacity': 0.65,
          'line-width': 2,
          'line-dasharray': [1.6, 1.4],
        },
      });
    }

    // Label point source + symbol layer
    if (!map.getSource(LABEL_SOURCE_ID)) {
      map.addSource(LABEL_SOURCE_ID, { type: 'geojson', data: EMPTY_PTS });
      map.addLayer({
        id: LABEL_LAYER_ID,
        type: 'symbol',
        source: LABEL_SOURCE_ID,
        minzoom: LABEL_MIN_ZOOM,
        maxzoom: LABEL_MAX_ZOOM,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-anchor': ['get', 'anchor'],
          'text-offset': ['get', 'offset'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-letter-spacing': 0.04,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0, 0, 0, 0.72)',
          'text-halo-width': 1.5,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            LABEL_MIN_ZOOM,     0,
            LABEL_MIN_ZOOM + 1, 1,
            LABEL_MAX_ZOOM - 1, 1,
            LABEL_MAX_ZOOM,     0,
          ],
        },
      });
    }
  } catch {
    return false;
  }
  return Boolean(map.getLayer(RING_LAYER_ID));
}

// ─── Paint both sources ───────────────────────────────────────────────────────

function clearRing(map: mapboxgl.Map) {
  const ringSrc = map.getSource(RING_SOURCE_ID) as GeoJSONSource | undefined;
  const labelSrc = map.getSource(LABEL_SOURCE_ID) as GeoJSONSource | undefined;
  ringSrc?.setData(EMPTY_POLY);
  labelSrc?.setData(EMPTY_PTS);
}

function paintAll(map: mapboxgl.Map) {
  if (!ensureLayers(map)) return;

  // Scout (incl. Capitol boot) — no Live GPS zone chrome.
  if (!isPresenceLive()) {
    clearRing(map);
    return;
  }

  const origin = getPresenceOrigin();
  const rangeM = getObjectRadarState().rangeM;
  const pinCoords = getSelectedPointCoordsSnapshot().coords;

  const ringSrc = map.getSource(RING_SOURCE_ID) as GeoJSONSource | undefined;
  const labelSrc = map.getSource(LABEL_SOURCE_ID) as GeoJSONSource | undefined;

  if (origin.hasFix) {
    ringSrc?.setData({
      type: 'FeatureCollection',
      features: [circlePolygon(origin.lng, origin.lat, rangeM)],
    });
    labelSrc?.setData(
      buildLabels(
        origin.lng,
        origin.lat,
        rangeM,
        pinCoords?.lng ?? null,
        pinCoords?.lat ?? null,
      ),
    );
  } else {
    clearRing(map);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GameMapRadiusRing() {
  const { map, ready } = useMapContext();

  useEffect(() => {
    if (!map || !ready) return;

    const onStyle = () => paintAll(map);
    map.on('style.load', onStyle);
    paintAll(map);

    const unsub1 = subscribePresenceOrigin(() => paintAll(map));
    const unsub2 = subscribeObjectRadar(() => paintAll(map));
    const unsub3 = subscribeSelectedPointCoords(() => paintAll(map));
    // Live ↔ Scout must clear / restore the ring immediately.
    const unsub4 = subscribePresence(() => paintAll(map));

    return () => {
      map.off('style.load', onStyle);
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      try {
        if (isMapStyleReady(map)) {
          if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
          if (map.getSource(LABEL_SOURCE_ID)) map.removeSource(LABEL_SOURCE_ID);
          if (map.getLayer(RING_LAYER_ID)) map.removeLayer(RING_LAYER_ID);
          if (map.getSource(RING_SOURCE_ID)) map.removeSource(RING_SOURCE_ID);
        }
      } catch { /* style already gone */ }
    };
  }, [map, ready]);

  return null;
}
