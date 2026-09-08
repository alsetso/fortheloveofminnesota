/**
 * Object Radar — in-range filtering + counts (data layer).
 */

import {
  distanceMeters,
  type RangeOrigin,
} from '@/features/map/game/objectRadar/range';
import {
  emptyPurposeCounts,
  type ObjectRadarPurposeCounts,
  type ObjectRadarPurposeFilter,
} from '@/features/map/game/objectRadar/radarPurpose';
import {
  emptyObjectRadarCounts,
  isObjectRadarSlug,
  type ObjectRadarCounts,
  type ObjectRadarFeatureCollection,
} from '@/features/map/game/objectRadar/types';

/** Features inside Range (with a small edge slop). */
export function filterInRangeObjects(
  fc: ObjectRadarFeatureCollection,
  origin: RangeOrigin,
  rangeM: number,
): ObjectRadarFeatureCollection {
  const limit = rangeM * 1.02;
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => {
      const c = f.geometry?.coordinates;
      if (!c || c.length < 2) return false;
      return distanceMeters(origin, { lng: c[0], lat: c[1] }) <= limit;
    }),
  };
}

export function filterByPurpose(
  fc: ObjectRadarFeatureCollection,
  purposeFilter: ObjectRadarPurposeFilter,
): ObjectRadarFeatureCollection {
  if (purposeFilter === 'all') return fc;
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => f.properties?.purpose === purposeFilter),
  };
}

/** Classic collectible slug counts (Heart / Credit / Chest). */
export function countNearbyObjects(
  fc: ObjectRadarFeatureCollection,
  origin: RangeOrigin,
  rangeM: number,
): ObjectRadarCounts {
  const nearby = filterInRangeObjects(fc, origin, rangeM);
  const counts = emptyObjectRadarCounts();
  for (const f of nearby.features) {
    const slug = f.properties?.slug;
    if (slug && isObjectRadarSlug(slug)) counts[slug] += 1;
  }
  return counts;
}

/** Purpose-branch counts for nearby interactive models. */
export function countNearbyByPurpose(
  fc: ObjectRadarFeatureCollection,
  origin: RangeOrigin,
  rangeM: number,
): ObjectRadarPurposeCounts {
  const nearby = filterInRangeObjects(fc, origin, rangeM);
  const counts = emptyPurposeCounts();
  for (const f of nearby.features) {
    const purpose = f.properties?.purpose;
    if (purpose && purpose in counts) counts[purpose] += 1;
  }
  return counts;
}

export function findObjectCoords(
  fc: ObjectRadarFeatureCollection,
  id: string,
): { lng: number; lat: number } | null {
  for (const f of fc.features) {
    if (String(f.properties?.id ?? f.id) !== id) continue;
    const c = f.geometry?.coordinates;
    if (!c || c.length < 2) return null;
    return { lng: c[0], lat: c[1] };
  }
  return null;
}
