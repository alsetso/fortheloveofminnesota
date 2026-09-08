import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { canUseRouteFeature } from '@/lib/geo/canUseRouteFeature';
import { MAP_CONFIG } from '@/map/config';
import { isWithinMinnesota, OUTSIDE_MN_MESSAGE } from '@/map/location/device/minnesotaGate';
import { getToolsServiceDb } from '@/lib/wallet/walletDb';

export const dynamic = 'force-dynamic';

const PROFILES = new Set(['driving', 'walking', 'cycling', 'driving-traffic']);

export type DirectionsProfile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

/**
 * GET /api/geo/directions?fromLng=&fromLat=&toLng=&toLat=&profile=&toLabel=&alternatives=
 * Lightweight A→B Directions; archives to tools.route_lookups when signed in.
 * Admin / localhost only.
 */
export async function GET(request: Request) {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const session = await getSessionAccount();
    if (!canUseRouteFeature({ host, role: session?.role ?? null })) {
      return NextResponse.json({ error: 'Route is not available' }, { status: 403 });
    }

    const url = new URL(request.url);
    const fromLng = Number(url.searchParams.get('fromLng'));
    const fromLat = Number(url.searchParams.get('fromLat'));
    const toLng = Number(url.searchParams.get('toLng'));
    const toLat = Number(url.searchParams.get('toLat'));
    const toLabel = (url.searchParams.get('toLabel') ?? '').trim() || null;
    const profileRaw = (url.searchParams.get('profile') ?? 'driving').trim();
    const profile = (PROFILES.has(profileRaw) ? profileRaw : 'driving') as DirectionsProfile;
    const wantsAlternatives = url.searchParams.get('alternatives') === 'true';

    if (
      ![fromLng, fromLat, toLng, toLat].every(Number.isFinite) ||
      fromLat < -90 ||
      fromLat > 90 ||
      toLat < -90 ||
      toLat > 90 ||
      fromLng < -180 ||
      fromLng > 180 ||
      toLng < -180 ||
      toLng > 180
    ) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    if (
      !isWithinMinnesota({ lat: fromLat, lng: fromLng }) ||
      !isWithinMinnesota({ lat: toLat, lng: toLng })
    ) {
      return NextResponse.json({ error: OUTSIDE_MN_MESSAGE }, { status: 422 });
    }

    const token = MAP_CONFIG.MAPBOX_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Geocoding not configured' }, { status: 503 });
    }

    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const params = new URLSearchParams({
      access_token: token,
      geometries: 'geojson',
      // Keep the road shape's intermediate vertices. `simplified` produces the
      // angular shortcuts that are especially visible on rural curves.
      overview: 'full',
      steps: 'false',
      alternatives: String(wantsAlternatives),
    });

    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?${params}`,
      { cache: 'no-store' },
    );

    if (!res.ok) {
      if (process.env.NODE_ENV === 'development') {
        const body = await res.text().catch(() => '');
        console.warn('[api/geo/directions]', res.status, body.slice(0, 200));
      }
      return NextResponse.json({ error: 'No route found' }, { status: 404 });
    }

    const data = (await res.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: GeoJSON.LineString | GeoJSON.MultiLineString;
      }>;
      uuid?: string;
      code?: string;
    };

    const routes = (data.routes ?? [])
      .filter(
        (
          candidate,
        ): candidate is {
          distance: number;
          duration: number;
          geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
        } => candidate.geometry != null,
      )
      .slice(0, wantsAlternatives ? 3 : 1);
    const route = routes[0];
    if (!route?.geometry) {
      return NextResponse.json({ error: 'No route found' }, { status: 404 });
    }

    const meta = {
      mapboxCode: data.code ?? null,
      mapboxUuid: data.uuid ?? null,
      overview: 'full',
      steps: false,
      alternatives: wantsAlternatives,
    };

    let routeId: string | null = null;
    try {
      const db = getToolsServiceDb();
      const { data: row, error } = await db
        .from('route_lookups')
        .insert({
          account_id: session?.accountId ?? null,
          profile,
          from_lat: fromLat,
          from_lng: fromLng,
          to_lat: toLat,
          to_lng: toLng,
          to_label: toLabel,
          distance_meters: route.distance,
          duration_seconds: route.duration,
          geometry: route.geometry,
          meta,
        })
        .select('id')
        .maybeSingle();
      if (!error && row?.id) routeId = row.id as string;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[api/geo/directions] archive failed', err);
      }
    }

    return NextResponse.json({
      routeId,
      profile,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry,
      // Additive alternate route. Existing clients continue using the primary route
      // fields above without knowing alternatives exist.
      routes: routes.map((candidate) => ({
        distanceMeters: candidate.distance,
        durationSeconds: candidate.duration,
        geometry: candidate.geometry,
      })),
      meta,
      toLabel,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/geo/directions]', err);
    }
    return NextResponse.json({ error: 'Directions failed' }, { status: 500 });
  }
}
