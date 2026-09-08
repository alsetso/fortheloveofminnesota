/**
 * Object Radar — viewport clip and rim-candidate selection.
 *
 * Pure functions that derive display-ready subsets from the full
 * still-out/collected feature collection.
 *
 * Why this exists:
 *   The minimap is 84px. Feeding it hundreds of off-screen features as a
 *   Mapbox GeoJSON source wastes GPU bandwidth and produces invisible dots.
 *   Rim ticks for out-of-range objects are DOM elements — uncapped they
 *   become noisy and expensive when many objects exist in one direction.
 *
 * This module clips at two levels:
 *   1. `clipInRangeObjects`  — the GL source (dots on the map).
 *   2. `buildRimCandidates`  — rim tick DOM nodes (direction only).
 *
 * No side effects, no imports from stores.
 */

import {
  OBJECT_RADAR_MAX_RIM_TICKS,
  OBJECT_RADAR_RIM_DEGREES_PER_SLOT,
} from '@/features/map/game/objectRadar/constants';
import {
  bearingDegrees,
  distanceMeters,
  type RangeOrigin,
} from '@/features/map/game/objectRadar/range';
import { PURPOSE_COLORS } from '@/features/map/game/objectRadar/radarPurpose';
import {
  OBJECT_RADAR_LEGEND,
  type ObjectRadarFeatureCollection,
} from '@/features/map/game/objectRadar/types';
import {
  radarVerbPriority,
  resolveModelVerb,
  type ModelPurpose,
} from '@/features/map/game/world/modelVerbs';

// ---------------------------------------------------------------------------
// Priority: classic collectible slugs first, then verb priority
// ---------------------------------------------------------------------------

const SLUG_PRIORITY = Object.fromEntries(
  OBJECT_RADAR_LEGEND.map((item, i) => [item.slug, i]),
) as Record<string, number>;

function featurePriority(slug: string, interaction: string | undefined): number {
  if (slug in SLUG_PRIORITY) return SLUG_PRIORITY[slug];
  return 10 + radarVerbPriority(resolveModelVerb(interaction));
}

// ---------------------------------------------------------------------------
// In-range clip for the GL source
// ---------------------------------------------------------------------------

/**
 * Return only features within `rangeM * clipPad` of `origin`.
 * Pass the result straight to `paintObjectRadarScene` for the minimap
 * so the Mapbox source stays tight and GPU-cheap.
 *
 * @param clipPad  Multiplier on rangeM; 1.0 = strict, 1.1 adds a small edge buffer.
 */
export function clipInRangeObjects(
  fc: ObjectRadarFeatureCollection,
  origin: RangeOrigin,
  rangeM: number,
  clipPad = 1.0,
): ObjectRadarFeatureCollection {
  const limit = rangeM * clipPad;
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => {
      const c = f.geometry?.coordinates;
      return c && c.length >= 2 && distanceMeters(origin, { lng: c[0], lat: c[1] }) <= limit;
    }),
  };
}

/**
 * Return only features inside a geographic bbox (Scout viewport dial).
 * `padFrac` expands the box slightly so edge pins still paint.
 */
export function clipObjectsInBounds(
  fc: ObjectRadarFeatureCollection,
  bounds: { west: number; south: number; east: number; north: number },
  padFrac = 0.08,
): ObjectRadarFeatureCollection {
  const padLng = Math.max(0, (bounds.east - bounds.west) * padFrac);
  const padLat = Math.max(0, (bounds.north - bounds.south) * padFrac);
  const west = bounds.west - padLng;
  const east = bounds.east + padLng;
  const south = bounds.south - padLat;
  const north = bounds.north + padLat;
  return {
    type: 'FeatureCollection',
    features: fc.features.filter((f) => {
      const c = f.geometry?.coordinates;
      if (!c || c.length < 2) return false;
      const [lng, lat] = c;
      return lng >= west && lng <= east && lat >= south && lat <= north;
    }),
  };
}

// ---------------------------------------------------------------------------
// Rim candidates for direction ticks
// ---------------------------------------------------------------------------

export type RimCandidate = {
  id: string;
  /** Raw geographic bearing from origin (0 = north, clockwise). */
  geoBearing: number;
  slug: string;
  distanceM: number;
  color: string;
};

/**
 * Build at most `maxTicks` rim-tick candidates for out-of-range objects.
 *
 * Algorithm:
 *  1. Collect every feature strictly outside range.
 *  2. Divide the compass into `degreesPerSlot`-wide angular slots.
 *  3. Per slot, keep the highest-priority feature (slug → verb → closest).
 *  4. Return the closest-first `maxTicks` winning slots.
 *
 * Caller converts `geoBearing` to a screen angle by subtracting `mapBearing`.
 */
export function buildRimCandidates(
  fc: ObjectRadarFeatureCollection,
  origin: RangeOrigin,
  rangeM: number,
  maxTicks = OBJECT_RADAR_MAX_RIM_TICKS,
  degreesPerSlot = OBJECT_RADAR_RIM_DEGREES_PER_SLOT,
): RimCandidate[] {
  const insideSlop = rangeM * 0.97;
  type SlotEntry = RimCandidate & { priority: number };
  const slots = new Map<number, SlotEntry>();

  for (const f of fc.features) {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const target = { lng: coords[0], lat: coords[1] };
    const distM = distanceMeters(origin, target);
    if (distM <= insideSlop) continue;

    const slug = String(f.properties?.slug ?? '');
    const purpose = f.properties?.purpose as ModelPurpose | undefined;
    const color =
      f.properties?.color ||
      (purpose ? PURPOSE_COLORS[purpose] : null) ||
      '#9ca3af';

    const priority = featurePriority(slug, f.properties?.interaction);
    const geoBearing = bearingDegrees(origin, target);
    const slotKey = Math.floor(((geoBearing % 360) + 360) % 360 / degreesPerSlot);
    const id = String(f.properties?.id ?? f.id ?? `${geoBearing.toFixed(0)}`);

    const existing = slots.get(slotKey);
    if (
      !existing ||
      priority < existing.priority ||
      (priority === existing.priority && distM < existing.distanceM)
    ) {
      slots.set(slotKey, { id, geoBearing, slug, distanceM: distM, color, priority });
    }
  }

  return [...slots.values()]
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, maxTicks)
    .map(({ priority: _p, ...rest }) => rest);
}
