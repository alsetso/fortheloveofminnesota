import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { TerritoryAtPointResult } from '@/lib/territory/territoryAtPointTypes';

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
 * GET /api/territory/at-point?lat=&lng=
 * All territory jurisdictions containing the point (RPC territory_at_point).
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
    const { data, error } = await supabase.rpc('territory_at_point', {
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[territory/at-point] RPC error:', error);
      }
      return NextResponse.json(
        { jurisdictions: [] } satisfies TerritoryAtPointResult,
        { status: 500 },
      );
    }

    const result: TerritoryAtPointResult = {
      jurisdictions: Array.isArray(data?.jurisdictions) ? data.jurisdictions : [],
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory/at-point]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
