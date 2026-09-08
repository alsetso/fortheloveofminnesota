'use client';

/**
 * Ambient atlas nameplates — soft map-native pills with a hairline stem.
 * Screen-aligned via map.project (stays upright while Live pitches/rotates).
 * Smart: featured-first, center-biased, collision-culled, zoom-aware density.
 */

import { useEffect, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Map as MapboxMap } from 'mapbox-gl';
import {
  GAME_ATLAS_COLOR,
  GAME_ATLAS_COLLECTIONS,
} from '@/features/map/atlas/gameAtlasCollections';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { Z_LAYER_CLASS } from '@/lib/map/zLayers';
import { MAP_SOURCE_IDS, mapDataStore } from '@/map/data/MapDataStore';
import { useMapContext } from '@/map/MapProvider';

const SOURCE_ID = MAP_SOURCE_IDS.atlasFeatures;

/** Below this zoom the frame is too wide for ambient labels. */
const MIN_LABEL_ZOOM = 14.25;
/** Soft pad from canvas edges so chips don't clip under chrome. */
const EDGE_PAD_PX = 28;
/** Approx chip footprint for greedy collision (name-only chips stay compact). */
const LABEL_W = 132;
const LABEL_H = 28;
const LABEL_GAP = 8;
/** Gap between chip bottom and feature anchor (includes stem). */
const ANCHOR_GAP_PX = 10;
/** Max labels by zoom band — denser when closer. */
const MAX_AT_CLOSE = 22;
const MAX_AT_MID = 14;
const MAX_AT_FAR = 8;

type AtlasLabel = {
  id: string;
  name: string;
  color: string;
  featured: boolean;
  lng: number;
  lat: number;
};

type PlacedLabel = AtlasLabel & { x: number; y: number };

function collectionColor(slug: string | null | undefined): string {
  if (!slug) return GAME_ATLAS_COLOR;
  return (
    GAME_ATLAS_COLLECTIONS.find((c) => c.slug === slug)?.color ??
    GAME_ATLAS_COLOR
  );
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true';
}

function readCoord(props: Record<string, unknown>, key: string): number | null {
  const v = props[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pointFromGeometry(geom: Geometry | null | undefined): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point') {
    const [lng, lat] = geom.coordinates;
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  if (geom.type === 'MultiPoint' && geom.coordinates[0]) {
    const [lng, lat] = geom.coordinates[0];
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  return null;
}

function featureToLabel(f: Feature): AtlasLabel | null {
  const props = (f.properties ?? {}) as Record<string, unknown>;
  const id = String(props.id ?? f.id ?? '').trim();
  const name = String(props.name ?? '').trim();
  if (!id || !name) return null;

  let lng = readCoord(props, 'lng');
  let lat = readCoord(props, 'lat');
  if (lng == null || lat == null) {
    const pt = pointFromGeometry(f.geometry);
    if (!pt) return null;
    lng = pt[0];
    lat = pt[1];
  }

  const slug =
    typeof props.collectionSlug === 'string' ? props.collectionSlug : null;

  return {
    id,
    name,
    color: collectionColor(slug),
    featured: asBool(props.featured),
    lng,
    lat,
  };
}

function maxLabelsForZoom(zoom: number): number {
  if (zoom >= 16.5) return MAX_AT_CLOSE;
  if (zoom >= 15.2) return MAX_AT_MID;
  return MAX_AT_FAR;
}

function overlaps(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  // Chips sit centered on x and above y (anchor at feature).
  const ax0 = a.x - LABEL_W / 2;
  const ax1 = a.x + LABEL_W / 2;
  const ay0 = a.y - LABEL_H - ANCHOR_GAP_PX;
  const ay1 = a.y - ANCHOR_GAP_PX;
  const bx0 = b.x - LABEL_W / 2;
  const bx1 = b.x + LABEL_W / 2;
  const by0 = b.y - LABEL_H - ANCHOR_GAP_PX;
  const by1 = b.y - ANCHOR_GAP_PX;
  return !(
    ax1 + LABEL_GAP < bx0 ||
    bx1 + LABEL_GAP < ax0 ||
    ay1 + LABEL_GAP < by0 ||
    by1 + LABEL_GAP < ay0
  );
}

function pickLabels(map: MapboxMap, fc: FeatureCollection): PlacedLabel[] {
  const zoom = map.getZoom();
  if (zoom < MIN_LABEL_ZOOM) return [];

  const canvas = map.getCanvas();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return [];

  const cx = w / 2;
  const cy = h / 2;
  const budget = maxLabelsForZoom(zoom);

  const candidates: (AtlasLabel & {
    x: number;
    y: number;
    dist2: number;
  })[] = [];

  for (const f of fc.features) {
    const label = featureToLabel(f);
    if (!label) continue;

    let p;
    try {
      p = map.project([label.lng, label.lat]);
    } catch {
      continue;
    }
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (
      p.x < EDGE_PAD_PX ||
      p.y < EDGE_PAD_PX + LABEL_H ||
      p.x > w - EDGE_PAD_PX ||
      p.y > h - EDGE_PAD_PX
    ) {
      continue;
    }

    const dx = p.x - cx;
    const dy = p.y - cy;
    candidates.push({
      ...label,
      x: p.x,
      y: p.y,
      dist2: dx * dx + dy * dy,
    });
  }

  candidates.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.dist2 - b.dist2;
  });

  const placed: PlacedLabel[] = [];
  for (const c of candidates) {
    if (placed.length >= budget) break;
    if (placed.some((p) => overlaps(p, c))) continue;
    placed.push({
      id: c.id,
      name: c.name,
      color: c.color,
      featured: c.featured,
      lng: c.lng,
      lat: c.lat,
      x: c.x,
      y: c.y,
    });
  }
  return placed;
}

/**
 * Ambient atlas nameplates — companion to {@link GameAtlasLayer}.
 * Pointer-events none; hover/click still go through Mapbox hit-testing.
 */
export function AtlasFeatureLabelsLayer() {
  const { map, ready } = useMapContext();
  const [labels, setLabels] = useState<PlacedLabel[]>([]);

  useEffect(() => {
    if (!map || !ready) {
      setLabels([]);
      return;
    }

    let raf = 0;
    let fc = mapDataStore.get(SOURCE_ID);

    const recompute = () => {
      raf = 0;
      try {
        setLabels(pickLabels(map, fc));
      } catch {
        setLabels([]);
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(recompute);
    };

    const unsub = mapDataStore.subscribe(SOURCE_ID, (next) => {
      fc = next;
      schedule();
    });

    schedule();
    map.on('move', schedule);
    map.on('resize', schedule);

    return () => {
      unsub();
      map.off('move', schedule);
      map.off('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [map, ready]);

  if (labels.length === 0) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 ${Z_LAYER_CLASS.MAP_CHROME} overflow-hidden`}
      aria-hidden
    >
      {labels.map((label) => (
        <div
          key={label.id}
          className="pointer-events-none absolute flex max-w-[min(148px,52vw)] -translate-x-1/2 -translate-y-full flex-col items-center"
          style={{ left: label.x, top: label.y }}
        >
          <div
            className={`rounded-full px-2 py-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.12)] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
          >
            <p className="truncate text-[11px] font-semibold leading-none tracking-tight text-foreground">
              {label.name}
            </p>
          </div>
          {/* Hairline stem → feature */}
          <span
            aria-hidden
            className="mt-0.5 h-[7px] w-px opacity-55"
            style={{ backgroundColor: label.color }}
          />
          <span
            aria-hidden
            className="h-[3px] w-[3px] rounded-full opacity-80"
            style={{ backgroundColor: label.color }}
          />
        </div>
      ))}
    </div>
  );
}
