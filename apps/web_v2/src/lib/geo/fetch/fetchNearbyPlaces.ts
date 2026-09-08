import type { NearbyPlaceHit } from '@/lib/geo/nearby/nearbyPlacesTypes';

export type { NearbyPlaceHit };

/** Client fetch for GET /api/geo/nearby — POIs near a point. */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  limit = 10,
  signal?: AbortSignal,
): Promise<NearbyPlaceHit[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    limit: String(limit),
  });
  const res = await fetch(`/api/geo/nearby?${params}`, { signal, cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as {
    places?: NearbyPlaceHit[];
    error?: string;
    outsideMinnesota?: boolean;
  };

  if (!res.ok) {
    if (res.status === 422 || data.outsideMinnesota) return [];
    throw new Error(data.error ?? 'Nearby search failed');
  }

  return Array.isArray(data.places) ? data.places : [];
}
