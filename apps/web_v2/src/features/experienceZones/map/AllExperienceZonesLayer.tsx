'use client';

/**
 * AllExperienceZonesLayer — persistent polygon layer for every active
 * experience zone on the game map, completely independent of the user's GPS.
 *
 * Visual treatment — matches the Object Radar minimap preview style:
 *   - Fill:  #8B5CF6 (violet-500) at 20% opacity
 *   - Line:  #A78BFA (violet-400) at 2.25 px, 95% opacity
 *   - Label: zone name at polygon centroid, zoom 11–15, white on dark halo
 *
 * Tap behavior — entirely map-native, no glass overlay:
 *   - Tapping a zone NOT currently occupied by the user pops a two-line
 *     callout label at the tap point: zone name + "· get closer ·"
 *   - Auto-dismisses after 4 s or on the next map tap.
 *   - Tapping a zone the user is already inside is ignored here (the
 *     ExploreZoneEnteredModal / ApproachLabel handles that path).
 *
 * The existing ExperienceZoneBoundaryLayer activates on the `top` Standard
 * slot when the user is inside / approaching — its 22% fill + solid line sits
 * on top of this layer naturally, adding a "you are here" highlight over the
 * ambient territory polygons.
 *
 * Location logic / explore-prompt / venue mode — untouched.
 */

import { useEffect, useRef } from 'react';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import type { MapLayerMouseEvent, MapMouseEvent } from 'mapbox-gl';
import { useMapContext } from '@/map/MapProvider';
import { waitForMapStyleReady, isMapStyleReady, safeGetLayer, safeGetSource } from '@/map/engine/mapStyleGuard';
import { fetchExperienceZonesList } from '@/lib/experienceZones/fetchExperienceZonesList';
import type { ExperienceZoneListItem } from '@/lib/experienceZones/experienceZoneTypes';
import { mapUsesMapboxStandard } from '@/map/buildings/applyMapBuildings3D';
import { getCurrentExperienceZoneSnapshot } from '@/features/experienceZones/store/currentExperienceZoneStore';
import {
  getVenueModeSnapshot,
  reofferExploreZone,
  subscribeVenueMode,
} from '@/features/experienceZones/store/venueModeStore';
import { openContributeSheet } from '@/features/community/contributeSheetStore';
import { getCurrentTerritoryStackSnapshot } from '@/features/accountTerritories/store/currentTerritoryStackStore';

// ─── Source / layer IDs ───────────────────────────────────────────────────────

const SOURCE_ID          = 'ftlomn-exp-zones-all';
const FILL_ID            = 'ftlomn-exp-zones-all-fill';
const LINE_ID            = 'ftlomn-exp-zones-all-line';
const LABEL_ID           = 'ftlomn-exp-zones-all-label';
const CALLOUT_SOURCE_ID  = 'ftlomn-exp-zones-callout';
const CALLOUT_LAYER_ID   = 'ftlomn-exp-zones-callout-text';
const LABEL_MIN_ZOOM     = 11;
const LABEL_MAX_ZOOM     = 16;
const CALLOUT_DISMISS_MS = 4_000;

const EMPTY_CALLOUT: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

// ─── Module-level geometry cache ─────────────────────────────────────────────

type ZoneFeature = Feature<Polygon | MultiPolygon, { id: string; name: string; slug: string }>;

const _CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _cachedZones: ZoneFeature[] | null = null;
let _cacheSetAt = 0;
let _inflight: Promise<ZoneFeature[] | null> | null = null;

/**
 * Synchronous lookup — returns the cached geometry for a zone by ID, or null
 * if the zone isn't in the cache yet (data hasn't loaded).
 * Used by the map click gate to check point-in-polygon containment.
 */
export function getZoneGeometryById(
  id: string,
): import('geojson').Polygon | import('geojson').MultiPolygon | null {
  if (!_cachedZones) return null;
  const feat = _cachedZones.find((f) => f.properties.id === id);
  return feat ? feat.geometry : null;
}

async function resolveAllZoneFeatures(signal?: AbortSignal): Promise<ZoneFeature[] | null> {
  const age = Date.now() - _cacheSetAt;
  if (_cachedZones && age < _CACHE_TTL_MS) return _cachedZones;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    const result = await fetchExperienceZonesList(signal);
    if (!result) return null;

    const features: ZoneFeature[] = result.zones
      .filter((z): z is ExperienceZoneListItem & { geometry: Polygon | MultiPolygon } =>
        Boolean(z.geometry),
      )
      .map((z) => ({
        type: 'Feature' as const,
        id: z.id,
        properties: { id: z.id, name: z.name, slug: z.slug },
        geometry: z.geometry,
      }));

    _cachedZones = features;
    _cacheSetAt = Date.now();
    return features;
  })();

  return _inflight;
}

// ─── GL helpers ───────────────────────────────────────────────────────────────

function slotProps(map: import('mapbox-gl').Map) {
  return mapUsesMapboxStandard(map) ? { slot: 'middle' as const } : {};
}

function ensureLayers(map: import('mapbox-gl').Map): void {
  if (!isMapStyleReady(map)) return;

  if (!safeGetSource(map, SOURCE_ID)) {
    try {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as FeatureCollection,
        promoteId: 'id',
      });
    } catch {
      return; // style race
    }
  }

  const sp = slotProps(map);

  if (!safeGetLayer(map, FILL_ID)) {
    try {
      map.addLayer({
        id: FILL_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#8B5CF6',   // violet-500 — matches radar preview
          'fill-opacity': 0.20,
          'fill-antialias': true,
        },
        ...sp,
      });
    } catch { /* race */ }
  }

  if (!safeGetLayer(map, LINE_ID)) {
    try {
      map.addLayer({
        id: LINE_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color':   '#A78BFA', // violet-400 — matches radar preview
          'line-opacity': 0.95,
          'line-width':   2.25,
        },
        ...sp,
      });
    } catch { /* race */ }
  }

  if (!safeGetLayer(map, LABEL_ID)) {
    try {
      map.addLayer({
        id: LABEL_ID,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: LABEL_MIN_ZOOM,
        maxzoom: LABEL_MAX_ZOOM,
        layout: {
          'text-field':           ['get', 'name'],
          'text-font':            ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size':            12,
          'text-anchor':          'center',
          'text-max-width':       10,
          'text-letter-spacing':  0.04,
          'symbol-placement':     'point',
          'text-allow-overlap':    true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color':       '#ffffff',
          'text-halo-color':  'rgba(0, 0, 0, 0.72)',
          'text-halo-width':  1.5,
          'text-opacity': [
            'interpolate', ['linear'], ['zoom'],
            LABEL_MIN_ZOOM,       0,
            LABEL_MIN_ZOOM + 1,   1,
            LABEL_MAX_ZOOM - 1,   1,
            LABEL_MAX_ZOOM,       0,
          ],
        },
        ...sp,
      });
    } catch { /* race */ }
  }
}

function setData(map: import('mapbox-gl').Map, features: ZoneFeature[]): void {
  try {
    const src = map.getSource(SOURCE_ID) as import('mapbox-gl').GeoJSONSource | undefined;
    if (!src) return;
    const fc: FeatureCollection = { type: 'FeatureCollection', features };
    src.setData(fc);
  } catch { /* race */ }
}

function ensureCalloutLayer(map: import('mapbox-gl').Map): void {
  if (!isMapStyleReady(map)) return;
  const sp = slotProps(map);

  if (!safeGetSource(map, CALLOUT_SOURCE_ID)) {
    try {
      map.addSource(CALLOUT_SOURCE_ID, { type: 'geojson', data: EMPTY_CALLOUT });
    } catch { return; }
  }

  if (!safeGetLayer(map, CALLOUT_LAYER_ID)) {
    try {
      map.addLayer({
        id: CALLOUT_LAYER_ID,
        type: 'symbol',
        source: CALLOUT_SOURCE_ID,
        layout: {
          'text-field':            ['get', 'label'],
          'text-font':             ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size':             ['match', ['get', 'kind'], 'name', 13, 10],
          'text-anchor':           ['get', 'anchor'],
          'text-offset':           ['get', 'offset'],
          'text-letter-spacing':   ['match', ['get', 'kind'], 'cta', 0.14, 0.04],
          'text-allow-overlap':    true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color':      ['match', ['get', 'kind'], 'name', '#ffffff', 'rgba(255,255,255,0.5)'],
          'text-halo-color': 'rgba(0, 0, 0, 0.80)',
          'text-halo-width': 1.5,
        },
        ...sp,
      });
    } catch { /* race */ }
  }
}

function showCallout(
  map: import('mapbox-gl').Map,
  lngLat: { lng: number; lat: number },
  zoneName: string,
): void {
  try {
    const src = map.getSource(CALLOUT_SOURCE_ID) as import('mapbox-gl').GeoJSONSource | undefined;
    if (!src) return;
    const pt: [number, number] = [lngLat.lng, lngLat.lat];
    const features: Feature<Point>[] = [
      {
        type: 'Feature',
        properties: { label: zoneName, kind: 'name', offset: [0, -0.9], anchor: 'bottom' },
        geometry: { type: 'Point', coordinates: pt },
      },
      {
        type: 'Feature',
        properties: { label: '· get closer ·', kind: 'cta', offset: [0, 0.5], anchor: 'top' },
        geometry: { type: 'Point', coordinates: pt },
      },
    ];
    src.setData({ type: 'FeatureCollection', features });
  } catch { /* race */ }
}

function clearCallout(map: import('mapbox-gl').Map): void {
  try {
    const src = map.getSource(CALLOUT_SOURCE_ID) as import('mapbox-gl').GeoJSONSource | undefined;
    src?.setData(EMPTY_CALLOUT);
  } catch { /* race */ }
}

function removeLayers(map: import('mapbox-gl').Map): void {
  for (const id of [CALLOUT_LAYER_ID, LABEL_ID, LINE_ID, FILL_ID]) {
    try { if (safeGetLayer(map, id)) map.removeLayer(id); } catch { /* already gone */ }
  }
  for (const id of [CALLOUT_SOURCE_ID, SOURCE_ID]) {
    try { if (safeGetSource(map, id)) map.removeSource(id); } catch { /* already gone */ }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AllExperienceZonesLayer() {
  const { map, ready } = useMapContext();
  const paintedRef     = useRef(false);
  const dismissRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Paint zones ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    let cancelled = false;
    const ac = new AbortController();

    const paint = async () => {
      try {
        await waitForMapStyleReady(map, { timeoutMs: 10_000 });
        if (cancelled || ac.signal.aborted) return;

        ensureLayers(map);
        ensureCalloutLayer(map);

        const features = await resolveAllZoneFeatures(ac.signal);
        if (cancelled || ac.signal.aborted) return;

        setData(map, features ?? []);
        paintedRef.current = true;
      } catch {
        /* aborted / network */
      }
    };

    const onStyleLoad = () => {
      paintedRef.current = false;
      void paint();
    };

    void paint();
    map.on('style.load', onStyleLoad);

    return () => {
      cancelled = true;
      ac.abort();
      map.off('style.load', onStyleLoad);
      removeLayers(map);
    };
  }, [map, ready]);

  // ── Auto-clear callout when user enters any zone ─────────────────────────
  useEffect(() => {
    if (!map || !ready) return;
    let prevActive = getVenueModeSnapshot().active;

    const unsub = subscribeVenueMode(() => {
      const { active } = getVenueModeSnapshot();
      if (!prevActive && active) {
        // Just entered a zone — dismiss any "get closer" label.
        if (dismissRef.current) clearTimeout(dismissRef.current);
        clearCallout(map);
      }
      prevActive = active;
    });

    return unsub;
  }, [map, ready]);

  // ── Click → callout ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !ready) return;

    const schedDismiss = () => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => clearCallout(map), CALLOUT_DISMISS_MS);
    };

    const onZoneClick = (e: MapLayerMouseEvent) => {
      if (!e.features?.length) return;

      const feat     = e.features[0];
      const zoneName = feat.properties?.name as string | undefined;
      const zoneId   = feat.properties?.id   as string | undefined;
      if (!zoneName || !zoneId) return;

      const { primaryZone, subZone } = getCurrentExperienceZoneSnapshot();
      const isInsideThisZone = primaryZone?.id === zoneId || subZone?.id === zoneId;

      if (isInsideThisZone) {
        // User is physically inside — handle explore / contribute states.
        const venue = getVenueModeSnapshot();

        if (venue.exploring && venue.zoneId === zoneId) {
          // Already exploring → open contribute directly scoped to this zone.
          clearCallout(map);
          const stack = getCurrentTerritoryStackSnapshot();
          const ctu   = stack.jurisdictions.find((j) => j.kind === 'ctu');
          openContributeSheet({
            ctu: ctu ? { id: ctu.id, name: ctu.name, kindLabel: ctu.kindLabel } : null,
            experienceZoneId:   zoneId,
            experienceZoneName: zoneName,
          });
        } else {
          // Inside but not yet confirmed → resurface the Yes/No banner prompt.
          reofferExploreZone();
        }
        return;
      }

      // Outside the zone — show "get closer" callout.
      ensureCalloutLayer(map);
      showCallout(map, e.lngLat, zoneName);
      schedDismiss();
    };

    const onMapClick = (e: MapMouseEvent) => {
      // Only dismiss if the click landed outside a zone polygon.
      // Guard against querying layers that haven't been added yet (style race).
      const existingLayers = [FILL_ID, LINE_ID].filter((id) => safeGetLayer(map, id));
      if (existingLayers.length > 0) {
        try {
          const hit = map.queryRenderedFeatures(e.point, { layers: existingLayers });
          if (hit.length > 0) return;
        } catch {
          // Layer race — ignore and fall through to clearCallout.
        }
      }
      if (dismissRef.current) clearTimeout(dismissRef.current);
      clearCallout(map);
    };

    const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
    const onMouseLeave = () => { map.getCanvas().style.cursor = '';        };

    map.on('click',      FILL_ID, onZoneClick);
    map.on('click',      LINE_ID, onZoneClick);
    map.on('click',               onMapClick);
    map.on('mouseenter', FILL_ID, onMouseEnter);
    map.on('mouseleave', FILL_ID, onMouseLeave);

    return () => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
      map.off('click',      FILL_ID, onZoneClick);
      map.off('click',      LINE_ID, onZoneClick);
      map.off('click',               onMapClick);
      map.off('mouseenter', FILL_ID, onMouseEnter);
      map.off('mouseleave', FILL_ID, onMouseLeave);
    };
  }, [map, ready]);

  return null;
}
