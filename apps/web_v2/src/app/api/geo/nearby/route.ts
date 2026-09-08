import { NextResponse } from 'next/server';
import { searchMinnesotaNearby } from '@/lib/geo/searchMinnesotaNearby';
import { MAP_CONFIG } from '@/map/config';
import { isWithinMinnesota, OUTSIDE_MN_MESSAGE } from '@/map/location/device/minnesotaGate';

export const dynamic = 'force-dynamic';

/**
 * GET /api/geo/nearby?lat=&lng=&limit=
 * Nearby Mapbox POIs for the selected-point details carousel.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const rawLimit = Number(url.searchParams.get('limit') ?? 60) || 60;
    const limit = Math.min(60, Math.max(1, rawLimit));

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
        { error: OUTSIDE_MN_MESSAGE, places: [], outsideMinnesota: true },
        { status: 422 },
      );
    }

    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      return NextResponse.json({ error: 'Geocoding not configured' }, { status: 503 });
    }

    const places = await searchMinnesotaNearby(lat, lng, limit);
    return NextResponse.json({ places });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/geo/nearby]', err);
    }
    return NextResponse.json({ error: 'Nearby search failed' }, { status: 500 });
  }
}
