/**
 * Passport-frame territory tiers — CTU fog + adjacency system.
 *
 * - unlocked (2): visited CTU — clear fill, full discovery
 * - adjacent (1): shares a border/near an unlocked CTU — semi-discoverable
 * - far (0): opaque fog — non-interactive
 */

import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { geometryLngLatBounds, type LngLatBoundsBox } from '@/map/geo/geometryLngLatBounds';

export const EXPLORE_TIER_PROP = 'ftl_tier' as const;

/** Numeric tiers stamped onto GeoJSON (Mapbox expressions compare as numbers). */
export const EXPLORE_TIER = {
  far: 0,
  adjacent: 1,
  unlocked: 2,
} as const;

export type ExploreTier = (typeof EXPLORE_TIER)[keyof typeof EXPLORE_TIER];

/** ~1.5km pad so touching / near-neighbor CTUs count as adjacent. */
const ADJACENT_PAD_DEG = 0.015;

function expandBox(box: LngLatBoundsBox, pad: number): LngLatBoundsBox {
  return {
    minLng: box.minLng - pad,
    minLat: box.minLat - pad,
    maxLng: box.maxLng + pad,
    maxLat: box.maxLat + pad,
  };
}

function boxesOverlap(a: LngLatBoundsBox, b: LngLatBoundsBox): boolean {
  return !(
    a.maxLng < b.minLng ||
    a.minLng > b.maxLng ||
    a.maxLat < b.minLat ||
    a.minLat > b.maxLat
  );
}

function featureId(f: Feature): string {
  return String(f.properties?.id ?? '');
}

/**
 * Stamp `ftl_unlocked` (0|1) + `ftl_tier` (0|1|2) onto every feature.
 * Adjacent = bbox touches an unlocked feature's padded bbox.
 */
export function stampPassportTiers(
  fc: FeatureCollection,
  unlockedIds: ReadonlySet<string> | undefined,
): FeatureCollection {
  const hasIds = Boolean(unlockedIds && unlockedIds.size > 0);
  if (!hasIds) {
    return {
      type: 'FeatureCollection',
      features: fc.features.map((f) => ({
        ...f,
        properties: {
          ...(f.properties ?? {}),
          ftl_unlocked: 0,
          [EXPLORE_TIER_PROP]: EXPLORE_TIER.far,
        },
      })),
    };
  }

  const unlockedBoxes: LngLatBoundsBox[] = [];
  for (const f of fc.features) {
    const id = featureId(f);
    if (!id || !unlockedIds!.has(id)) continue;
    const box = geometryLngLatBounds(f.geometry as Geometry);
    if (box) unlockedBoxes.push(expandBox(box, ADJACENT_PAD_DEG));
  }

  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const id = featureId(f);
      const isUnlocked = Boolean(id && unlockedIds!.has(id));
      let tier: ExploreTier = EXPLORE_TIER.far;
      if (isUnlocked) {
        tier = EXPLORE_TIER.unlocked;
      } else if (unlockedBoxes.length > 0) {
        const box = geometryLngLatBounds(f.geometry as Geometry);
        if (box && unlockedBoxes.some((ub) => boxesOverlap(box, ub))) {
          tier = EXPLORE_TIER.adjacent;
        }
      }
      return {
        ...f,
        properties: {
          ...(f.properties ?? {}),
          ftl_unlocked: isUnlocked ? 1 : 0,
          [EXPLORE_TIER_PROP]: tier,
        },
      };
    }),
  };
}

/** Union bbox of unlocked features only (for camera frame). */
export function unlockedFeaturesBounds(
  fc: FeatureCollection,
  unlockedIds: ReadonlySet<string>,
): LngLatBoundsBox | null {
  if (unlockedIds.size === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let any = false;
  for (const f of fc.features) {
    const id = featureId(f);
    if (!id || !unlockedIds.has(id)) continue;
    const box = geometryLngLatBounds(f.geometry as Geometry);
    if (!box) continue;
    any = true;
    minLng = Math.min(minLng, box.minLng);
    minLat = Math.min(minLat, box.minLat);
    maxLng = Math.max(maxLng, box.maxLng);
    maxLat = Math.max(maxLat, box.maxLat);
  }
  if (!any) return null;
  return { minLng, minLat, maxLng, maxLat };
}
