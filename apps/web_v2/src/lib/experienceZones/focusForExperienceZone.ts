import centroid from '@turf/centroid';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { ExperienceZoneListItem } from '@/lib/experienceZones/experienceZoneTypes';
import type { PendingMapFocus } from '@/map/location/camera/pendingMapFocus';

/**
 * Map focus for an experience zone — centroid of simplified geometry.
 * Returns null when geometry is missing or invalid.
 */
export function focusForExperienceZone(
  zone: Pick<ExperienceZoneListItem, 'name' | 'geometry'>,
): PendingMapFocus | null {
  if (!zone.geometry) return null;
  try {
    const feature: Feature<Polygon | MultiPolygon> = {
      type: 'Feature',
      properties: {},
      geometry: zone.geometry,
    };
    const [lng, lat] = centroid(feature).geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: zone.name };
  } catch {
    return null;
  }
}
