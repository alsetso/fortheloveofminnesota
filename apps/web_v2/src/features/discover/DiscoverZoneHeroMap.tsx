'use client';

/**
 * Discover zone hero — streets Standard, pitched street frame,
 * zone + sub-zone perimeter outlines, live 3D world models.
 *
 * Bottom 2rem of the Mapbox canvas is cropped (same as other Discover maps)
 * so attribution / logo sit out of frame.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Map as MapboxMap } from 'mapbox-gl';
import { MapProvider, useMapBuildings3D, useMapContext, useMapEngine } from '@/map';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { waitForMapStyleReady } from '@/map/engine/mapStyleGuard';
import {
  boundsToMapbox,
  geometryLngLatBounds,
  unionLngLatBounds,
  type LngLatBoundsBox,
} from '@/map/geo/geometryLngLatBounds';
import { WORLD_LOD_3D_MIN_ZOOM } from '@/features/map/game/world/catalog';
import { loadWorldCatalog } from '@/features/map/game/world/catalogPersist';
import { getWorldCatalog } from '@/features/map/game/world/catalogStore';
import { loadElementTypes } from '@/features/map/game/world/elementTypesPersist';
import {
  applyElementTypeColorsToMap,
  ensureWorldPlacementLayers,
  removeWorldPlacementLayers,
  stopWorldPlacementPulse,
} from '@/features/map/game/world/ensurePlacementLayers';
import {
  getWorldPlacementsRaw,
  getWorldPlacementsSnapshot,
  rebuildWorldPlacementFeatures,
  setWorldPlacements,
  type WorldPlacementRaw,
} from '@/features/map/game/world/placementsStore';
import {
  isAbortError,
  type ExperienceZoneSubZone,
} from '@/lib/experienceZones/fetchExperienceZoneDetail';
import { createGameRenderService } from '@/services/game';
import { IconRefresh } from '@/features/map/dockCore/core/icons';

/** Legacy layer / source ids — removed on upgrade. */
const LEGACY_LAYER_IDS = [
  'discover-zone-hero-fill',
  'discover-zone-hero-line',
  'discover-zone-hero-line-glow',
  'discover-zone-hero-line-core',
  'discover-zone-hero-wall-extrusion',
  'discover-zone-hero-wall-cap-line',
] as const;

const ZONE_BOUNDARY_SOURCE = 'discover-zone-hero-boundary-line';
const ZONE_FILL_SOURCE = 'discover-zone-hero-boundary-fill';
const SUBZONE_BOUNDARY_SOURCE = 'discover-zone-hero-subzone-lines';
const SUBZONE_FILL_SOURCE = 'discover-zone-hero-subzone-fill';
const ZONE_FILL_LAYER = 'discover-zone-hero-fill';
const ZONE_LINE_HALO = 'discover-zone-hero-line-halo';
const ZONE_LINE_BODY = 'discover-zone-hero-line-body';
const ZONE_LINE_EDGE = 'discover-zone-hero-line-edge';
const SUBZONE_FILL_LAYER = 'discover-zone-hero-subzone-fill';
const SUBZONE_LINE_BODY = 'discover-zone-hero-subzone-line';
const SUBZONE_LINE_EDGE = 'discover-zone-hero-subzone-edge';

/** Match game-map experience zone paint (violet-500 fill, violet-400 line). */
const ZONE_FILL_COLOR = '#8B5CF6';
const ZONE_LINE_COLOR = '#A78BFA';
const ZONE_EDGE_COLOR = '#7C3AED';
const SUBZONE_FILL_COLOR = '#C4B5FD';
const SUBZONE_LINE_COLOR = '#EDE9FE';
const SUBZONE_EDGE_COLOR = '#C4B5FD';

/** Keep the camera inside the zone (+ padding). */
const VIEWPORT_PAD_M = 60;

function standardBottomSlot(map: MapboxMap): { slot?: 'bottom' } {
  return mapUsesMapboxStandard(map) ? { slot: 'bottom' } : {};
}

type Position = [number, number];

function polygonFillFromGeometries(
  geometries: Array<Polygon | MultiPolygon>,
  idPrefix: string,
): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  let index = 0;

  for (const geometry of geometries) {
    features.push({
      type: 'Feature',
      id: `${idPrefix}-${index}`,
      properties: {},
      geometry,
    });
    index += 1;
  }

  return { type: 'FeatureCollection', features };
}

function outlineLinesFromGeometries(
  geometries: Array<Polygon | MultiPolygon>,
  idPrefix: string,
): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  let index = 0;

  for (const geometry of geometries) {
    const polys: Polygon[] =
      geometry.type === 'Polygon'
        ? [geometry]
        : geometry.coordinates.map(
            (coords) => ({ type: 'Polygon' as const, coordinates: coords }),
          );

    for (const poly of polys) {
      features.push({
        type: 'Feature',
        id: `${idPrefix}-${index}`,
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: poly.coordinates[0] as Position[],
        },
      });
      index += 1;
    }
  }

  return { type: 'FeatureCollection', features };
}

function maxBoundsForBox(
  box: LngLatBoundsBox,
  padM: number,
): [[number, number], [number, number]] | null {
  const latRad = (((box.minLat + box.maxLat) / 2) * Math.PI) / 180;
  const padLat = padM / 111_320;
  const padLng = padM / (111_320 * Math.cos(latRad));
  return [
    [box.minLng - padLng, box.minLat - padLat],
    [box.maxLng + padLng, box.maxLat + padLat],
  ];
}

function removeLegacyZoneLayers(map: MapboxMap): void {
  for (const id of LEGACY_LAYER_IDS) {
    try {
      if (map.getLayer(id)) map.removeLayer(id);
    } catch {
      /* style swap */
    }
  }
  for (const sourceId of [
    'discover-zone-hero-wall',
    'discover-zone-hero-wall-cap',
    'discover-zone-hero-boundary',
  ]) {
    try {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch {
      /* style swap */
    }
  }
}

function upsertGeoJsonSource(
  map: MapboxMap,
  sourceId: string,
  data: FeatureCollection,
): void {
  const src = map.getSource(sourceId) as
    | { setData: (data: FeatureCollection) => void }
    | undefined;
  if (src) {
    src.setData(data);
  } else {
    map.addSource(sourceId, { type: 'geojson', data });
  }
}

function ensureZoneBoundary(
  map: MapboxMap,
  geometry: Polygon | MultiPolygon,
): void {
  removeLegacyZoneLayers(map);
  upsertGeoJsonSource(
    map,
    ZONE_FILL_SOURCE,
    polygonFillFromGeometries([geometry], 'zone-fill'),
  );
  upsertGeoJsonSource(map, ZONE_BOUNDARY_SOURCE, outlineLinesFromGeometries([geometry], 'zone'));

  const bottom = standardBottomSlot(map);
  const lineLayout = {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
  };

  if (!map.getLayer(ZONE_FILL_LAYER)) {
    map.addLayer({
      id: ZONE_FILL_LAYER,
      type: 'fill',
      source: ZONE_FILL_SOURCE,
      paint: {
        'fill-color': ZONE_FILL_COLOR,
        'fill-opacity': 0.2,
        'fill-antialias': true,
      },
      ...bottom,
    });
  }

  if (!map.getLayer(ZONE_LINE_HALO)) {
    map.addLayer({
      id: ZONE_LINE_HALO,
      type: 'line',
      source: ZONE_BOUNDARY_SOURCE,
      layout: lineLayout,
      paint: {
        'line-color': ZONE_LINE_COLOR,
        'line-width': 10,
        'line-blur': 1.5,
        'line-opacity': 0.35,
      },
      ...bottom,
    });
  }

  if (!map.getLayer(ZONE_LINE_BODY)) {
    map.addLayer({
      id: ZONE_LINE_BODY,
      type: 'line',
      source: ZONE_BOUNDARY_SOURCE,
      layout: lineLayout,
      paint: {
        'line-color': ZONE_LINE_COLOR,
        'line-width': 3.5,
        'line-opacity': 0.95,
      },
      ...bottom,
    });
  }

  if (!map.getLayer(ZONE_LINE_EDGE)) {
    map.addLayer({
      id: ZONE_LINE_EDGE,
      type: 'line',
      source: ZONE_BOUNDARY_SOURCE,
      layout: lineLayout,
      paint: {
        'line-color': ZONE_EDGE_COLOR,
        'line-width': 1.75,
        'line-opacity': 1,
      },
      ...bottom,
    });
  }
}

function ensureSubZoneBoundaries(
  map: MapboxMap,
  subZones: ExperienceZoneSubZone[],
): void {
  const geometries = subZones
    .map((z) => z.geometry)
    .filter((g): g is Polygon | MultiPolygon => Boolean(g));

  if (geometries.length === 0) {
    try {
      if (map.getLayer(SUBZONE_FILL_LAYER)) map.removeLayer(SUBZONE_FILL_LAYER);
      if (map.getLayer(SUBZONE_LINE_EDGE)) map.removeLayer(SUBZONE_LINE_EDGE);
      if (map.getLayer(SUBZONE_LINE_BODY)) map.removeLayer(SUBZONE_LINE_BODY);
      if (map.getSource(SUBZONE_FILL_SOURCE)) map.removeSource(SUBZONE_FILL_SOURCE);
      if (map.getSource(SUBZONE_BOUNDARY_SOURCE)) map.removeSource(SUBZONE_BOUNDARY_SOURCE);
    } catch {
      /* style swap */
    }
    return;
  }

  upsertGeoJsonSource(
    map,
    SUBZONE_FILL_SOURCE,
    polygonFillFromGeometries(geometries, 'subzone-fill'),
  );
  upsertGeoJsonSource(
    map,
    SUBZONE_BOUNDARY_SOURCE,
    outlineLinesFromGeometries(geometries, 'subzone'),
  );

  const bottom = standardBottomSlot(map);
  const lineLayout = {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
    'line-dasharray': [2, 1.5] as [number, number],
  };

  if (!map.getLayer(SUBZONE_FILL_LAYER)) {
    map.addLayer({
      id: SUBZONE_FILL_LAYER,
      type: 'fill',
      source: SUBZONE_FILL_SOURCE,
      paint: {
        'fill-color': SUBZONE_FILL_COLOR,
        'fill-opacity': 0.1,
        'fill-antialias': true,
      },
      ...bottom,
    });
  }

  if (!map.getLayer(SUBZONE_LINE_BODY)) {
    map.addLayer({
      id: SUBZONE_LINE_BODY,
      type: 'line',
      source: SUBZONE_BOUNDARY_SOURCE,
      layout: lineLayout,
      paint: {
        'line-color': SUBZONE_LINE_COLOR,
        'line-width': 2.5,
        'line-opacity': 0.85,
      },
      ...bottom,
    });
  }

  if (!map.getLayer(SUBZONE_LINE_EDGE)) {
    map.addLayer({
      id: SUBZONE_LINE_EDGE,
      type: 'line',
      source: SUBZONE_BOUNDARY_SOURCE,
      layout: {
        'line-cap': 'round' as const,
        'line-join': 'round' as const,
      },
      paint: {
        'line-color': SUBZONE_EDGE_COLOR,
        'line-width': 1.25,
        'line-opacity': 0.95,
      },
      ...bottom,
    });
  }
}

function lockCameraToZone(map: MapboxMap, box: LngLatBoundsBox): void {
  const bounds = maxBoundsForBox(box, VIEWPORT_PAD_M);
  if (bounds) map.setMaxBounds(bounds);
}

/** Visible frame crops this much off the bottom of the Mapbox canvas. */
const CROP_BOTTOM_REM = 2;
const CROP_BOTTOM_PX = CROP_BOTTOM_REM * 16;

const HERO_PITCH = 56;
const HERO_BEARING = 18;
const HERO_STREET_ZOOM = 16.5;
const HERO_FIT_MAX_ZOOM = 17.5;
const HERO_MIN_ZOOM = WORLD_LOD_3D_MIN_ZOOM;
const HERO_MAX_ZOOM = 20;

const FIT_PADDING = {
  top: 48,
  left: 36,
  right: 36,
  bottom: 48 + CROP_BOTTOM_PX,
};

function clampHeroZoom(map: MapboxMap): void {
  if (map.getZoom() < HERO_MIN_ZOOM) {
    map.setZoom(HERO_STREET_ZOOM);
  }
}

function fitBoundsBox(map: MapboxMap, box: LngLatBoundsBox): void {
  map.fitBounds(boundsToMapbox(box), {
    padding: FIT_PADDING,
    maxZoom: HERO_FIT_MAX_ZOOM,
    pitch: HERO_PITCH,
    bearing: HERO_BEARING,
    duration: 0,
    essential: true,
  });
  clampHeroZoom(map);
}

function fitZoneCamera(map: MapboxMap, box: LngLatBoundsBox): void {
  fitBoundsBox(map, box);
}

function boundsFromPlacements(placements: WorldPlacementRaw[]): LngLatBoundsBox | null {
  if (placements.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of placements) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    minLng = Math.min(minLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLng = Math.max(maxLng, p.lng);
    maxLat = Math.max(maxLat, p.lat);
  }
  if (!Number.isFinite(minLng)) return null;
  if (Math.abs(maxLng - minLng) < 1e-6 && Math.abs(maxLat - minLat) < 1e-6) {
    const pad = 0.0015;
    return {
      minLng: minLng - pad,
      maxLng: maxLng + pad,
      minLat: minLat - pad,
      maxLat: maxLat + pad,
    };
  }
  return { minLng, minLat, maxLng, maxLat };
}

type PlacementDto = {
  id: string;
  lat: number;
  lng: number;
  kind?: string;
  slug?: string;
  scaleMultiplier?: number | null;
  rotationZ?: number | null;
  altitudeMeters?: number | null;
  overrides?: Record<string, unknown> | null;
};

function mapPlacementDto(list: PlacementDto[]): WorldPlacementRaw[] {
  return list.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    kind: (p.slug || p.kind || '') as WorldPlacementRaw['kind'],
    scaleMultiplier: p.scaleMultiplier ?? 1,
    rotationZ: p.rotationZ ?? null,
    altitudeMeters: p.altitudeMeters ?? null,
    overrides: p.overrides ?? null,
  }));
}

/** Discover hero — zone-tagged placements (skips CTU; parent + sub-zones). */
async function fetchDiscoverZonePlacements(
  zoneId: string,
  subZones: ExperienceZoneSubZone[],
  signal: AbortSignal,
): Promise<WorldPlacementRaw[]> {
  const zoneIds = [zoneId, ...subZones.map((z) => z.id)];
  const byId = new Map<string, WorldPlacementRaw>();

  for (const id of zoneIds) {
    const params = new URLSearchParams({
      zonePreview: '1',
      experienceZoneId: id,
    });
    const res = await fetch(`/api/world/placements?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `[discover-zone-hero] placements ${res.status} zone=${id} ${body.slice(0, 120)}`,
      );
    }
    const json = (await res.json()) as { placements?: PlacementDto[] };
    for (const placement of mapPlacementDto(json.placements ?? [])) {
      byId.set(placement.id, placement);
    }
  }

  return [...byId.values()];
}

async function waitForMapIdle(map: MapboxMap, timeoutMs = 900): Promise<void> {
  await new Promise<void>((resolve) => {
    const done = () => {
      map.off('idle', done);
      resolve();
    };
    map.once('idle', done);
    window.setTimeout(done, timeoutMs);
  });
}

function sceneBounds(
  geometry: Polygon | MultiPolygon,
  subZones: ExperienceZoneSubZone[],
): LngLatBoundsBox | null {
  const subBoxes = subZones
    .map((z) => (z.geometry ? geometryLngLatBounds(z.geometry) : null))
    .filter(Boolean);
  return unionLngLatBounds(geometryLngLatBounds(geometry), ...subBoxes);
}

function applyZoneScene(
  map: MapboxMap,
  geometry: Polygon | MultiPolygon,
  subZones: ExperienceZoneSubZone[],
  opts?: { fit?: boolean; fitBox?: LngLatBoundsBox | null },
): void {
  const envelope = sceneBounds(geometry, subZones);
  ensureZoneBoundary(map, geometry);
  ensureSubZoneBoundaries(map, subZones);
  if (envelope) lockCameraToZone(map, envelope);
  if (opts?.fit) {
    const target = opts.fitBox ?? envelope;
    if (target) fitZoneCamera(map, target);
  }
}

function DiscoverZoneHeroLayers({
  zoneId,
  geometry,
  subZones,
  refreshKey,
  onRefreshingChange,
}: {
  zoneId: string;
  name: string;
  geometry: Polygon | MultiPolygon;
  subZones: ExperienceZoneSubZone[];
  refreshKey: number;
  onRefreshingChange?: (refreshing: boolean) => void;
}) {
  useMapBuildings3D(true);
  const { map, ready } = useMapContext();
  const renderSvcRef = useRef(createGameRenderService());
  const refreshPlacementsRef = useRef<
    (opts?: { refit?: boolean }) => Promise<void>
  >(async () => {});

  // Pan / rotate / zoom within maxBounds — pitch gestures off
  useEffect(() => {
    if (!map || !ready) return;
    map.dragPan.enable();
    map.dragRotate.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.touchPitch.disable();
    map.keyboard.enable();
  }, [map, ready]);

  // Scene + placements — single orchestrated hydrate (matches game map lifecycle)
  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    const ac = new AbortController();
    let seq = 0;

    const renderSvc = renderSvcRef.current;

    const paintScene = (opts?: { fit?: boolean; fitBox?: LngLatBoundsBox | null }) => {
      if (cancelled) return;
      try {
        applyZoneScene(map, geometry, subZones, opts);
        map.resize();
      } catch {
        /* style swap */
      }
    };

    const reapplyWorldModels = () => {
      if (cancelled) return;
      rebuildWorldPlacementFeatures();
      renderSvc.init(map, getWorldCatalog());
      applyElementTypeColorsToMap(map);
      renderSvc.repaint(getWorldPlacementsRaw());
      ensureWorldPlacementLayers(map, getWorldPlacementsSnapshot());
      applyElementTypeColorsToMap(map);
    };

    const syncPlacements = async (
      my: number,
      signal: AbortSignal,
      opts?: { refit?: boolean },
    ): Promise<void> => {
      const raw = await fetchDiscoverZonePlacements(zoneId, subZones, signal);
      if (cancelled || my !== seq || signal.aborted) return;

      setWorldPlacements(raw);
      rebuildWorldPlacementFeatures();

      if (opts?.refit) {
        const placementBox = boundsFromPlacements(raw);
        if (placementBox) {
          paintScene({ fit: true, fitBox: placementBox });
        }
      }

      reapplyWorldModels();

      await waitForMapStyleReady(map, { timeoutMs: 8_000, signal });
      if (cancelled || my !== seq || signal.aborted) return;

      await waitForMapIdle(map);
      if (cancelled || my !== seq || signal.aborted) return;

      reapplyWorldModels();

      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[discover-zone-hero] zone=${zoneId} models=${getWorldCatalog().length} placements=${raw.length}`,
        );
      }
    };

    refreshPlacementsRef.current = async (opts) => {
      const my = ++seq;
      await syncPlacements(my, ac.signal, opts);
    };

    const hydrate = () => {
      const my = ++seq;
      void (async () => {
        try {
          await waitForMapStyleReady(map, { timeoutMs: 12_000, signal: ac.signal });
          if (cancelled || my !== seq || ac.signal.aborted) return;

          const envelope = sceneBounds(geometry, subZones);
          paintScene({ fit: true, fitBox: envelope });

          await Promise.all([loadWorldCatalog(true), loadElementTypes()]);
          if (cancelled || my !== seq || ac.signal.aborted) return;

          await syncPlacements(my, ac.signal, { refit: true });
        } catch (err) {
          if (isAbortError(err) || cancelled || ac.signal.aborted) return;
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[discover-zone-hero] hydrate failed', err);
          }
        }
      })();
    };

    hydrate();
    const onStyleLoad = () => {
      paintScene();
      if (getWorldPlacementsRaw().length > 0) {
        reapplyWorldModels();
      }
    };
    map.on('style.load', onStyleLoad);

    return () => {
      cancelled = true;
      ac.abort();
      refreshPlacementsRef.current = async () => {};
      map.off('style.load', onStyleLoad);
      stopWorldPlacementPulse();
      try {
        renderSvc.teardown();
        removeWorldPlacementLayers(map);
      } catch {
        /* teardown race */
      }
      renderSvcRef.current = createGameRenderService();
      setWorldPlacements([]);
      try {
        (map as MapboxMap & { setMaxBounds: (b: null) => void }).setMaxBounds(null);
      } catch {
        /* removed map */
      }
    };
  }, [map, ready, zoneId, geometry, subZones]);

  useEffect(() => {
    if (refreshKey === 0 || !map || !ready) return;

    let active = true;
    onRefreshingChange?.(true);
    void (async () => {
      try {
        await Promise.all([loadWorldCatalog(true), loadElementTypes()]);
        if (!active) return;
        await refreshPlacementsRef.current({ refit: false });
      } catch (err) {
        if (!isAbortError(err) && process.env.NODE_ENV !== 'production') {
          console.warn('[discover-zone-hero] refresh failed', err);
        }
      } finally {
        if (active) onRefreshingChange?.(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshKey, map, ready, onRefreshingChange]);

  return null;
}

export function DiscoverZoneHeroMap({
  zoneId,
  name,
  geometry,
  subZones = [],
}: {
  zoneId: string;
  name: string;
  geometry: Polygon | MultiPolygon;
  subZones?: ExperienceZoneSubZone[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const center = useMemo((): [number, number] => {
    const box = sceneBounds(geometry, subZones);
    if (!box) return [-93.265, 44.9778];
    return [(box.minLng + box.maxLng) / 2, (box.minLat + box.maxLat) / 2];
  }, [geometry, subZones]);

  const { map, ready, error } = useMapEngine({
    containerRef,
    styleId: 'streets',
    center,
    zoom: HERO_STREET_ZOOM,
    pitch: HERO_PITCH,
    bearing: HERO_BEARING,
    maxPitch: 85,
    minZoom: HERO_MIN_ZOOM,
    maxZoom: HERO_MAX_ZOOM,
    skipFindMeBoot: true,
    restrictToMinnesota: false,
  });

  const [booted, setBooted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshingChange = useCallback((busy: boolean) => {
    setRefreshing(busy);
  }, []);

  useEffect(() => {
    if (ready) setBooted(true);
  }, [ready]);

  return (
    <div className="relative h-[min(52vh,420px)] w-full overflow-hidden bg-[#1a1c20]">
      <div
        ref={containerRef}
        className="absolute inset-x-0 top-0 w-full"
        style={{ height: `calc(100% + ${CROP_BOTTOM_REM}rem)` }}
      />
      <MapProvider map={map} ready={ready}>
        <DiscoverZoneHeroLayers
          zoneId={zoneId}
          name={name}
          geometry={geometry}
          subZones={subZones}
          refreshKey={refreshKey}
          onRefreshingChange={handleRefreshingChange}
        />
      </MapProvider>
      {booted ? (
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={refreshing}
          aria-label="Refresh placements"
          className="absolute right-3 top-3 z-[3] flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-lg backdrop-blur-sm transition active:scale-95 disabled:opacity-60"
        >
          <IconRefresh
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
        </button>
      ) : null}
      {!booted ? (
        <div className="absolute inset-0 z-[1] animate-pulse bg-[#2a2d33]" />
      ) : null}
      {error ? (
        <div className="absolute inset-x-0 bottom-0 z-[2] bg-black/55 px-4 py-2 text-[12px] text-white/90">
          Map unavailable
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#f7f5f1] to-transparent" />
    </div>
  );
}
