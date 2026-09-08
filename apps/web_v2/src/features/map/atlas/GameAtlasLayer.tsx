'use client';

/**
 * Live atlas overlays on the game map — fill / line / circle from viewport bbox.
 * Streams via GET /api/atlas/features (atlas.features_in_bbox). Does not use
 * Discover's truncated collection_map_geojson preview.
 */

import { useEffect, useRef } from 'react';
import type { FeatureCollection } from 'geojson';
import type { FilterSpecification, Map as MapboxMap } from 'mapbox-gl';
import {
  GAME_ATLAS_COLLECTIONS,
  GAME_ATLAS_COLOR,
  GAME_ATLAS_COLOR_FEATURED,
  GAME_ATLAS_POINT_LAYER_IDS,
  GAME_ATLAS_POLYGON_LAYER_IDS,
  GAME_ATLAS_STROKE,
} from '@/features/map/atlas/gameAtlasCollections';
import { useGameAtlasEnabledSlugs } from '@/features/map/atlas/gameAtlasVisibilityStore';
import { useMapContext } from '@/map/MapProvider';
import { mapDataStore, MAP_SOURCE_IDS } from '@/map/data/MapDataStore';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
} from '@/map/engine/mapStyleGuard';

const SOURCE_ID = MAP_SOURCE_IDS.atlasFeatures;
const FILL_ID = GAME_ATLAS_POLYGON_LAYER_IDS[0];
const OUTLINE_ID = GAME_ATLAS_POLYGON_LAYER_IDS[1];
const LINE_ID = GAME_ATLAS_POLYGON_LAYER_IDS[2];
const POINT_ID = GAME_ATLAS_POINT_LAYER_IDS[0];
const FEATURED_ID = GAME_ATLAS_POINT_LAYER_IDS[1];

const LAYER_IDS = [
  FILL_ID,
  OUTLINE_ID,
  LINE_ID,
  POINT_ID,
  FEATURED_ID,
] as const;

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Data-driven color by collectionSlug (falls back to lake-blue). */
const COLLECTION_COLOR_EXPR = [
  'match',
  ['get', 'collectionSlug'],
  ...GAME_ATLAS_COLLECTIONS.flatMap((c) => [c.slug, c.color]),
  GAME_ATLAS_COLOR,
] as unknown as string;

const POLYGON_FILTER = [
  'any',
  ['==', ['geometry-type'], 'Polygon'],
  ['==', ['geometry-type'], 'MultiPolygon'],
] as FilterSpecification;

const LINE_FILTER = [
  'any',
  ['==', ['geometry-type'], 'LineString'],
  ['==', ['geometry-type'], 'MultiLineString'],
] as FilterSpecification;

const POINT_FILTER = [
  'any',
  ['==', ['geometry-type'], 'Point'],
  ['==', ['geometry-type'], 'MultiPoint'],
] as FilterSpecification;

const FETCH_DEBOUNCE_MS = 180;
/** Slight pad so edges don't pop as the camera settles. */
const BBOX_PAD_FRAC = 0.08;
/** Round bbox coords so micro camera settles don't re-hit the API. */
const BBOX_ROUND = 5;

type GeoJsonSource = {
  setData: (data: FeatureCollection) => void;
};

function ensureLayers(map: MapboxMap): void {
  if (!safeGetSource(map, SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: EMPTY_FC,
      promoteId: 'id',
    });
  }

  if (!safeGetLayer(map, FILL_ID)) {
    map.addLayer({
      id: FILL_ID,
      type: 'fill',
      source: SOURCE_ID,
      filter: POLYGON_FILTER,
      paint: {
        'fill-color': COLLECTION_COLOR_EXPR,
        'fill-opacity': 0.28,
      },
    });
  }

  if (!safeGetLayer(map, OUTLINE_ID)) {
    map.addLayer({
      id: OUTLINE_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: POLYGON_FILTER,
      paint: {
        'line-color': COLLECTION_COLOR_EXPR,
        'line-width': 1.35,
        'line-opacity': 0.9,
      },
    });
  }

  if (!safeGetLayer(map, LINE_ID)) {
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
        'line-color': COLLECTION_COLOR_EXPR,
        'line-width': 2.5,
        'line-opacity': 0.92,
      },
    });
  }

  if (!safeGetLayer(map, POINT_ID)) {
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
      ] as FilterSpecification,
      paint: {
        'circle-color': COLLECTION_COLOR_EXPR,
        'circle-radius': 5,
        'circle-opacity': 0.88,
        'circle-stroke-width': 1.25,
        'circle-stroke-color': GAME_ATLAS_STROKE,
      },
    });
  }

  if (!safeGetLayer(map, FEATURED_ID)) {
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
      ] as FilterSpecification,
      paint: {
        'circle-color': GAME_ATLAS_COLOR_FEATURED,
        'circle-radius': 6.5,
        'circle-opacity': 0.95,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': GAME_ATLAS_STROKE,
      },
    });
  }
}

function setSourceData(map: MapboxMap, fc: FeatureCollection): void {
  const src = safeGetSource(map, SOURCE_ID) as GeoJsonSource | undefined;
  src?.setData?.(fc);
  // Mirror into MapDataStore so dock focus / camera can resolve by id.
  mapDataStore.set(SOURCE_ID, fc);
}

function teardown(map: MapboxMap): void {
  for (const id of [...LAYER_IDS].reverse()) {
    if (safeGetLayer(map, id)) {
      try {
        map.removeLayer(id);
      } catch {
        /* mid-reload */
      }
    }
  }
  if (safeGetSource(map, SOURCE_ID)) {
    try {
      map.removeSource(SOURCE_ID);
    } catch {
      /* mid-reload */
    }
  }
  mapDataStore.clear(SOURCE_ID);
}

function paddedBbox(map: MapboxMap): string | null {
  try {
    const b = map.getBounds();
    if (!b) return null;
    const west = b.getWest();
    const south = b.getSouth();
    const east = b.getEast();
    const north = b.getNorth();
    const padX = (east - west) * BBOX_PAD_FRAC;
    const padY = (north - south) * BBOX_PAD_FRAC;
    return `${west - padX},${south - padY},${east + padX},${north + padY}`;
  } catch {
    return null;
  }
}

/**
 * Mounts Mapbox atlas layers and streams features for the current viewport
 * whenever the camera settles or enabled collections change.
 */
export function GameAtlasLayer() {
  const { map, ready } = useMapContext();
  const enabledSlugs = useGameAtlasEnabledSlugs();
  const slugsKey = enabledSlugs.join(',');
  const slugsRef = useRef(enabledSlugs);
  slugsRef.current = enabledSlugs;
  const scheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let abort: AbortController | null = null;
    let fetchSeq = 0;
    let lastFetchKey: string | null = null;

    const clearSource = () => {
      if (!isMapStyleReady(map)) return;
      try {
        ensureLayers(map);
        setSourceData(map, EMPTY_FC);
      } catch {
        /* ignore */
      }
    };

    const normalizeBbox = (bbox: string): string =>
      bbox
        .split(',')
        .map((n) => Number(n).toFixed(BBOX_ROUND))
        .join(',');

    const fetchViewport = async () => {
      if (cancelled || !isMapStyleReady(map)) return;

      const slugs = slugsRef.current;
      if (slugs.length === 0) {
        clearSource();
        lastFetchKey = null;
        return;
      }

      const bbox = paddedBbox(map);
      if (!bbox) return;

      const fetchKey = `${normalizeBbox(bbox)}|${slugs.join(',')}`;
      if (fetchKey === lastFetchKey) return;

      abort?.abort();
      const controller = new AbortController();
      abort = controller;
      const seq = ++fetchSeq;

      try {
        ensureLayers(map);
        const params = new URLSearchParams({
          bbox,
          collections: slugs.join(','),
        });
        const res = await fetch(`/api/atlas/features?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`atlas features ${res.status}`);
        const json = (await res.json()) as FeatureCollection;
        if (cancelled || seq !== fetchSeq) return;
        if (!isMapStyleReady(map)) return;
        lastFetchKey = fetchKey;
        ensureLayers(map);
        setSourceData(map, {
          type: 'FeatureCollection',
          features: Array.isArray(json.features) ? json.features : [],
        });
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        console.warn('[GameAtlasLayer] fetch failed', err);
      }
    };

    const scheduleFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void fetchViewport();
      }, FETCH_DEBOUNCE_MS);
    };
    scheduleRef.current = scheduleFetch;

    const onMoveEnd = () => scheduleFetch();
    const onStyle = () => {
      if (cancelled || !isMapStyleReady(map)) return;
      try {
        lastFetchKey = null;
        ensureLayers(map);
        scheduleFetch();
      } catch {
        /* ignore */
      }
    };

    try {
      ensureLayers(map);
      scheduleFetch();
    } catch {
      /* style not ready yet */
    }

    map.on('moveend', onMoveEnd);
    map.on('style.load', onStyle);

    return () => {
      cancelled = true;
      scheduleRef.current = null;
      if (debounceTimer) clearTimeout(debounceTimer);
      abort?.abort();
      map.off('moveend', onMoveEnd);
      map.off('style.load', onStyle);
      teardown(map);
    };
  }, [map, ready]);

  // Collection toggles — refetch without tearing down map listeners.
  useEffect(() => {
    scheduleRef.current?.();
  }, [slugsKey]);

  return null;
}
