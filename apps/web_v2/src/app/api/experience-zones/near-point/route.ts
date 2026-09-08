import type { MultiPolygon, Polygon } from 'geojson';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  ExperienceZoneNearItem,
  ExperienceZoneNearResult,
} from '@/lib/experienceZones/experienceZoneTypes';
import { EXPERIENCE_ZONE_APPROACH_RADIUS_M } from '@/lib/experienceZones/fetchExperienceZonesNearPoint';

export const dynamic = 'force-dynamic';

function createPublicServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isPolygonGeometry(value: unknown): value is Polygon | MultiPolygon {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: string; coordinates?: unknown };
  return (
    (g.type === 'Polygon' || g.type === 'MultiPolygon') &&
    Array.isArray(g.coordinates)
  );
}

function parseNearZone(raw: unknown): ExperienceZoneNearItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const z = raw as Record<string, unknown>;
  if (typeof z.id !== 'string' || typeof z.slug !== 'string' || typeof z.name !== 'string') {
    return null;
  }
  const distance_m = Number(z.distance_m);
  const label_lng = Number(z.label_lng);
  const label_lat = Number(z.label_lat);
  if (
    !Number.isFinite(distance_m) ||
    !Number.isFinite(label_lng) ||
    !Number.isFinite(label_lat)
  ) {
    return null;
  }
  return {
    id: z.id,
    slug: z.slug,
    name: z.name,
    description: typeof z.description === 'string' ? z.description : null,
    distance_m,
    label_lng,
    label_lat,
    geometry: isPolygonGeometry(z.geometry) ? z.geometry : null,
  };
}

/**
 * GET /api/experience-zones/near-point?lat=&lng=&radiusM=
 * Primary experience zones within radius that do not cover the point.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const radiusRaw = url.searchParams.get('radiusM');
    const radiusM =
      radiusRaw != null && Number.isFinite(Number(radiusRaw))
        ? Number(radiusRaw)
        : EXPERIENCE_ZONE_APPROACH_RADIUS_M;

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

    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc('experience_zones_near_point', {
      p_lat: lat,
      p_lng: lng,
      p_radius_m: radiusM,
    });

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[experience-zones/near-point] RPC error:', error);
      }
      return NextResponse.json(
        { zones: [] } satisfies ExperienceZoneNearResult,
        { status: 500 },
      );
    }

    const rawZones: unknown[] = Array.isArray(data?.zones) ? data.zones : [];
    const result: ExperienceZoneNearResult = {
      zones: rawZones
        .map(parseNearZone)
        .filter((z): z is ExperienceZoneNearItem => Boolean(z)),
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[experience-zones/near-point]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
