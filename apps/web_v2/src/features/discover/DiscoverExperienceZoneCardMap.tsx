'use client';

import type { MultiPolygon, Polygon } from 'geojson';
import { DiscoverBoundaryCardMap } from '@/features/discover/DiscoverBoundaryCardMap';

/** Match game-map experience zone paint. */
const ZONE_FILL = '#8B5CF6';
const ZONE_LINE = '#A78BFA';

export function DiscoverExperienceZoneCardMap({
  zoneId,
  name,
  geometry,
}: {
  zoneId: string;
  name: string;
  geometry: Polygon | MultiPolygon;
}) {
  return (
    <DiscoverBoundaryCardMap
      featureId={zoneId}
      name={name}
      geometry={geometry}
      fillColor={ZONE_FILL}
      lineColor={ZONE_LINE}
    />
  );
}
