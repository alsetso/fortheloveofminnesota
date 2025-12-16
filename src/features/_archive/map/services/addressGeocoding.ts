// Utility functions for adding geocoding to address entities
import { GeocodingService } from './geocodingService';
import { AddressEntity } from '@/features/api/services/personDetailParse';

type Coords = { latitude: number; longitude: number };

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const makeKey = (e: Pick<AddressEntity, 'street' | 'city' | 'state' | 'postal'>) =>
  `${s(e.street).toLowerCase()}|${s(e.city).toLowerCase()}|${s(e.state).toUpperCase()}|${s(e.postal)}`;

export async function addCoordinatesToAddressEntities(entities: AddressEntity[]): Promise<AddressEntity[]> {
  const addressEntities = entities.filter((e) => e.type === 'address');

  if (addressEntities.length === 0) return entities;

  // Build unique payload by canonical key (dedupe)
  const uniquePayload = new Map<string, { street: string; city: string; state: string; zip: string }>();
  for (const e of addressEntities) {
    const key = makeKey({ street: e.street || '', city: e.city || '', state: e.state || '', postal: e.postal || '' });
    if (!uniquePayload.has(key)) {
      uniquePayload.set(key, {
        street: e.street || '',
        city: e.city || '',
        state: e.state || '',
        zip: e.postal || '',
      });
    }
  }

  // Geocode once per unique key
  const payloadArray = Array.from(uniquePayload.values());
  const results = await GeocodingService.geocodeAddresses(payloadArray);

  // Map key -> coords
  const keys = Array.from(uniquePayload.keys());
  const coordsByKey = new Map<string, Coords | undefined>();
  for (let i = 0; i < keys.length; i++) {
    const r = results[i];
    coordsByKey.set(keys[i], r?.success ? r.coordinates : undefined);
  }

  // Apply back to original entities
  return entities.map((e) => {
    if (e.type !== 'address') return e;
    if (e.coordinates && typeof e.coordinates.latitude === 'number' && typeof e.coordinates.longitude === 'number') return e;

    const key = makeKey({ street: e.street || '', city: e.city || '', state: e.state || '', postal: e.postal || '' });
    const coords = coordsByKey.get(key);
    return coords ? { ...e, coordinates: coords } : e;
  });
}

export async function addCoordinatesToAddressEntity(entity: AddressEntity): Promise<AddressEntity> {
  if (entity.type !== 'address' || !entity.street || !entity.city || !entity.state) return entity;

  const r = await GeocodingService.geocodeAddress({
    street: entity.street,
    city: entity.city,
    state: entity.state,
    zip: entity.postal || '',
  });

  if (r.success && r.coordinates) {
    return { ...entity, coordinates: r.coordinates };
  }
  return entity;
}

export function hasCoordinates(entity: AddressEntity): boolean {
  return (
    !!entity.coordinates &&
    typeof entity.coordinates.latitude === 'number' &&
    typeof entity.coordinates.longitude === 'number'
  );
}

export function formatCoordinates(entity: AddressEntity): string {
  if (!hasCoordinates(entity)) return 'Not available';
  const { latitude, longitude } = entity.coordinates!;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
