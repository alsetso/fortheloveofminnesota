import { NextResponse } from 'next/server';
import { districtPartsToFeatureCollection } from '@/features/map/territory/geojson';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/territory/districts/[id]/parts
 * Individual precinct / sub-features from the district's geometry FeatureCollection.
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
      .from('districts')
      .select('id, name, district_number, slug, geometry')
      .eq('id', districtId)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[territory district parts]', error);
      }
      return NextResponse.json({ error: 'Failed to load district parts' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const fc = districtPartsToFeatureCollection(data as unknown as Record<string, unknown>);
    return NextResponse.json(fc, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory district parts]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
