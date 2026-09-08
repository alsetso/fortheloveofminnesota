'use client';

/**
 * Inline beige Mapbox preview for one atlas feature set.
 * Renders Point / Line / Polygon correctly; crops 2rem off the bottom.
 */

import { useEffect, useRef, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import {
  applyBeigeDiscoverMapStyle,
  DISCOVER_MAP_BEIGE,
  DISCOVER_MAP_STYLE,
  DISCOVER_MAP_TERRITORY,
} from '@/features/discover/beigeDiscoverMapStyle';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import {
  boundsToMapbox,
  geometryLngLatBounds,
} from '@/map/geo/geometryLngLatBounds';

const SOURCE_ID = 'atlas-collection-preview';
const FILL_ID = 'atlas-collection-fill';
const LINE_ID = 'atlas-collection-line';
const LINE_CASING_ID = 'atlas-collection-line-casing';
const CLUSTER_ID = 'atlas-collection-clusters';
const CLUSTER_COUNT_ID = 'atlas-collection-cluster-count';
const POINT_ID = 'atlas-collection-points';
const FEATURED_ID = 'atlas-collection-featured';

/** Visible frame crops this much off the bottom of the Mapbox canvas. */
const CROP_BOTTOM_REM = 2;
const CROP_BOTTOM_PX = CROP_BOTTOM_REM * 16;

const POLYGON_FILTER = [
  'any',
  ['==', ['geometry-type'], 'Polygon'],
  ['==', ['geometry-type'], 'MultiPolygon'],
] as unknown as mapboxgl.FilterSpecification;

const LINE_FILTER = [
  'any',
  ['==', ['geometry-type'], 'LineString'],
  ['==', ['geometry-type'], 'MultiLineString'],
] as unknown as mapboxgl.FilterSpecification;

const POINT_FILTER = [
  'any',
  ['==', ['geometry-type'], 'Point'],
  ['==', ['geometry-type'], 'MultiPoint'],
] as unknown as mapboxgl.FilterSpecification;

type GeoJsonSource = {
  setData: (data: FeatureCollection) => void;
  getClusterExpansionZoom: (
    clusterId: number,
    callback: (err: Error | null, zoom: number) => void,
  ) => void;
};

export type AtlasMapSelect = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type MapMeta = {
  total?: number;
  truncated?: boolean;
  geomModes?: string[];
};

function featureFocus(f: Feature): AtlasMapSelect | null {
  const props = f.properties ?? {};
  const id = String(props.id ?? f.id ?? '');
  const name = String(props.name ?? '');
  if (!id) return null;

  const latProp = props.lat;
  const lngProp = props.lng;
  if (
    typeof latProp === 'number' &&
    typeof lngProp === 'number' &&
    Number.isFinite(latProp) &&
    Number.isFinite(lngProp)
  ) {
    return { id, name, lat: latProp, lng: lngProp };
  }

  const box = geometryLngLatBounds(f.geometry as Geometry);
  if (!box) return null;
  return {
    id,
    name,
    lat: (box.minLat + box.maxLat) / 2,
    lng: (box.minLng + box.maxLng) / 2,
  };
}

function collectionIsPointsOnly(modes: string[] | undefined, fc: FeatureCollection): boolean {
  if (modes?.length) {
    return modes.every((m) => m === 'point');
  }
  return fc.features.every((f) => {
    const t = f.geometry?.type;
    return t === 'Point' || t === 'MultiPoint';
  });
}

export function DiscoverAtlasCollectionMap({
  slug,
  label,
  onSelect,
}: {
  slug: string;
  label: string;
  onSelect?: (row: AtlasMapSelect) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const pointsOnlyRef = useRef(true);

  const [mapReady, setMapReady] = useState(false);
  const [fc, setFc] = useState<FeatureCollection | null>(null);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [geomModes, setGeomModes] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [loadingFc, setLoadingFc] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoadingFc(true);
    setError(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/discover/atlas/${encodeURIComponent(slug)}/map`,
          { credentials: 'include', cache: 'no-store', signal: ac.signal },
        );
        if (!res.ok) throw new Error('map');
        const body = (await res.json()) as FeatureCollection & { meta?: MapMeta };
        if (ac.signal.aborted) return;
        setFc({
          type: 'FeatureCollection',
          features: Array.isArray(body.features) ? body.features : [],
        });
        setTotal(body.meta?.total ?? body.features?.length ?? 0);
        setTruncated(Boolean(body.meta?.truncated));
        setGeomModes(
          Array.isArray(body.meta?.geomModes)
            ? body.meta.geomModes.map(String)
            : [],
        );
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
  }, [slug]);

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

        const onFeatureClick = (
          e: MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] },
        ) => {
          const feat = e.features?.[0] as Feature | undefined;
          if (!feat) return;
          const hit = featureFocus(feat);
          if (hit) onSelectRef.current?.(hit);
        };

        const onClusterClick = (
          e: MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] },
        ) => {
          const feat = e.features?.[0];
          if (!feat || !map) return;
          const clusterId = feat.properties?.cluster_id;
          if (typeof clusterId !== 'number') return;
          const src = map.getSource(SOURCE_ID) as GeoJsonSource | undefined;
          if (!src) return;
          const coords = (feat.geometry as { coordinates?: [number, number] })
            ?.coordinates;
          if (!coords) return;
          src.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || !map) return;
            map.easeTo({ center: coords, zoom });
          });
        };

        for (const layerId of [FILL_ID, LINE_ID, POINT_ID, FEATURED_ID]) {
          map.on('click', layerId, onFeatureClick);
          map.on('mouseenter', layerId, () => {
            map!.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', layerId, () => {
            map!.getCanvas().style.cursor = '';
          });
        }
        map.on('click', CLUSTER_ID, onClusterClick);
        map.on('mouseenter', CLUSTER_ID, () => {
          map!.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', CLUSTER_ID, () => {
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

    const pointsOnly = collectionIsPointsOnly(geomModes, fc);
    pointsOnlyRef.current = pointsOnly;

    const existing = map.getSource(SOURCE_ID) as GeoJsonSource | undefined;
    if (existing) {
      // Source cluster flag is immutable — rebuild if mode changed.
      const wantsCluster = pointsOnly;
      const hasClusterLayer = Boolean(map.getLayer(CLUSTER_ID));
      if (wantsCluster !== hasClusterLayer) {
        for (const id of [
          CLUSTER_COUNT_ID,
          CLUSTER_ID,
          FEATURED_ID,
          POINT_ID,
          LINE_ID,
          LINE_CASING_ID,
          FILL_ID,
        ]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        map.removeSource(SOURCE_ID);
      } else {
        existing.setData(fc);
        fitPreview(map, fc);
        return;
      }
    }

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: fc,
      ...(pointsOnly
        ? { cluster: true, clusterMaxZoom: 12, clusterRadius: 42 }
        : {}),
    });

    // Polygons
    map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      filter: POLYGON_FILTER,
      paint: {
        'fill-color': DISCOVER_MAP_TERRITORY,
        'fill-opacity': 0.34,
      },
    });
    map.addLayer({
      id: LINE_CASING_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: POLYGON_FILTER,
      paint: {
        'line-color': DISCOVER_MAP_TERRITORY,
        'line-width': 1.25,
        'line-opacity': 0.9,
      },
    });

    // Lines / corridors
    map.addLayer({
      id: LINE_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: LINE_FILTER,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': DISCOVER_MAP_TERRITORY,
        'line-width': 2.25,
        'line-opacity': 0.92,
      },
    });

    if (pointsOnly) {
      map.addLayer({
        id: CLUSTER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': DISCOVER_MAP_TERRITORY,
          'circle-opacity': 0.78,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            14,
            25,
            18,
            100,
            24,
            500,
            30,
          ],
        },
      });
      map.addLayer({
        id: CLUSTER_COUNT_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 11,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#f7f5f1',
        },
      });
      map.addLayer({
        id: POINT_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: [
          'all',
          POINT_FILTER,
          ['!', ['has', 'point_count']],
          [
            '!',
            [
              'any',
              ['==', ['get', 'featured'], true],
              ['==', ['get', 'featured'], 'true'],
            ],
          ],
        ],
        paint: {
          'circle-color': DISCOVER_MAP_TERRITORY,
          'circle-radius': 4.5,
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': DISCOVER_MAP_BEIGE,
        },
      });
      map.addLayer({
        id: FEATURED_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: [
          'all',
          POINT_FILTER,
          ['!', ['has', 'point_count']],
          [
            'any',
            ['==', ['get', 'featured'], true],
            ['==', ['get', 'featured'], 'true'],
          ],
        ],
        paint: {
          'circle-color': '#1a4a62',
          'circle-radius': 6.5,
          'circle-opacity': 0.95,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': DISCOVER_MAP_BEIGE,
        },
      });
    } else {
      map.addLayer({
        id: POINT_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: [
          'all',
          POINT_FILTER,
          [
            '!',
            [
              'any',
              ['==', ['get', 'featured'], true],
              ['==', ['get', 'featured'], 'true'],
            ],
          ],
        ],
        paint: {
          'circle-color': DISCOVER_MAP_TERRITORY,
          'circle-radius': 4.5,
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': DISCOVER_MAP_BEIGE,
        },
      });
      map.addLayer({
        id: FEATURED_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: [
          'all',
          POINT_FILTER,
          [
            'any',
            ['==', ['get', 'featured'], true],
            ['==', ['get', 'featured'], 'true'],
          ],
        ],
        paint: {
          'circle-color': '#1a4a62',
          'circle-radius': 6.5,
          'circle-opacity': 0.95,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': DISCOVER_MAP_BEIGE,
        },
      });
    }

    fitPreview(map, fc);
  }, [mapReady, fc, geomModes]);

  const stamped = fc?.features.length ?? 0;
  const showOverlay = mapReady && !loadingFc;
  const empty = showOverlay && stamped === 0;

  return (
    <div
      className="relative w-full overflow-hidden border-b border-black/[0.08]"
      style={{
        // Visible frame height — Mapbox canvas below is taller by CROP_BOTTOM_REM.
        height: 'min(42vw, 280px)',
        minHeight: 180,
        backgroundColor: DISCOVER_MAP_BEIGE,
      }}
      data-discover-atlas-map=""
    >
      {/* Map canvas taller than the frame; bottom 2rem is cropped by overflow. */}
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

      {showOverlay && !empty && !error ? (
        <div className="pointer-events-none absolute left-3 top-3 z-[2] rounded-[12px] border border-black/[0.08] bg-[#f7f5f1]/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-muted">
            Preview
          </p>
          <p className="mt-0.5 text-[14px] font-bold tabular-nums leading-none text-foreground">
            {(truncated ? stamped : total).toLocaleString()}
            <span className="ml-1 text-[11px] font-semibold text-foreground-muted">
              {truncated ? `of ${total.toLocaleString()} · ${label}` : label}
            </span>
          </p>
        </div>
      ) : null}

      {empty || error ? (
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-4">
          <p className="text-[13px] font-medium text-foreground-muted">
            {error ? 'Couldn’t load map preview' : 'No locations to preview'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function fitPreview(map: MapboxMap, fc: FeatureCollection) {
  let union = null as ReturnType<typeof geometryLngLatBounds>;
  for (const f of fc.features) {
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

  // Extra bottom padding = cropped strip so geography centers in the visible frame.
  if (union) {
    map.fitBounds(boundsToMapbox(union), {
      padding: {
        top: 36,
        left: 28,
        right: 28,
        bottom: 24 + CROP_BOTTOM_PX,
      },
      maxZoom: 11.5,
      duration: 0,
    });
  } else {
    map.jumpTo({ center: MAP_CONFIG.DEFAULT_CENTER, zoom: 6.0 });
  }
  map.resize();
}
