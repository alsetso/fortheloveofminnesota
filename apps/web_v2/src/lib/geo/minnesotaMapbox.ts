import { MAP_CONFIG } from '@/map/config';
import { isMinnesotaRegion, isWithinMinnesota } from '@/map/location/device/minnesotaGate';

export const MAPBOX_GEOCODING_BASE_URL =
  'https://api.mapbox.com/geocoding/v5/mapbox.places';

export type MapboxGeocodeFeature = {
  id: string;
  place_name: string;
  center: [number, number];
  context?: Array<{ id?: string; text?: string; short_code?: string }>;
  place_type?: string[];
  text?: string;
  short_code?: string;
};

export type MinnesotaForwardHit = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

/** True when feature is MN by region context and center is inside the bbox. */
export function isMinnesotaMapboxFeature(f: MapboxGeocodeFeature): boolean {
  if (!isMinnesotaRegion(f)) return false;
  const [lng, lat] = f.center;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return isWithinMinnesota({ lat, lng });
}

/**
 * Server-side Mapbox forward geocode — MN bbox bias + region + coord gate.
 * Never call Mapbox unfiltered from the client for place search.
 */
export async function searchMinnesotaForward(
  query: string,
  limit = 5,
): Promise<MinnesotaForwardHit[]> {
  const token = MAP_CONFIG.MAPBOX_TOKEN;
  const q = query.trim();
  if (!token || q.length < 2) return [];

  const bbox = MAP_CONFIG.MINNESOTA_BOUNDS;
  const params = new URLSearchParams({
    access_token: token,
    country: 'us',
    bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    types: 'address,poi,place,locality,neighborhood',
    limit: String(Math.min(10, limit + 3)),
    autocomplete: 'true',
    proximity: `${MAP_CONFIG.DEFAULT_CENTER[0]},${MAP_CONFIG.DEFAULT_CENTER[1]}`,
  });

  const res = await fetch(
    `${MAPBOX_GEOCODING_BASE_URL}/${encodeURIComponent(q)}.json?${params}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: MapboxGeocodeFeature[] };
  const hits: MinnesotaForwardHit[] = [];
  for (const f of data.features ?? []) {
    if (!isMinnesotaMapboxFeature(f)) continue;
    hits.push({
      id: f.id,
      name: f.place_name,
      lat: f.center[1],
      lng: f.center[0],
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
