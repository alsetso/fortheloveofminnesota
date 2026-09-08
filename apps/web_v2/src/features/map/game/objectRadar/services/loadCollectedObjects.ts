/**
 * Object Radar service — claimed collectibles for Object Map "Collected".
 * Collected ledger stays classic collectible slugs (hearts / credits / chests).
 */

import type { FeatureCollection, Point } from 'geojson';
import {
  OBJECT_RADAR_SLUGS,
  type ObjectRadarFeatureCollection,
  type ObjectRadarFeatureProps,
  type ObjectRadarPoint,
} from '@/features/map/game/objectRadar/types';
import { radarColorFor } from '@/features/map/game/objectRadar/radarPurpose';

function pointsToFeatureCollection(
  points: ObjectRadarPoint[],
): ObjectRadarFeatureCollection {
  const allow = new Set<string>(OBJECT_RADAR_SLUGS);
  const features: FeatureCollection<Point, ObjectRadarFeatureProps>['features'] =
    [];
  for (const p of points) {
    if (!allow.has(p.slug)) continue;
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    features.push({
      type: 'Feature',
      id: p.id,
      properties: {
        id: p.id,
        slug: p.slug,
        collected: Boolean(p.collected),
        interaction: 'collect',
        purpose: 'collectible',
        color: radarColorFor('collectible', p.slug),
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

export async function loadCollectedObjects(): Promise<ObjectRadarFeatureCollection> {
  try {
    const res = await fetch('/api/account/collections/map', { cache: 'no-store' });
    if (!res.ok) {
      console.error('loadCollectedObjects', res.status);
      return { type: 'FeatureCollection', features: [] };
    }
    const json = (await res.json()) as { placements?: ObjectRadarPoint[] };
    return pointsToFeatureCollection(json.placements ?? []);
  } catch (err) {
    console.error('loadCollectedObjects', err);
    return { type: 'FeatureCollection', features: [] };
  }
}
