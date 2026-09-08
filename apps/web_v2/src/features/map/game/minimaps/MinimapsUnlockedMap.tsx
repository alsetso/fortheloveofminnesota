'use client';

/**
 * Unlocked pane — passport map of stamped territories.
 * Loads the cities-and-towns layer (explore-map default) and keeps only
 * units the account has unlocked, then fits the camera to that union.
 *
 * Features:
 * - Loading skeleton while the map initializes
 * - Hover highlight on polygon hover (desktop)
 * - Click to focus a territory (fires openToTerritory)
 * - Focused territory polygon gets a selected-state highlight
 * - Camera fits to focused polygon via a separate effect
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MapMouseEvent, MapTouchEvent } from 'mapbox-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map as MapboxMap } from 'mapbox-gl';
import { useAuthSafe } from '@/features/auth';
import { usePassport } from '@/features/accountTerritories/store/usePassport';
import { OBJECT_RADAR_MAP_STYLE } from '@/features/map/game/objectRadar/constants';
import { darkenObjectRadarStyle } from '@/features/map/game/objectRadar/services/darkenObjectRadarStyle';
import { MINIMAPS_NAV_CLEARANCE } from '@/features/map/game/minimaps/minimapsTabs';
import {
  objectRadarActions,
  useObjectRadarStore,
} from '@/features/map/game/objectRadar/objectRadarStore';
import { MAP_CONFIG } from '@/map/config';
import { loadMapboxGL } from '@/map/engine/mapboxLoader';
import {
  boundsToMapbox,
  geometryLngLatBounds,
} from '@/map/geo/geometryLngLatBounds';
import { safePadTop } from '@/lib/despia/safeArea';

const SOURCE_ID = 'minimaps-unlocked';
const FILL_ID = 'minimaps-unlocked-fill';
const FILL_SELECTED_ID = 'minimaps-unlocked-fill-selected';
const LINE_ID = 'minimaps-unlocked-line';
const LABEL_ID = 'minimaps-unlocked-label';

type GeoJsonSource = { setData: (data: FeatureCollection) => void };

function featureId(f: Feature): string {
  return String(f.id ?? f.properties?.id ?? '');
}

export function MinimapsUnlockedMap() {
  const { account } = useAuthSafe();
  const { passport, loading } = usePassport(account?.id ?? null);
  const { focusedTerritory } = useObjectRadarStore();
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const hoveredIdRef = useRef<string | number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layerFc, setLayerFc] = useState<FeatureCollection | null>(null);
  const [layerError, setLayerError] = useState(false);

  const unlockedCtuIds = useMemo(() => {
    const ids = new Set<string>();
    for (const u of passport?.unlocked ?? []) {
      if (u.unitKind === 'ctu' && u.unitId) ids.add(String(u.unitId));
    }
    return ids;
  }, [passport?.unlocked]);

  const unlockedFc = useMemo<FeatureCollection>(() => {
    const features = (layerFc?.features ?? []).filter((f) =>
      unlockedCtuIds.has(featureId(f)),
    );
    return { type: 'FeatureCollection', features };
  }, [layerFc, unlockedCtuIds]);

  const ctuKind = passport?.kinds.find((k) => k.unitKind === 'ctu') ?? null;
  const stamped = unlockedCtuIds.size;
  const total = ctuKind?.total ?? 0;

  // Fetch boundaries layer
  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/territory/layers/cities-and-towns/boundaries', {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error('boundaries');
        const body = (await res.json()) as FeatureCollection;
        if (!ac.signal.aborted) {
          setLayerFc(body);
          setLayerError(false);
        }
      } catch {
        if (!ac.signal.aborted) setLayerError(true);
      }
    })();
    return () => ac.abort();
  }, []);

  // Initialize Mapbox map + attach hover/click interaction handlers
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
          style: OBJECT_RADAR_MAP_STYLE,
          center: MAP_CONFIG.DEFAULT_CENTER,
          zoom: 7,
          pitch: 0,
          interactive: true,
          attributionControl: false,
          fadeDuration: 0,
          dragRotate: false,
          touchPitch: false,
          pitchWithRotate: false,
        });
        await new Promise<void>((resolve) => {
          if (!map) { resolve(); return; }
          if (map.isStyleLoaded()) { resolve(); return; }
          map.once('load', () => resolve());
        });
        if (cancelled || !map) return;
        darkenObjectRadarStyle(map);

        // ── Hover handlers (pointer devices) ─────────────────────────
        const onMouseMove = (e: MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
          if (!e.features?.length) return;
          const id = e.features[0].id;
          if (id == null) return;
          if (hoveredIdRef.current != null && hoveredIdRef.current !== id) {
            map!.setFeatureState({ source: SOURCE_ID, id: hoveredIdRef.current }, { hover: false });
          }
          hoveredIdRef.current = id;
          map!.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
          map!.getCanvas().style.cursor = 'pointer';
        };

        const onMouseLeave = () => {
          if (hoveredIdRef.current != null) {
            map!.setFeatureState({ source: SOURCE_ID, id: hoveredIdRef.current }, { hover: false });
            hoveredIdRef.current = null;
          }
          map!.getCanvas().style.cursor = '';
        };

        // ── Click / touch handlers ────────────────────────────────────
        const onFeatureClick = (e: (MapMouseEvent | MapTouchEvent) & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
          if (!e.features?.length) return;
          const feat = e.features[0];
          const props = feat.properties ?? {};
          const id = String(feat.id ?? props.id ?? '');
          const name = (props.name as string | undefined) ?? (props.feature_name as string | undefined) ?? id;
          if (!id) return;
          objectRadarActions.openToTerritory({
            id,
            kind: 'ctu',
            title: name,
            kindLabel: 'City / Township',
          });
        };

        map.on('mousemove', FILL_ID, onMouseMove);
        map.on('mouseleave', FILL_ID, onMouseLeave);
        map.on('click', FILL_ID, onFeatureClick);

        mapRef.current = map;
        setMapReady(true);
        map.resize();
      } catch {
        /* unlocked map is best-effort */
      }
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  // Update GeoJSON source and fit camera to full unlocked set (or skip if territory focused)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const src = map.getSource(SOURCE_ID) as GeoJsonSource | undefined;
    if (src) {
      src.setData(unlockedFc);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: unlockedFc, promoteId: 'id' });

      // Base fill with hover + selected feature-state driven opacity
      map.addLayer({
        id: FILL_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#5BA3FF',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 0.50,
            ['boolean', ['feature-state', 'hover'], false], 0.42,
            0.26,
          ],
        },
      });

      // Brighter line when selected or hovered
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], '#A8D4FF',
            '#8EC5FF',
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 2.5,
            1.75,
          ],
          'line-opacity': 0.95,
        },
      });

      map.addLayer({
        id: LABEL_ID,
        type: 'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ['get', 'feature_name'], ''],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#E8F3FF',
          'text-halo-color': 'rgba(5,6,8,0.85)',
          'text-halo-width': 1.25,
        },
      });
    }

    if (focusedTerritory) {
      map.resize();
      return;
    }

    let union = null as ReturnType<typeof geometryLngLatBounds>;
    for (const f of unlockedFc.features) {
      const box = geometryLngLatBounds(f.geometry as Geometry);
      if (!box) continue;
      if (!union) { union = { ...box }; continue; }
      union = {
        minLng: Math.min(union.minLng, box.minLng),
        minLat: Math.min(union.minLat, box.minLat),
        maxLng: Math.max(union.maxLng, box.maxLng),
        maxLat: Math.max(union.maxLat, box.maxLat),
      };
    }
    if (union) {
      map.fitBounds(boundsToMapbox(union), {
        padding: { top: 88, left: 28, right: 28, bottom: 120 },
        maxZoom: 11.5,
        duration: 420,
      });
    } else {
      map.jumpTo({ center: MAP_CONFIG.DEFAULT_CENTER, zoom: 6.2 });
    }
    map.resize();
  }, [mapReady, unlockedFc, focusedTerritory]);

  // Update selected feature-state when focusedTerritory changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear all selections first (Mapbox doesn't have a removeAllFeatureStates for a source easily)
    // We track via the unlockedFc feature ids
    for (const f of unlockedFc.features) {
      const id = f.id ?? f.properties?.id;
      if (id != null) {
        map.setFeatureState({ source: SOURCE_ID, id }, { selected: false });
      }
    }

    if (focusedTerritory) {
      // Find by id — feature.id is the promoteId value
      const feat = unlockedFc.features.find((f) => featureId(f) === focusedTerritory.id);
      if (feat?.id != null) {
        map.setFeatureState({ source: SOURCE_ID, id: feat.id }, { selected: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, focusedTerritory?.id, unlockedFc]);

  // Fit camera to focused territory polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusedTerritory) return;

    const feat = unlockedFc.features.find((f) => featureId(f) === focusedTerritory.id);
    if (!feat) return;
    const box = geometryLngLatBounds(feat.geometry as Geometry);
    if (!box) return;

    map.fitBounds(boundsToMapbox(box), {
      padding: { top: 80, left: 32, right: 32, bottom: 256 },
      maxZoom: 13.5,
      duration: 500,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, focusedTerritory?.id]);

  const empty = !loading && stamped === 0;
  const isLoading = !mapReady || (!layerFc && !layerError);

  return (
    <div className="relative min-h-0 flex-1" data-minimaps="unlocked">
      <div ref={hostRef} className="absolute inset-0" />

      {/* ── Loading skeleton ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#050608]">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#5BA3FF]" />
            <p className="text-[12px] font-medium text-white/35">Loading passport map</p>
          </div>
          {/* Skeleton polygon shapes */}
          <div className="absolute inset-0 overflow-hidden opacity-30">
            <div className="absolute left-[20%] top-[30%] h-12 w-20 animate-pulse rounded-lg bg-[#5BA3FF]/20" />
            <div className="absolute left-[45%] top-[42%] h-16 w-24 animate-pulse rounded-lg bg-[#5BA3FF]/15" style={{ animationDelay: '150ms' }} />
            <div className="absolute left-[30%] top-[55%] h-10 w-16 animate-pulse rounded-lg bg-[#5BA3FF]/20" style={{ animationDelay: '300ms' }} />
            <div className="absolute left-[60%] top-[35%] h-14 w-18 animate-pulse rounded-lg bg-[#5BA3FF]/15" style={{ animationDelay: '100ms' }} />
          </div>
        </div>
      ) : null}

      {/* ── Top counter / back pill ──────────────────────────────────── */}
      {!isLoading ? (
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3"
          style={{ paddingTop: safePadTop('3.75rem') }}
        >
          {focusedTerritory ? (
            <button
              type="button"
              onClick={() => objectRadarActions.clearFocusedTerritory()}
              className="flex items-center gap-1.5 rounded-full border border-white/12 bg-black/70 px-3.5 py-2 backdrop-blur-md transition active:scale-95"
            >
              <span className="text-[12px] text-white/55">&#8592;</span>
              <span className="text-[13px] font-semibold text-white/80">All unlocked</span>
            </button>
          ) : (
            <div className="pointer-events-none rounded-full border border-white/12 bg-black/70 px-3.5 py-2 backdrop-blur-md">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/45">
                Cities & towns
              </p>
              <p className="mt-0.5 text-[15px] font-bold tabular-nums leading-none text-white">
                {loading ? '\u2026' : total > 0 ? `${stamped}/${total}` : stamped}
                <span className="ml-1.5 text-[11px] font-semibold text-white/50">stamped</span>
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Empty / error states ─────────────────────────────────────── */}
      {!isLoading && !focusedTerritory && (empty || layerError) ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 px-6 text-center"
          style={{ bottom: MINIMAPS_NAV_CLEARANCE, paddingBottom: '1.25rem' }}
        >
          <p className="text-[15px] font-semibold text-white/85">
            {layerError ? "Couldn\u2019t load the passport map" : 'No cities stamped yet'}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-white/45">
            {layerError
              ? "Your records list still has every place you\u2019ve unlocked."
              : 'Use Find Me in a Minnesota city or township to stamp it on your passport.'}
          </p>
        </div>
      ) : null}

      {/* Territory detail sheet is rendered by MinimapsShell above this layer */}
    </div>
  );
}
