/**
 * @deprecated Thin delegate over positionPersistence — the single home of
 * `lastKnownAvatarPosition`. Kept so the many "last known user location"
 * consumers (radar origin, nearby bias, today card, geocode bias, …) keep
 * working against one storage key. New code should import
 * `@/map/location/positionMode/positionPersistence` directly.
 */

import type { UserCoords } from '@/map/location/device/geolocation';
import {
  clearLastKnownAvatarPosition,
  getLastKnownAvatarPosition,
  setLastKnownAvatarPosition,
} from '@/map/location/positionMode/positionPersistence';

export function getFindMeLastCoords(): UserCoords | null {
  const pos = getLastKnownAvatarPosition();
  return pos ? { lat: pos.lat, lng: pos.lng } : null;
}

export function setFindMeLastCoords(coords: UserCoords): void {
  setLastKnownAvatarPosition({ lat: coords.lat, lng: coords.lng });
}

export function clearFindMeLastCoords(): void {
  clearLastKnownAvatarPosition();
}
