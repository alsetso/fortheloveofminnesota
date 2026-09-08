/**
 * Object Radar service — still-out placements from the world store.
 * Includes every interactive model (not silent `see` scenery).
 */

import type { FeatureCollection, Point } from 'geojson';
import { loadWorldPlacements } from '@/features/map/game/world/placementsPersist';
import { getWorldModel } from '@/features/map/game/world/catalogStore';
import {
  getWorldPlacementsSnapshot,
  type WorldPlacementFeatureProps,
} from '@/features/map/game/world/placementsStore';
import {
  CLASSIC_COLLECTIBLE_COLORS,
  isRadarStillOutVerb,
  radarColorFor,
  resolveRadarPurpose,
} from '@/features/map/game/objectRadar/radarPurpose';
import type {
  ObjectRadarFeatureCollection,
  ObjectRadarFeatureProps,
  ObjectRadarOrigin,
} from '@/features/map/game/objectRadar/types';
import { resolveModelVerb } from '@/features/map/game/world/modelVerbs';

function fromSnapshot(
  snapshot: FeatureCollection<Point, WorldPlacementFeatureProps>,
): ObjectRadarFeatureCollection {
  const features: ObjectRadarFeatureCollection['features'] = [];
  for (const f of snapshot.features) {
    const slug = f.properties?.slug ?? f.properties?.kind;
    if (typeof slug !== 'string' || !slug) continue;

    const verb = resolveModelVerb(f.properties?.interaction);
    if (!isRadarStillOutVerb(verb)) continue;

    const id = String(f.properties?.id ?? f.id ?? '');
    if (!id) continue;
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    const model = getWorldModel(slug);
    const purpose = resolveRadarPurpose(
      f.properties?.purpose ?? model?.purpose,
      verb,
    );
    features.push({
      type: 'Feature',
      id,
      properties: {
        id,
        slug,
        collected: false,
        interaction: verb,
        purpose,
        color: radarColorFor(purpose, slug),
      },
      geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function readStillOutObjects(): ObjectRadarFeatureCollection {
  return fromSnapshot(getWorldPlacementsSnapshot());
}

export async function refreshStillOutObjects(
  origin: Pick<ObjectRadarOrigin, 'lat' | 'lng'>,
): Promise<ObjectRadarFeatureCollection> {
  await loadWorldPlacements({ lat: origin.lat, lng: origin.lng });
  return readStillOutObjects();
}

/**
 * Returns all non-collectible placements currently loaded in the world store —
 * props, info boards, check-ins, routes, and any interactive object whose verb
 * is not `collect`. Used in Explore Zone mode to render grey "other" dots on
 * the radar and a named list accordion in the zone minimap.
 *
 * Includes `see`-verb (scenery/prop) objects that are normally excluded from
 * the collectible radar.
 */
export function readZoneOtherObjects(): ObjectRadarFeatureCollection {
  const snapshot = getWorldPlacementsSnapshot();
  const features: ObjectRadarFeatureCollection['features'] = [];

  for (const f of snapshot.features) {
    const slug = f.properties?.slug ?? f.properties?.kind;
    if (typeof slug !== 'string' || !slug) continue;

    // Skip true collectibles — those already appear as colored dots.
    const isClassic = slug in CLASSIC_COLLECTIBLE_COLORS;
    const isCollectible = Boolean(f.properties?.collectible);
    if (isClassic || isCollectible) continue;

    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const id = String(f.properties?.id ?? f.id ?? '');
    if (!id) continue;

    const model = getWorldModel(slug);
    const label = model?.label ?? slug;
    const verb = resolveModelVerb(f.properties?.interaction);
    const purpose = resolveRadarPurpose(f.properties?.purpose, verb);

    features.push({
      type: 'Feature',
      id,
      properties: {
        id,
        slug,
        label,
        collected: false,
        interaction: verb,
        purpose,
        color: '#9ca3af', // always muted grey — visually distinct from collectibles
      },
      geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
    });
  }

  return { type: 'FeatureCollection', features };
}

export type { ObjectRadarFeatureProps };
