import { NextResponse } from 'next/server';
import { MAPBOX_GEOCODING_BASE_URL, type MapboxGeocodeFeature } from '@/lib/geo/minnesotaMapbox';
import { MAP_CONFIG } from '@/map/config';
import {
  isMinnesotaRegion,
  isWithinMinnesota,
  OUTSIDE_MN_MESSAGE,
} from '@/map/location/device/minnesotaGate';

export const dynamic = 'force-dynamic';

/**
 * Mapbox reverse geocode only allows these types.
 * When `limit` is set, reverse requires exactly ONE type.
 * https://docs.mapbox.com/api/search/geocoding/#reverse-geocoding
 */
const REVERSE_TYPE_PRIORITY = [
  'address',
  'neighborhood',
  'locality',
  'place',
  'postcode',
  'district',
  'region',
] as const;

async function fetchReverseByType(
  lat: number,
  lng: number,
  type: (typeof REVERSE_TYPE_PRIORITY)[number],
): Promise<MapboxGeocodeFeature | null> {
  const token = MAP_CONFIG.MAPBOX_TOKEN;
  if (!token) return null;

  const params = new URLSearchParams({
    access_token: token,
    country: 'us',
    language: 'en',
    limit: '1',
    types: type,
  });

  const res = await fetch(`${MAPBOX_GEOCODING_BASE_URL}/${lng},${lat}.json?${params}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    if (process.env.NODE_ENV === 'development') {
      const body = await res.text().catch(() => '');
      console.warn('[api/geo/reverse] Mapbox', res.status, type, body.slice(0, 200));
    }
    return null;
  }

  const data = (await res.json()) as { features?: MapboxGeocodeFeature[]; message?: string };
  const feature = data.features?.[0];
  return feature ?? null;
}

/**
 * GET /api/geo/reverse?lat=&lng=
 * Server-side Mapbox reverse geocode — MN bbox + region gate.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return NextResponse.json({ error: 'Invalid lat/lng' }, { status: 400 });
    }

    if (!isWithinMinnesota({ lat, lng })) {
      return NextResponse.json(
        { error: OUTSIDE_MN_MESSAGE, address: null, outsideMinnesota: true },
        { status: 422 },
      );
    }

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      return NextResponse.json({ error: 'Geocoding not configured' }, { status: 503 });
    }

    let best: MapboxGeocodeFeature | null = null;
    for (const type of REVERSE_TYPE_PRIORITY) {
      best = await fetchReverseByType(lat, lng, type);
      if (best?.place_name || best?.text) break;
    }

    if (!best) {
      return NextResponse.json({ address: null });
    }

    // Fringe bbox points in WI/IA: reject when Mapbox region is not MN.
    if (best.context && !isMinnesotaRegion(best) && typeLooksRegional(best)) {
      return NextResponse.json(
        { error: OUTSIDE_MN_MESSAGE, address: null, outsideMinnesota: true },
        { status: 422 },
      );
    }

    const address = best.place_name?.trim() || best.text?.trim() || null;
    return NextResponse.json({
      address,
      place_type: best.place_type?.[0] ?? null,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/geo/reverse]', err);
    }
    return NextResponse.json({ error: 'Reverse geocode failed' }, { status: 500 });
  }
}

function typeLooksRegional(f: MapboxGeocodeFeature): boolean {
  // Only enforce region when Mapbox returned usable region context.
  return Boolean(f.context?.some((c) => c.id?.startsWith('region.')));
}
