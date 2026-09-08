import { NextResponse } from 'next/server';
import { schoolRowsToMapFeatureCollection } from '@/features/map/territory/geojson';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/territory/schools/boundaries
 * Statewide school points (lat/lng) for the Controls → School districts → Schools toggle.
 * Omits building polygons to keep the payload light.
 */
export async function GET() {
  try {
    const db = createTerritoryServerClient();
    const { data, error } = await db
      .from('schools')
      .select('id, name, slug, school_type, school_district_id, lat, lng')
      .order('name', { ascending: true });

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[territory schools boundaries]', error);
      }
      return NextResponse.json({ error: 'Failed to load schools' }, { status: 500 });
    }

    const fc = schoolRowsToMapFeatureCollection(
      (data ?? []) as unknown as Record<string, unknown>[],
    );
    return NextResponse.json(fc, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory schools boundaries]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
