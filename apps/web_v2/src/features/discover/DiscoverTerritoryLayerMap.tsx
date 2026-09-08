'use client';

/**
 * Inline map of a full territory layer for browse-only Discover kind pages
 * (counties, districts, school districts, etc.).
 */

import { useEffect, useRef, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
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

const SOURCE_ID = 'discover-layer';
const FILL_ID = 'discover-layer-fill';
const LINE_ID = 'discover-layer-line';

const CROP_BOTTOM_REM = 2;
const CROP_BOTTOM_PX = CROP_BOTTOM_REM * 16;

type GeoJsonSource = { setData: (data: FeatureCollection) => void };

export type DiscoverTerritoryLayerMapSelect = {
  id: string;
  name: string;
};

function featureId(f: Feature): string {
  return String(f.id ?? f.properties?.id ?? '');
}

function featureName(f: Feature): string {
  const props = f.properties ?? {};
  return String(
    props.name ?? props.feature_name ?? props.county_name ?? featureId(f),
  );
}

function unionBounds(features: Feature[]): ReturnType<typeof geometryLngLatBounds> | null {
  let union = null as ReturnType<typeof geometryLngLatBounds>;
  for (const f of features) {
    const box = geometryLngLatBounds(f.geometry as Geometry);
    if (!box) continue;
    if (!union) {
      union = { ...box };
      continue;
    }
    union = {
      minLng: Math.min(union.minLng, box.minLng),
      minLat: Math.min(union.minLat, box.minLat),
      maxLng: Math.max(union.maxLng, box.maxLng),
      maxLat: Math.max(union.maxLat, box.maxLat),
    };
  }
  return union;
}

export function DiscoverTerritoryLayerMap({
  kindSlug,
  label,
  onSelect,
}: {
  kindSlug: string;
  label: string;
  onSelect?: (row: DiscoverTerritoryLayerMapSelect) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [mapReady, setMapReady] = useState(false);
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [loadingFc, setLoadingFc] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoadingFc(true);
    setError(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/territory/layers/${encodeURIComponent(kindSlug)}/boundaries`,
          { credentials: 'include', cache: 'force-cache', signal: ac.signal },
        );
        if (!res.ok) throw new Error('boundaries');
        const body = (await res.json()) as FeatureCollection;
        if (ac.signal.aborted) return;
        setFc({
          type: 'FeatureCollection',
          features: Array.isArray(body.features) ? body.features : [],
        });
      } catch {
        if (!ac.signal.aborted) {
          setError(true);
          setFc({ type: 'FeatureCollection', features: [] });
        }
      } finally {
        if (!ac.signal.aborted) setLoadingFc(false);
      }
    })();
    return () => ac.abort();
  }, [kindSlug]);

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
          zoom: 6.2,
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

        const onClick = (
          e: MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] },
        ) => {
          const feat = e.features?.[0] as Feature | undefined;
          if (!feat) return;
          const id = featureId(feat);
          if (!id) return;
          onSelectRef.current?.({ id, name: featureName(feat) });
        };

        map.on('click', FILL_ID, onClick);
        map.on('mouseenter', FILL_ID, () => {
          map!.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', FILL_ID, () => {
          map!.getCanvas().style.cursor = '';
        });

        mapRef.current = map;
        setMapReady(true);
        map.resize();
      } catch {
        /* best-effort map */
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
    if (!map || !mapReady || !fc) return;

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
          'fill-opacity': 0.2,
        },
      });
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': DISCOVER_MAP_TERRITORY,
          'line-width': 1.25,
          'line-opacity': 0.85,
        },
      });
    }

    const union = unionBounds(fc.features);
    if (union) {
      map.fitBounds(boundsToMapbox(union), {
        padding: {
          top: 36,
          left: 28,
          right: 28,
          bottom: 24 + CROP_BOTTOM_PX,
        },
        maxZoom: 8.5,
        duration: 0,
      });
    } else {
      map.jumpTo({ center: MAP_CONFIG.DEFAULT_CENTER, zoom: 6.0 });
    }
    map.resize();
  }, [mapReady, fc]);

  const total = fc?.features.length ?? 0;
  const showOverlay = mapReady && !loadingFc;
  const empty = showOverlay && total === 0;

  return (
    <div
      className="relative w-full overflow-hidden border-b border-black/[0.08]"
      style={{
        height: `min(42vw, 280px)`,
        minHeight: 180,
        backgroundColor: DISCOVER_MAP_BEIGE,
      }}
      data-discover-layer-map=""
    >
      <div
        ref={hostRef}
        className="absolute inset-x-0 top-0 w-full"
        style={{ height: `calc(100% + ${CROP_BOTTOM_REM}rem)` }}
        aria-hidden={empty || error}
      />

      {(!mapReady || loadingFc) && !error ? (
        <div
          className="absolute inset-0 z-[1] flex items-center justify-center"
          style={{ backgroundColor: DISCOVER_MAP_BEIGE }}
        >
          <p className="text-[13px] font-medium text-foreground-muted">Loading map…</p>
        </div>
      ) : null}

      {showOverlay && total > 0 ? (
        <div className="pointer-events-none absolute left-3 top-3 z-[2] rounded-[12px] border border-black/[0.08] bg-[#f7f5f1]/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-muted">
            Layer
          </p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums leading-none text-foreground">
            {total.toLocaleString()}
            <span className="ml-1 text-[11px] font-semibold text-foreground-muted">
              {label}
            </span>
          </p>
        </div>
      ) : null}

      {empty || error ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] px-4 pb-4 pt-12 text-center [background:linear-gradient(to_top,rgba(40,32,24,0.42)_0%,transparent_100%)]">
          <p className="text-[14px] font-semibold text-white">
            {error ? 'Couldn’t load layer boundaries' : 'No boundaries for this layer'}
          </p>
          <p className="mt-0.5 text-[12px] text-white/85">
            {error ? 'Your list below still works.' : 'Try again later.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
