import { MAP_CONFIG } from '@/map/config';
import { isWithinMinnesota } from '@/map/location/device/minnesotaGate';
import type { NearbyPlaceHit } from '@/lib/geo/nearby/nearbyPlacesTypes';

const SEARCHBOX_CATEGORY_URL = 'https://api.mapbox.com/search/searchbox/v1/category';

/** Hard radius ceiling — 2.5 statute miles in metres. */
const RADIUS_M = 4023;

/**
 * Categories merged for maximum-density nearby coverage.
 * 8 categories × 10 results each = up to 80 raw hits, deduped + radius-filtered.
 */
const NEARBY_CATEGORIES = [
  'food_and_drink',
  'coffee',
  'grocery',
  'park',
  'recreation_area',
  'shopping',
  'gas_station',
  'lodging',
] as const;

type SearchBoxFeature = {
  type?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    feature_type?: string;
    distance?: number;
    maki?: string;
    poi_category?: string[];
    context?: {
      region?: { region_code?: string; name?: string };
    };
  };
};

function staticMapPreviewUrl(lng: number, lat: number): string {
  const token = MAP_CONFIG.MAPBOX_TOKEN;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${lng},${lat},15,0/240x240@2x?access_token=${token}`;
}

function categoryLabel(props: NonNullable<SearchBoxFeature['properties']>): string {
  const first = props.poi_category?.[0]?.trim();
  if (first) return first.replace(/\b\w/g, (c) => c.toUpperCase());
  if (props.maki) return props.maki.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return 'Place';
}

function isMinnesotaSearchBoxFeature(f: SearchBoxFeature): boolean {
  const coords = f.geometry?.coordinates;
  if (!coords || coords.length < 2) return false;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!isWithinMinnesota({ lat, lng })) return false;
  const region = f.properties?.context?.region?.region_code;
  if (region && region.toUpperCase() !== 'MN') return false;
  return true;
}

async function fetchCategoryNear(
  category: string,
  lat: number,
  lng: number,
  limit: number,
): Promise<NearbyPlaceHit[]> {
  const token = MAP_CONFIG.MAPBOX_TOKEN;
  if (!token) return [];

  const params = new URLSearchParams({
    access_token: token,
    proximity: `${lng},${lat}`,
    // Mapbox Search Box Category API max is 10 per request.
    limit: String(Math.min(10, Math.max(1, limit))),
    country: 'us',
    language: 'en',
  });

  const res = await fetch(`${SEARCHBOX_CATEGORY_URL}/${encodeURIComponent(category)}?${params}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    if (process.env.NODE_ENV === 'development') {
      const body = await res.text().catch(() => '');
      console.warn('[searchMinnesotaNearby]', category, res.status, body.slice(0, 200));
    }
    return [];
  }

  const data = (await res.json()) as { features?: SearchBoxFeature[] };
  const hits: NearbyPlaceHit[] = [];
  for (const f of data.features ?? []) {
    if (!isMinnesotaSearchBoxFeature(f)) continue;
    const props = f.properties;
    const coords = f.geometry?.coordinates;
    if (!props?.mapbox_id || !props.name || !coords) continue;
    const [placeLng, placeLat] = coords;
    const distanceM = typeof props.distance === 'number' ? props.distance : Number.POSITIVE_INFINITY;
    // Hard cut — only include places within the 2.5-mile radius.
    if (distanceM > RADIUS_M) continue;
    hits.push({
      id: props.mapbox_id,
      name: props.name.trim(),
      category: categoryLabel(props),
      lat: placeLat,
      lng: placeLng,
      distanceM,
      imageUrl: staticMapPreviewUrl(placeLng, placeLat),
    });
  }
  return hits;
}

/**
 * Server-side Mapbox Search Box category search near a point — MN-gated.
 * Merges 8 amenity categories and returns all unique places within 2.5 miles,
 * sorted by distance, up to `limit`.
 */
export async function searchMinnesotaNearby(
  lat: number,
  lng: number,
  limit = 60,
): Promise<NearbyPlaceHit[]> {
  if (!MAP_CONFIG.MAPBOX_TOKEN) return [];
  if (!isWithinMinnesota({ lat, lng })) return [];

  // 10 per category = Mapbox API max; all 8 categories fire in parallel.
  const batches = await Promise.all(
    NEARBY_CATEGORIES.map((category) => fetchCategoryNear(category, lat, lng, 10)),
  );

  const byId = new Map<string, NearbyPlaceHit>();
  for (const batch of batches) {
    for (const hit of batch) {
      const prev = byId.get(hit.id);
      if (!prev || hit.distanceM < prev.distanceM) byId.set(hit.id, hit);
    }
  }

  return [...byId.values()]
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, Math.min(60, Math.max(1, limit)));
}
