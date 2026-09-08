/** In-memory GeoJSON of world placements for the Mapbox source. */

import type { Feature, FeatureCollection, Point } from 'geojson';
import {
  WORLD_PLACEMENT_HIT_BILLBOARD,
  worldModelRuntimeId,
  type WorldModelSlug,
  type WorldModelSpec,
} from '@/features/map/game/world/catalog';
import {
  BLOCK_GRID_METERS,
  BLOCK_MODEL_CATEGORY,
} from '@/features/map/game/world/worldGrid';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import {
  resolveModelPurpose,
  resolveModelVerb,
} from '@/features/map/game/world/modelVerbs';
import { getWorldPlaceMode } from '@/features/map/game/world/placeModeStore';
import { resolvePlacementPose } from '@/features/map/game/world/resolvePlacementPose';
import type { UserCoords } from '@/map/location/device/geolocation';

type Listener = () => void;

export type WorldPlacementRaw = {
  id: string;
  lat: number;
  lng: number;
  kind: WorldModelSlug;
  /** Relative to catalog size; 1 / omitted = follow catalog. */
  scaleMultiplier?: number | null;
  /** Absolute yaw override degrees; null / omitted = follow catalog default. */
  rotationZ?: number | null;
  /** Absolute altitude override meters AGL; null / omitted = follow catalog default. */
  altitudeMeters?: number | null;
  /** Placement-specific overrides from the DB (e.g. { postId } for community-* models). */
  overrides?: Record<string, unknown> | null;
};

export type WorldPlacementFeatureProps = {
  id: string;
  kind: WorldModelSlug;
  modelId: string;
  slug: string;
  modelScale: [number, number, number];
  modelRotation: [number, number, number];
  modelTranslation: [number, number, number];
  /** Effective yaw before collectible auto-spin. */
  baseRotationZ: number;
  /** True when catalog interaction is collect — map spins these. */
  collectible: boolean;
  /** Rare collectible — violet ring vs amber common. */
  rare: boolean;
  /** Catalog category (prop, animal, vehicle, air, water, character, sign, block…). */
  category: string;
  /** Catalog tap verb (see|info|collect|…). Legacy none may still appear. */
  interaction: string;
  /** North-star purpose branch from catalog. */
  purpose: string;
  scaleFactor: number;
  /**
   * Largest model dimension in meters (after scale_multiplier).
   * Drives the camera-facing hit plane size.
   */
  hitSizeMeters: number;
};

let raw: WorldPlacementRaw[] = [];
let features: Feature<Point, WorldPlacementFeatureProps>[] = [];
let snapshot: FeatureCollection<Point, WorldPlacementFeatureProps> = {
  type: 'FeatureCollection',
  features: [],
};
const listeners = new Set<Listener>();

function emit() {
  snapshot = { type: 'FeatureCollection', features };
  for (const listener of listeners) listener();
}

/** Stable fingerprint so catalog rebuilds can skip no-op emits. */
function featuresFingerprint(
  list: Feature<Point, WorldPlacementFeatureProps>[],
): string {
  if (list.length === 0) return '';
  let out = String(list.length);
  for (const f of list) {
    const p = f.properties;
    const c = f.geometry.coordinates;
    out += `|${p.id}:${p.slug}:${c[0]}:${c[1]}:${p.scaleFactor}:${p.baseRotationZ}`;
  }
  return out;
}

function resolveModel(slug: WorldModelSlug): WorldModelSpec | null {
  const fromCatalog = getWorldModel(slug);
  if (fromCatalog) return fromCatalog;
  // Catalog not hydrated yet — keep a renderable stub so we don't drop rows.
  if (!slug) return null;
  return {
    id: worldModelRuntimeId(slug),
    url: `/models/world/${slug}.glb`,
    scale: [1, 1, 1],
    rotation: [0, 0, 0],
    label: slug,
    slug,
    category: 'prop',
    tags: [],
    active: true,
    available: true,
    allowUserScale: true,
    sortOrder: 0,
  };
}

function toFeature(
  id: string,
  coords: UserCoords,
  slug: WorldModelSlug,
  scaleMultiplier: number | null | undefined,
  rotationZ: number | null | undefined,
  altitudeMeters: number | null | undefined,
): Feature<Point, WorldPlacementFeatureProps> | null {
  const model = resolveModel(slug);
  if (!model) return null;
  const pose = resolvePlacementPose(model, {
    scaleMultiplier,
    rotationZ,
    altitudeMeters,
  });
  const verb = resolveModelVerb(model.interaction);
  const purpose = resolveModelPurpose(model.purpose, verb);
  const collectible = verb === 'collect'; // spin/pulse for collect verb only
  const rare = Boolean(model.rare);
  const isBlock = model.category === BLOCK_MODEL_CATEGORY;
  // Blocks always use the exact grid cell size as their hit plane.
  const hitSizeMeters = isBlock
    ? BLOCK_GRID_METERS * pose.scaleMultiplier
    : (() => {
        const catalogMeters = Number(model.realWorldMeters);
        const rawHitMeters =
          Number.isFinite(catalogMeters) && catalogMeters > 0
            ? catalogMeters * pose.scaleMultiplier
            : Math.max(
                pose.scale[0],
                pose.scale[1],
                pose.scale[2],
                WORLD_PLACEMENT_HIT_BILLBOARD.defaultMeters,
              );
        return Math.max(0.25, rawHitMeters * WORLD_PLACEMENT_HIT_BILLBOARD.sizePad);
      })();
  return {
    type: 'Feature',
    id,
    properties: {
      id,
      kind: slug,
      modelId: model.id,
      slug: model.slug,
      modelScale: pose.scale,
      modelRotation: [model.rotation[0], model.rotation[1], pose.rotationZ],
      modelTranslation: [0, 0, pose.altitude],
      baseRotationZ: pose.rotationZ,
      collectible,
      rare,
      category: model.category,
      interaction: verb,
      purpose,
      scaleFactor: pose.scaleMultiplier,
      hitSizeMeters,
    },
    geometry: {
      type: 'Point',
      coordinates: [coords.lng, coords.lat],
    },
  };
}

function rebuildFromRaw(): void {
  const next = raw
    .map((p) =>
      toFeature(
        p.id,
        { lat: p.lat, lng: p.lng },
        p.kind,
        p.scaleMultiplier,
        p.rotationZ,
        p.altitudeMeters,
      ),
    )
    .filter((f): f is Feature<Point, WorldPlacementFeatureProps> => f != null);
  if (featuresFingerprint(next) === featuresFingerprint(features)) {
    return;
  }
  features = next;
  emit();
}

export function getWorldPlacementsSnapshot(): FeatureCollection<
  Point,
  WorldPlacementFeatureProps
> {
  return snapshot;
}

export function getWorldPlacementsRaw(): WorldPlacementRaw[] {
  return raw;
}

export function subscribeWorldPlacements(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Rebuild GeoJSON after catalog hydrate so modelId/scale match live specs. */
export function rebuildWorldPlacementFeatures(): void {
  if (raw.length === 0) return;
  rebuildFromRaw();
}

export function addWorldPlacement(
  coords: UserCoords,
  slug?: WorldModelSlug,
  placementId?: string,
): string | null {
  const mode = slug ?? getWorldPlaceMode();
  if (mode === 'off') return null;
  if (!resolveModel(mode)) return null;
  const id = placementId ?? `local-${mode}-${Date.now()}-${raw.length}`;
  raw = [
    ...raw,
    {
      id,
      lat: coords.lat,
      lng: coords.lng,
      kind: mode,
      scaleMultiplier: 1,
      rotationZ: null, // follow catalog default_rotation_z
      altitudeMeters: null, // follow catalog default_height_meters
    },
  ];
  rebuildFromRaw();
  return id;
}

export function replaceWorldPlacementId(localId: string, serverId: string): void {
  let changed = false;
  raw = raw.map((p) => {
    if (p.id !== localId) return p;
    changed = true;
    return { ...p, id: serverId };
  });
  if (changed) rebuildFromRaw();
}

/**
 * Demo onboarding placements — client-only, never written to the API.
 * Stream flushes must preserve them or the tutorial heart/credit vanish.
 */
export const DEMO_WORLD_PLACEMENT_PREFIX = 'demo-';

export function isDemoWorldPlacementId(id: string): boolean {
  return id.startsWith(DEMO_WORLD_PLACEMENT_PREFIX);
}

export function setWorldPlacements(next: WorldPlacementRaw[]): void {
  const preservedDemo = raw.filter((p) => isDemoWorldPlacementId(p.id));
  // Never let a server tile payload own a demo- id.
  const incoming = next.filter((p) => !isDemoWorldPlacementId(p.id));
  raw = [...incoming, ...preservedDemo];
  rebuildFromRaw();
}

/** Drop a placement immediately after it's collected (on_collect = 'remove'). */
export function removeWorldPlacement(placementId: string): void {
  const before = raw.length;
  raw = raw.filter((p) => p.id !== placementId);
  if (raw.length !== before) rebuildFromRaw();
}

/** Remove only ephemeral demo placements (setup tutorial). */
export function clearDemoWorldPlacements(): void {
  const before = raw.length;
  raw = raw.filter((p) => !isDemoWorldPlacementId(p.id));
  if (raw.length !== before) rebuildFromRaw();
}

export function clearWorldPlacements(): void {
  if (raw.length === 0 && features.length === 0) return;
  raw = [];
  features = [];
  emit();
}
