'use client';

/** Shared non-interactive Mapbox boundary preview for Discover carousel cards. */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Map as MapboxMap } from 'mapbox-gl';
import {
  applyBeigeDiscoverMapStyle,
  DISCOVER_MAP_BEIGE,
  DISCOVER_MAP_STYLE,
} from '@/features/discover/beigeDiscoverMapStyle';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import {
  boundsToMapbox,
  geometryLngLatBounds,
} from '@/map/geo/geometryLngLatBounds';

const SOURCE_ID = 'discover-boundary-card';
const FILL_ID = 'discover-boundary-card-fill';
const LINE_ID = 'discover-boundary-card-line';

/** Visible frame crops this much off the bottom of the Mapbox canvas. */
const CROP_BOTTOM_REM = 2;
const CROP_BOTTOM_PX = CROP_BOTTOM_REM * 16;

type GeoJsonSource = { setData: (data: FeatureCollection) => void };

function fitBoundary(
  map: MapboxMap,
  geometry: Polygon | MultiPolygon,
): void {
  const box = geometryLngLatBounds(geometry);
  if (!box) return;
  map.fitBounds(boundsToMapbox(box), {
    padding: {
      top: 20,
      left: 20,
      right: 20,
      bottom: 20 + CROP_BOTTOM_PX,
    },
    maxZoom: 14,
    duration: 0,
  });
}

export function DiscoverBoundaryCardMap({
  featureId,
  name,
  geometry,
  fillColor,
  lineColor,
  fillOpacity = 0.28,
}: {
  featureId: string;
  name: string;
  geometry: Polygon | MultiPolygon;
  fillColor: string;
  lineColor: string;
  fillOpacity?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const fc = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: featureId,
          properties: { id: featureId, name },
          geometry,
        },
      ],
    }),
    [featureId, geometry, name],
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
          zoom: 10,
          pitch: 0,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
          preserveDrawingBuffer: true,
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
        /* best-effort preview */
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
          'fill-color': fillColor,
          'fill-opacity': fillOpacity,
        },
      });
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': lineColor,
          'line-width': 2.25,
          'line-opacity': 0.95,
        },
      });
    }

    fitBoundary(map, geometry);
    map.resize();
  }, [mapReady, fc, geometry, fillColor, lineColor, fillOpacity]);

  useEffect(() => {
    const host = hostRef.current;
    const map = mapRef.current;
    if (!host || !map || !mapReady) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          map.resize();
          fitBoundary(map, geometry);
        }
      },
      { threshold: 0.15 },
    );
    io.observe(host);
    return () => io.disconnect();
  }, [mapReady, geometry]);

  return (
    <div
      className="pointer-events-none relative h-full w-full overflow-hidden"
      style={{ backgroundColor: DISCOVER_MAP_BEIGE }}
      aria-hidden
    >
      <div
        ref={hostRef}
        className="absolute inset-x-0 top-0 w-full"
        style={{ height: `calc(100% + ${CROP_BOTTOM_REM}rem)` }}
      />
      {!mapReady ? (
        <div
          className="absolute inset-0 z-[1]"
          style={{ backgroundColor: DISCOVER_MAP_BEIGE }}
        />
      ) : null}
    </div>
  );
}
