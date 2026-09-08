import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { LocationContextResult } from '@/lib/civic/locationContextTypes';

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
 * GET /api/civic/location-context?lat=&lng=
 * County, school district, and city/town containing a point (RPC get_location_context).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'Invalid lat/lng' }, { status: 400 });
    }

    const supabase = createPublicServerClient();
    const { data, error } = await supabase.rpc('get_location_context', {
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[location-context] RPC error:', error);
      }
      return NextResponse.json(
        { county: null, district: null, city_town: null } satisfies LocationContextResult,
        { status: 500 },
      );
    }

    const result: LocationContextResult = {
      county: data?.county ?? null,
      district: data?.district ?? null,
      city_town: data?.city_town ?? null,
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[location-context]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
