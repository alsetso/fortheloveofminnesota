import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ExperienceZoneAtPointResult } from '@/lib/experienceZones/experienceZoneTypes';

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

/**
 * GET /api/experience-zones/at-point?lat=&lng=
 * Active experience zones containing the point (RPC experience_zone_at_point).
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

    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc('experience_zone_at_point', {
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[experience-zones/at-point] RPC error:', error);
      }
      return NextResponse.json(
        { zones: [] } satisfies ExperienceZoneAtPointResult,
        { status: 500 },
      );
    }

    const result: ExperienceZoneAtPointResult = {
      zones: Array.isArray(data?.zones) ? data.zones : [],
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[experience-zones/at-point]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
