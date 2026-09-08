/**
 * Zone polygon(s) on the Object Radar Mapbox instance.
 *
 * Two boundary rings when a zone hierarchy is active:
 *   Primary (parent) zone — outer violet fill + solid line; frames the full
 *     experience venue and locks the Object Map camera.
 *   Sub-zone — inner, dashed pale-violet line; shows where within the primary
 *     zone the user is currently standing.
 *
 * Preview overlay (always, except while Explore Zone is on):
 *   Every active primary experience zone as fill + outline (+ name labels on
 *   the Object Map lightbox). Independent of venue lock.
 *
 * Separate source/layers from the main game map — the Object Radar map is a
 * completely independent GL context.
 */

import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';
import type { GeoJSONSource, LngLatBoundsLike, Map as MapboxMap } from 'mapbox-gl';
import { OBJECT_RADAR_HALO_LAYER } from '@/features/map/game/objectRadar/layers/objectMarkers';
import type { ExperienceZoneListItem } from '@/lib/experienceZones/experienceZoneTypes';
import {
  isMapStyleReady,
  safeGetLayer,
  safeGetSource,
  waitForMapStyleReady,
} from '@/map/engine/mapStyleGuard';

export type ZoneFeatureForRadar = Feature<Polygon | MultiPolygon>;

// ── Primary (parent) zone layers ─────────────────────────────────────────────
const RADAR_ZONE_SOURCE_ID = 'radar-experience-zone';
const RADAR_ZONE_FILL_ID = 'radar-experience-zone-fill';
const RADAR_ZONE_LINE_ID = 'radar-experience-zone-line';

// ── Sub-zone (inner positional ring — where the user currently stands) ────────
const RADAR_SUBZONE_SOURCE_ID = 'radar-experience-subzone';
const RADAR_SUBZONE_LINE_ID = 'radar-experience-subzone-line';

// ── All sub-zones (map of every sub-zone inside the primary zone) ─────────────
const RADAR_ALL_SUBZONES_SOURCE_ID = 'radar-experience-subzones-all';
const RADAR_ALL_SUBZONES_FILL_ID = 'radar-experience-subzones-all-fill';
const RADAR_ALL_SUBZONES_LINE_ID = 'radar-experience-subzones-all-line';
const RADAR_ALL_SUBZONES_LABEL_ID = 'radar-experience-subzones-all-label';

// ── Preview (all primary zones — Object Map lightbox + MiniMap peek) ──────────
const RADAR_PREVIEW_SOURCE_ID = 'radar-experience-zones-preview';
const RADAR_PREVIEW_FILL_ID = 'radar-experience-zones-preview-fill';
const RADAR_PREVIEW_LINE_ID = 'radar-experience-zones-preview-line';
const RADAR_PREVIEW_LABEL_ID = 'radar-experience-zones-preview-label';

const EMPTY_FC: FeatureCollection<Polygon | MultiPolygon> = {
  type: 'FeatureCollection',
  features: [],
};

type ZoneGeometryResponse = {
  zone?: { id: string; geometry: Polygon | MultiPolygon | null };
};

/** Per-zone cache of resolved geometry features. */
const geometryCache = new Map<string, ZoneFeatureForRadar>();

/** Per-parent-zone cache of all child sub-zone feature collections. */
const allSubZonesCache = new Map<string, FeatureCollection<Polygon | MultiPolygon>>();

type SubZoneGeometryResponse = {
  subZones?: Array<{ id: string; name: string; slug: string; geometry: Polygon | MultiPolygon | null }>;
};

// ── Layer bootstrap ───────────────────────────────────────────────────────────

function ensureRadarZoneLayers(map: MapboxMap): boolean {
  if (!isMapStyleReady(map)) return false;

  if (!safeGetSource(map, RADAR_ZONE_SOURCE_ID)) {
    try {
      map.addSource(RADAR_ZONE_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FC,
        promoteId: 'id',
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_ZONE_FILL_ID)) {
    try {
      map.addLayer({
        id: RADAR_ZONE_FILL_ID,
        type: 'fill',
        source: RADAR_ZONE_SOURCE_ID,
        paint: {
          'fill-color': '#8B5CF6',
          'fill-opacity': 0.18,
          'fill-antialias': true,
        },
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_ZONE_LINE_ID)) {
    try {
      map.addLayer({
        id: RADAR_ZONE_LINE_ID,
        type: 'line',
        source: RADAR_ZONE_SOURCE_ID,
        paint: {
          'line-color': '#A78BFA',
          'line-width': 2.5,
          'line-opacity': 1,
        },
      });
    } catch {
      return false;
    }
  }

  // Raise to top so boundary always reads over markers.
  try {
    if (safeGetLayer(map, RADAR_ZONE_FILL_ID)) map.moveLayer(RADAR_ZONE_FILL_ID);
    if (safeGetLayer(map, RADAR_ZONE_LINE_ID)) map.moveLayer(RADAR_ZONE_LINE_ID);
  } catch {
    /* ignore */
  }

  return true;
}

function ensureRadarSubzoneLayers(map: MapboxMap): boolean {
  if (!isMapStyleReady(map)) return false;

  if (!safeGetSource(map, RADAR_SUBZONE_SOURCE_ID)) {
    try {
      map.addSource(RADAR_SUBZONE_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FC,
        promoteId: 'id',
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_SUBZONE_LINE_ID)) {
    try {
      map.addLayer({
        id: RADAR_SUBZONE_LINE_ID,
        type: 'line',
        source: RADAR_SUBZONE_SOURCE_ID,
        paint: {
          'line-color': '#EDE9FE',   // violet-100 — bright inner edge
          'line-width': 2,
          'line-opacity': 0.85,
          'line-dasharray': [4, 2.5], // dashed = "subdivision" signal
        },
      });
    } catch {
      return false;
    }
  }

  // Sub-zone line goes above the primary zone fill but below its line.
  try {
    if (safeGetLayer(map, RADAR_SUBZONE_LINE_ID)) {
      map.moveLayer(RADAR_SUBZONE_LINE_ID);
      // Ensure above primary fill, below primary line.
      if (safeGetLayer(map, RADAR_ZONE_LINE_ID)) {
        map.moveLayer(RADAR_ZONE_LINE_ID);
      }
    }
  } catch {
    /* ignore */
  }

  return true;
}

function ensureRadarAllSubzoneLayers(map: MapboxMap): boolean {
  if (!isMapStyleReady(map)) return false;

  if (!safeGetSource(map, RADAR_ALL_SUBZONES_SOURCE_ID)) {
    try {
      map.addSource(RADAR_ALL_SUBZONES_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FC,
        promoteId: 'id',
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_ALL_SUBZONES_FILL_ID)) {
    try {
      map.addLayer({
        id: RADAR_ALL_SUBZONES_FILL_ID,
        type: 'fill',
        source: RADAR_ALL_SUBZONES_SOURCE_ID,
        paint: {
          'fill-color': '#C4B5FD', // violet-300
          'fill-opacity': 0.07,
          'fill-antialias': true,
        },
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_ALL_SUBZONES_LINE_ID)) {
    try {
      map.addLayer({
        id: RADAR_ALL_SUBZONES_LINE_ID,
        type: 'line',
        source: RADAR_ALL_SUBZONES_SOURCE_ID,
        paint: {
          'line-color': '#C4B5FD',
          'line-width': 1.5,
          'line-opacity': 0.65,
          'line-dasharray': [5, 3],
        },
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_ALL_SUBZONES_LABEL_ID)) {
    try {
      map.addLayer({
        id: RADAR_ALL_SUBZONES_LABEL_ID,
        type: 'symbol',
        source: RADAR_ALL_SUBZONES_SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 11,
          'text-max-width': 8,
          'text-anchor': 'center',
          'symbol-placement': 'point',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#DDD6FE', // violet-200
          'text-halo-color': 'rgba(18, 8, 31, 0.9)',
          'text-halo-width': 1.5,
          'text-opacity': 0.9,
        },
      });
    } catch {
      return false;
    }
  }

  return true;
}

function ensureRadarPreviewZoneLayers(map: MapboxMap): boolean {
  if (!isMapStyleReady(map)) return false;

  if (!safeGetSource(map, RADAR_PREVIEW_SOURCE_ID)) {
    try {
      map.addSource(RADAR_PREVIEW_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_FC,
        promoteId: 'id',
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_PREVIEW_FILL_ID)) {
    try {
      map.addLayer({
        id: RADAR_PREVIEW_FILL_ID,
        type: 'fill',
        source: RADAR_PREVIEW_SOURCE_ID,
        paint: {
          'fill-color': '#8B5CF6',
          'fill-opacity': 0.2,
          'fill-antialias': true,
        },
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_PREVIEW_LINE_ID)) {
    try {
      map.addLayer({
        id: RADAR_PREVIEW_LINE_ID,
        type: 'line',
        source: RADAR_PREVIEW_SOURCE_ID,
        paint: {
          'line-color': '#A78BFA',
          'line-width': 2.25,
          'line-opacity': 0.95,
        },
      });
    } catch {
      return false;
    }
  }

  if (!safeGetLayer(map, RADAR_PREVIEW_LABEL_ID)) {
    try {
      map.addLayer({
        id: RADAR_PREVIEW_LABEL_ID,
        type: 'symbol',
        source: RADAR_PREVIEW_SOURCE_ID,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-max-width': 10,
          'text-anchor': 'center',
          'symbol-placement': 'point',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          visibility: 'none',
        },
        paint: {
          'text-color': '#EDE9FE',
          'text-halo-color': 'rgba(5, 6, 8, 0.88)',
          'text-halo-width': 1.4,
          'text-opacity': 0.95,
        },
      });
    } catch {
      return false;
    }
  }

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPolygonGeometry(value: unknown): value is Polygon | MultiPolygon {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: string; coordinates?: unknown };
  return (
    (g.type === 'Polygon' || g.type === 'MultiPolygon') &&
    Array.isArray(g.coordinates)
  );
}

export function computeFeatureBounds(
  feature: ZoneFeatureForRadar,
): [[number, number], [number, number]] | null {
  const flat =
    feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates.flat()
      : feature.geometry.coordinates.flat(2);

  if (!flat.length) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const coord of flat) {
    const [lng, lat] = coord as number[];
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Expand bounds by a fraction so fitBounds padding still fits inside maxBounds. */
function padBounds(
  bounds: [[number, number], [number, number]],
  padFrac = 0.18,
): [[number, number], [number, number]] {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  const dLng = Math.max((maxLng - minLng) * padFrac, 0.0008);
  const dLat = Math.max((maxLat - minLat) * padFrac, 0.0006);
  return [
    [minLng - dLng, minLat - dLat],
    [maxLng + dLng, maxLat + dLat],
  ];
}

async function resolveZoneFeature(
  zoneId: string,
  signal: AbortSignal,
): Promise<ZoneFeatureForRadar | null> {
  let feature = geometryCache.get(zoneId);
  if (feature) return feature;

  let res: Response;
  try {
    res = await fetch(`/api/experience-zones/${zoneId}`, {
      cache: 'force-cache',
      signal,
    });
  } catch {
    return null;
  }
  if (!res.ok || signal.aborted) return null;
  const json = (await res.json()) as ZoneGeometryResponse;
  const geometry = json.zone?.geometry;
  if (!isPolygonGeometry(geometry)) return null;

  feature = {
    type: 'Feature',
    id: zoneId,
    properties: { id: zoneId },
    geometry,
  };
  geometryCache.set(zoneId, feature);
  return feature;
}

// ── Public sync functions ─────────────────────────────────────────────────────

/**
 * Fetch + cache primary zone geometry, paint on radar, return bounding box.
 * Camera fit / lock is the caller's responsibility.
 */
export async function syncZonePolygonOnRadar(
  map: MapboxMap,
  zoneId: string,
  signal: AbortSignal,
): Promise<LngLatBoundsLike | null> {
  try {
    await waitForMapStyleReady(map, { timeoutMs: 10_000, signal });
  } catch {
    return null;
  }
  if (signal.aborted) return null;

  const feature = await resolveZoneFeature(zoneId, signal);
  if (!feature || signal.aborted) return null;

  if (!ensureRadarZoneLayers(map)) return null;

  try {
    const src = map.getSource(RADAR_ZONE_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [feature] });
  } catch {
    return null;
  }

  // Re-assert stack order after other radar layers may have been added.
  try {
    if (safeGetLayer(map, RADAR_ZONE_FILL_ID)) map.moveLayer(RADAR_ZONE_FILL_ID);
    if (safeGetLayer(map, RADAR_ZONE_LINE_ID)) map.moveLayer(RADAR_ZONE_LINE_ID);
  } catch {
    /* ignore */
  }

  return computeFeatureBounds(feature);
}

/**
 * Fetch + cache sub-zone geometry and paint the inner dashed boundary ring.
 * Does NOT affect camera or max-bounds — the primary zone governs those.
 */
export async function syncSubZonePolygonOnRadar(
  map: MapboxMap,
  subZoneId: string,
  signal: AbortSignal,
): Promise<void> {
  try {
    await waitForMapStyleReady(map, { timeoutMs: 10_000, signal });
  } catch {
    return;
  }
  if (signal.aborted) return;

  const feature = await resolveZoneFeature(subZoneId, signal);
  if (!feature || signal.aborted) return;

  if (!ensureRadarSubzoneLayers(map)) return;

  try {
    const src = map.getSource(RADAR_SUBZONE_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features: [feature] });
  } catch {
    return;
  }

  // Keep sub-zone line above primary fill, below primary line.
  try {
    if (safeGetLayer(map, RADAR_SUBZONE_LINE_ID)) map.moveLayer(RADAR_SUBZONE_LINE_ID);
    if (safeGetLayer(map, RADAR_ZONE_LINE_ID)) map.moveLayer(RADAR_ZONE_LINE_ID);
  } catch {
    /* ignore */
  }
}

/**
 * Fetch all sub-zones of a parent zone and draw them as labeled polygons on
 * the radar. Gives the player a map of every sub-zone inside the primary zone,
 * so they know where each one is before navigating to it.
 * Does NOT affect camera — primary zone governs the lock.
 */
export async function syncAllSubZonesOnRadar(
  map: MapboxMap,
  parentZoneId: string,
  signal: AbortSignal,
): Promise<void> {
  try {
    await waitForMapStyleReady(map, { timeoutMs: 10_000, signal });
  } catch {
    return;
  }
  if (signal.aborted) return;

  let fc = allSubZonesCache.get(parentZoneId);
  if (!fc) {
    let res: Response;
    try {
      res = await fetch(`/api/experience-zones/${parentZoneId}/children`, {
        cache: 'force-cache',
        signal,
      });
    } catch {
      return;
    }
    if (!res.ok || signal.aborted) return;

    const json = (await res.json()) as SubZoneGeometryResponse;
    const features: Feature<Polygon | MultiPolygon>[] = [];
    for (const sz of json.subZones ?? []) {
      if (!isPolygonGeometry(sz.geometry)) continue;
      features.push({
        type: 'Feature',
        id: sz.id,
        properties: { id: sz.id, name: sz.name },
        geometry: sz.geometry,
      });
    }
    fc = { type: 'FeatureCollection', features };
    allSubZonesCache.set(parentZoneId, fc);
  }

  if (signal.aborted) return;
  if (!ensureRadarAllSubzoneLayers(map)) return;

  try {
    const src = map.getSource(RADAR_ALL_SUBZONES_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(fc);
  } catch {
    return;
  }

  // Stack order: fills → sub-zone labels → current sub-zone ring → primary line
  try {
    if (safeGetLayer(map, RADAR_ALL_SUBZONES_FILL_ID)) map.moveLayer(RADAR_ALL_SUBZONES_FILL_ID);
    if (safeGetLayer(map, RADAR_ALL_SUBZONES_LINE_ID)) map.moveLayer(RADAR_ALL_SUBZONES_LINE_ID);
    if (safeGetLayer(map, RADAR_ALL_SUBZONES_LABEL_ID)) map.moveLayer(RADAR_ALL_SUBZONES_LABEL_ID);
    if (safeGetLayer(map, RADAR_SUBZONE_LINE_ID)) map.moveLayer(RADAR_SUBZONE_LINE_ID);
    if (safeGetLayer(map, RADAR_ZONE_LINE_ID)) map.moveLayer(RADAR_ZONE_LINE_ID);
  } catch {
    /* ignore */
  }
}

/** Wipe all-sub-zones polygon data without removing layers. */
export function clearAllSubZonesOnRadar(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  try {
    const src = map.getSource(RADAR_ALL_SUBZONES_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(EMPTY_FC);
  } catch {
    /* ignore */
  }
}

/**
 * Fit + clamp the Object Map camera to the zone boundary so pan/zoom stays
 * around the venue. Call after `syncZonePolygonOnRadar`.
 */
export function lockRadarCameraToZoneBounds(
  map: MapboxMap,
  bounds: LngLatBoundsLike,
  opts?: {
    animate?: boolean;
    duration?: number;
    padding?: number;
    /** When false, only apply maxBounds (no fit). Default true. */
    fit?: boolean;
  },
): void {
  const box = bounds as [[number, number], [number, number]];
  if (!Array.isArray(box?.[0]) || !Array.isArray(box?.[1])) return;

  const padded = padBounds(box);
  try {
    map.setMaxBounds(padded);
  } catch {
    /* ignore */
  }

  if (opts?.fit === false) return;

  try {
    map.fitBounds(box, {
      padding: opts?.padding ?? 48,
      animate: opts?.animate ?? true,
      duration: opts?.duration ?? 380,
      bearing: 0,
      pitch: 0,
      maxZoom: 18.5,
    });
  } catch {
    /* ignore */
  }
}

/** Restore free camera when leaving a zone / closing Object Map. */
export function clearRadarZoneCameraLock(map: MapboxMap): void {
  try {
    map.setMaxBounds(null as unknown as LngLatBoundsLike);
  } catch {
    try {
      (map as MapboxMap & { setMaxBounds: (b: null) => void }).setMaxBounds(null);
    } catch {
      /* ignore */
    }
  }
}

/** Wipe primary zone polygon data without removing layers. */
export function clearZonePolygonOnRadar(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  try {
    const src = map.getSource(RADAR_ZONE_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(EMPTY_FC);
  } catch {
    /* ignore */
  }
}

/** Wipe sub-zone polygon data without removing layers. */
export function clearSubZonePolygonOnRadar(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  try {
    const src = map.getSource(RADAR_SUBZONE_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(EMPTY_FC);
  } catch {
    /* ignore */
  }
}

/**
 * Keep preview zone fill under collectible dots, outline + labels above them.
 * Call after marker paints — `syncObjectMarkers` always raises dots to the top.
 */
export function restackRadarPreviewZoneLayers(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  if (!safeGetLayer(map, RADAR_PREVIEW_FILL_ID)) return;
  try {
    if (safeGetLayer(map, OBJECT_RADAR_HALO_LAYER)) {
      map.moveLayer(RADAR_PREVIEW_FILL_ID, OBJECT_RADAR_HALO_LAYER);
    }
    if (safeGetLayer(map, RADAR_PREVIEW_LINE_ID)) map.moveLayer(RADAR_PREVIEW_LINE_ID);
    if (safeGetLayer(map, RADAR_PREVIEW_LABEL_ID)) map.moveLayer(RADAR_PREVIEW_LABEL_ID);
  } catch {
    /* ignore */
  }
}

export function setRadarPreviewZoneLabelsVisible(
  map: MapboxMap,
  visible: boolean,
): void {
  if (!safeGetLayer(map, RADAR_PREVIEW_LABEL_ID)) return;
  try {
    map.setLayoutProperty(
      RADAR_PREVIEW_LABEL_ID,
      'visibility',
      visible ? 'visible' : 'none',
    );
  } catch {
    /* ignore */
  }
}

/**
 * Paint every active primary experience zone on the radar map.
 * Labels belong on the Object Map lightbox — MiniMap keeps polygons only.
 */
export async function syncPreviewZonesOnRadar(
  map: MapboxMap,
  zones: ExperienceZoneListItem[],
  opts?: { labels?: boolean; signal?: AbortSignal },
): Promise<void> {
  try {
    await waitForMapStyleReady(map, { timeoutMs: 10_000, signal: opts?.signal });
  } catch {
    return;
  }
  if (opts?.signal?.aborted) return;
  if (!ensureRadarPreviewZoneLayers(map)) return;

  const features: Feature<Polygon | MultiPolygon>[] = [];
  for (const zone of zones) {
    if (!isPolygonGeometry(zone.geometry)) continue;
    features.push({
      type: 'Feature',
      id: zone.id,
      properties: { id: zone.id, name: zone.name },
      geometry: zone.geometry,
    });
  }

  if (opts?.signal?.aborted) return;

  try {
    const src = map.getSource(RADAR_PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData({ type: 'FeatureCollection', features });
  } catch {
    return;
  }

  setRadarPreviewZoneLabelsVisible(map, opts?.labels === true);
  restackRadarPreviewZoneLayers(map);
}

/** Wipe preview zone polygons without removing layers. */
export function clearPreviewZonesOnRadar(map: MapboxMap): void {
  if (!isMapStyleReady(map)) return;
  try {
    const src = map.getSource(RADAR_PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(EMPTY_FC);
  } catch {
    /* ignore */
  }
}

/** Full teardown — call when the radar map itself is being destroyed. */
export function removeRadarZoneLayers(map: MapboxMap): void {
  for (const id of [
    RADAR_PREVIEW_LABEL_ID,
    RADAR_PREVIEW_LINE_ID,
    RADAR_PREVIEW_FILL_ID,
    RADAR_ALL_SUBZONES_LABEL_ID,
    RADAR_ALL_SUBZONES_LINE_ID,
    RADAR_ALL_SUBZONES_FILL_ID,
    RADAR_SUBZONE_LINE_ID,
    RADAR_ZONE_LINE_ID,
    RADAR_ZONE_FILL_ID,
  ]) {
    try {
      if (safeGetLayer(map, id)) map.removeLayer(id);
    } catch {
      /* ignore */
    }
  }
  for (const id of [
    RADAR_PREVIEW_SOURCE_ID,
    RADAR_ALL_SUBZONES_SOURCE_ID,
    RADAR_SUBZONE_SOURCE_ID,
    RADAR_ZONE_SOURCE_ID,
  ]) {
    try {
      if (safeGetSource(map, id)) map.removeSource(id);
    } catch {
      /* ignore */
    }
  }
}
