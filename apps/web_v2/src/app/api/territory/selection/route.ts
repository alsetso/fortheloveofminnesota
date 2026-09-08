import { NextResponse } from 'next/server';
import type { FeatureCollection } from 'geojson';
import { getTerritoryLayer } from '@/features/map/territory/territoryLayers';
import {
  districtOutlinesToFeatureCollection,
  districtPartsToFeatureCollection,
  rowsToFeatureCollection,
  schoolRowsToMapFeatureCollection,
} from '@/features/map/territory/geojson';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

const KIND_TO_SLUG: Record<string, string> = {
  county: 'counties',
  ctu: 'cities-and-towns',
  school_district: 'school-districts',
  district: 'districts',
  senate_district: 'senate-districts',
  house_district: 'house-districts',
};

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * GET /api/territory/selection?kind=&id=
 * One-feature FeatureCollection for the independent map selection highlight.
 * Does not require (or enable) the statewide layer.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind')?.trim() ?? '';
    const id = searchParams.get('id')?.trim() ?? '';
    if (!kind || !id) {
      return NextResponse.json({ error: 'kind and id required' }, { status: 400 });
    }

    const db = createTerritoryServerClient();

    if (kind === 'school') {
      const { data, error } = await db
        .from('schools')
        .select('id, name, slug, school_type, school_district_id, lat, lng, geometry')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[territory selection school]', error);
        }
        return NextResponse.json({ error: 'Failed to load selection' }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json(EMPTY, { status: 404 });
      }
      const fc = schoolRowsToMapFeatureCollection([
        data as unknown as Record<string, unknown>,
      ]);
      return NextResponse.json(fc, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
      });
    }

    if (kind === 'district_part') {
      const districtId = id.split(':')[0];
      if (!districtId) {
        return NextResponse.json(EMPTY, { status: 404 });
      }
      const { data, error } = await db
        .from('districts')
        .select('id, name, district_number, slug, geometry')
        .eq('id', districtId)
        .maybeSingle();
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[territory selection district_part]', error);
        }
        return NextResponse.json({ error: 'Failed to load selection' }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json(EMPTY, { status: 404 });
      }
      const all = districtPartsToFeatureCollection(
        data as unknown as Record<string, unknown>,
      );
      const match = all.features.find((f) => String(f.id ?? f.properties?.id) === id);
      const fc: FeatureCollection = {
        type: 'FeatureCollection',
        features: match ? [match] : [],
      };
      if (!match) {
        return NextResponse.json(fc, { status: 404 });
      }
      return NextResponse.json(fc, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
      });
    }

    const slug = KIND_TO_SLUG[kind];
    const config = slug ? getTerritoryLayer(slug) : undefined;
    if (!config) {
      return NextResponse.json({ error: 'Unknown kind' }, { status: 404 });
    }

    const { data, error } = await db
      .from(config.table)
      .select(config.boundarySelect)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[territory selection ${kind}]`, error);
      }
      return NextResponse.json({ error: 'Failed to load selection' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(EMPTY, { status: 404 });
    }

    const row = data as unknown as Record<string, unknown>;
    const fc =
      slug === 'districts'
        ? districtOutlinesToFeatureCollection([row])
        : rowsToFeatureCollection(config, [row]);

    return NextResponse.json(fc, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory selection]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
