'use client';

/** Single-unit boundary map for `/place/:id` — cropped frame like Discover. */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import {
  boundsToMapbox,
  geometryLngLatBounds,
} from '@/map/geo/geometryLngLatBounds';
import {
  applyBeigeDiscoverMapStyle,
  DISCOVER_MAP_BEIGE,
  DISCOVER_MAP_STYLE,
  DISCOVER_MAP_TERRITORY,
} from '@/features/discover/beigeDiscoverMapStyle';

const SOURCE_ID = 'place-boundary';
const FILL_ID = 'place-boundary-fill';
const LINE_ID = 'place-boundary-line';
const CROP_BOTTOM_REM = 2;
const CROP_BOTTOM_PX = CROP_BOTTOM_REM * 16;

type GeoJsonSource = { setData: (data: FeatureCollection) => void };

export function PlaceBoundaryMap({
  placeId,
  name,
  geometry,
  visited,
}: {
  placeId: string;
  name: string;
  geometry: Geometry | null;
  visited: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const fc = useMemo<FeatureCollection>(
    () =>
      geometry
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                id: placeId,
                properties: { id: placeId, name },
                geometry,
              },
            ],
          }
        : { type: 'FeatureCollection', features: [] },
    [geometry, name, placeId],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !MAP_CONFIG.MAPBOX_TOKEN) return;

    let cancelled = false;
    let map: MapboxMap | null = null;

    void (async () => {
      try {
        const mapbox = await loadMapboxGL();
        if (cancelled || !hostRef.current) return;
        mapbox.accessToken = MAP_CONFIG.MAPBOX_TOKEN;
        map = new mapbox.Map({
          container: hostRef.current,
          style: DISCOVER_MAP_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: 8,
          pitch: 0,
          interactive: true,
          attributionControl: false,
          fadeDuration: 0,
          dragRotate: false,
          touchPitch: false,
          pitchWithRotate: false,
        });
        await new Promise<void>((resolve) => {
          if (!map) {
            resolve();
            return;
          }
          if (map.isStyleLoaded()) {
            resolve();
            return;
          }
          map.once('load', () => resolve());
        });
        if (cancelled || !map) return;
        applyBeigeDiscoverMapStyle(map);
        mapRef.current = map;
        setMapReady(true);
        map.resize();
      } catch {
        /* best-effort */
      }
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const src = map.getSource(SOURCE_ID) as GeoJsonSource | undefined;
    if (src) {
      src.setData(fc);
    } else {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: fc,
        promoteId: 'id',
      });
      map.addLayer({
        id: FILL_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': DISCOVER_MAP_TERRITORY,
          'fill-opacity': visited ? 0.42 : 0.22,
        },
      });
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': DISCOVER_MAP_TERRITORY,
          'line-width': 2,
          'line-opacity': 0.95,
          'line-dasharray': visited ? [1, 0] : [2, 1.5],
        },
      });
    }

    if (geometry) {
      const box = geometryLngLatBounds(geometry);
      if (box) {
        map.fitBounds(boundsToMapbox(box), {
          padding: {
            top: 40,
            left: 32,
            right: 32,
            bottom: 28 + CROP_BOTTOM_PX,
          },
          maxZoom: 12.5,
          duration: 0,
        });
      }
    } else {
      map.jumpTo({ center: MAP_CONFIG.DEFAULT_CENTER, zoom: 6 });
    }
    map.resize();
  }, [mapReady, fc, geometry, visited]);

  return (
    <div
      className="relative w-full overflow-hidden border-b border-black/[0.08]"
      style={{
        height: 'min(46vw, 300px)',
        minHeight: 200,
        backgroundColor: DISCOVER_MAP_BEIGE,
      }}
      data-place-boundary-map=""
    >
      <div
        ref={hostRef}
        className="absolute inset-x-0 top-0 w-full"
        style={{ height: `calc(100% + ${CROP_BOTTOM_REM}rem)` }}
      />
      {!mapReady ? (
        <div
          className="absolute inset-0 z-[1] flex items-center justify-center"
          style={{ backgroundColor: DISCOVER_MAP_BEIGE }}
        >
          <p className="text-[13px] font-medium text-foreground-muted">Loading map…</p>
        </div>
      ) : null}
    </div>
  );
}
