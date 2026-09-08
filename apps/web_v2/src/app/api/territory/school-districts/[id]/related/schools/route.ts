import { NextResponse } from 'next/server';
import { schoolRowsToMapFeatureCollection } from '@/features/map/territory/geojson';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/territory/school-districts/[id]/related/schools
 * Building-polygon FeatureCollection (lat/lng in properties for badges).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: districtId } = await params;
    if (!districtId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const db = createTerritoryServerClient();
    const { data, error } = await db
      .from('schools')
      .select('id, name, slug, school_type, school_district_id, lat, lng, geometry')
      .eq('school_district_id', districtId)
      .order('name', { ascending: true });

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[territory related schools]', error);
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
      console.error('[territory related schools]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
