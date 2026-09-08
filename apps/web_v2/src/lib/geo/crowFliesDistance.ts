import distance from '@turf/distance';
import type { UserCoords } from '@/map/location/device/geolocation';

/** Crow-flies distance in miles (Turf / Haversine). */
export function crowFliesMiles(from: UserCoords, to: UserCoords): number {
  return distance([from.lng, from.lat], [to.lng, to.lat], { units: 'miles' });
}

export function formatMiles(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatDurationSeconds(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} hr` : `${h} hr ${rem} min`;
}

export function formatMetersAsMiles(meters: number): string {
  return formatMiles(meters / 1609.344);
}
