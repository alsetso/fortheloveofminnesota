'use client';

/**
 * Object MiniMap — rim ticks for out-of-range objects.
 *
 * Tick set is deduplicated by angular slot and capped at
 * OBJECT_RADAR_MAX_RIM_TICKS so the 84 px dial stays readable
 * no matter how many objects share a direction.
 */

import {
  buildRimCandidates,
  type RimCandidate,
} from '@/features/map/game/objectRadar/data/clipObjectsForRadar';
import type {
  ObjectRadarFeatureCollection,
} from '@/features/map/game/objectRadar/types';
import type { RangeOrigin } from '@/features/map/game/objectRadar/range';

export type RimTick = {
  id: string;
  /** Screen-space angle (0 = top, clockwise). */
  screenAngle: number;
  color: string;
};

/**
 * Build the final rim-tick list for a given radar state.
 * Deduplication and priority selection happen inside `buildRimCandidates`.
 * This function converts geographic bearings to screen angles.
 */
export function buildRimTicks({
  origin,
  mapBearing,
  rangeM,
  objects,
}: {
  origin: RangeOrigin;
  mapBearing: number;
  rangeM: number;
  objects: ObjectRadarFeatureCollection;
}): RimTick[] {
  const candidates: RimCandidate[] = buildRimCandidates(objects, origin, rangeM);
  return candidates.map((c) => ({
    id: c.id,
    screenAngle: ((c.geoBearing - mapBearing) % 360 + 360) % 360,
    color: c.color,
  }));
}

export function RimTicks({ ticks }: { ticks: RimTick[] }) {
  if (ticks.length === 0) return null;

  return (
    <div
      data-object-radar="rim-ticks"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
      aria-hidden
    >
      {ticks.map((tick) => (
        <div
          key={tick.id}
          className="absolute inset-0"
          style={{ transform: `rotate(${tick.screenAngle}deg)` }}
        >
          <span
            className="absolute left-1/2 top-0 block -translate-x-1/2"
            style={{
              width: 3,
              height: 6,
              backgroundColor: tick.color,
            }}
          />
        </div>
      ))}
    </div>
  );
}
