import { NextResponse } from 'next/server';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import centroid from '@turf/centroid';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { getTerritoryLayer } from '@/features/map/territory/territoryLayers';
import {
  normalizePolygonGeometry,
  rowsToFeatureCollection,
} from '@/features/map/territory/geojson';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

type RelatedKind = 'cities-and-towns' | 'school-districts';

function isRelatedKind(v: string): v is RelatedKind {
  return v === 'cities-and-towns' || v === 'school-districts';
}

function asFeature(geom: Polygon | MultiPolygon): Feature<Polygon | MultiPolygon> {
  return { type: 'Feature', properties: {}, geometry: geom };
}

/**
 * School district belongs to this county when its centroid lies inside the
 * county polygon — excludes neighboring districts that only share a border.
 */
function schoolDistrictInsideCounty(
  countyFeature: Feature<Polygon | MultiPolygon>,
  district: Feature,
): boolean {
  try {
    return booleanPointInPolygon(centroid(district), countyFeature);
  } catch {
    return false;
  }
}

/**
 * GET /api/territory/counties/[id]/related/[kind]
 * kind = cities-and-towns | school-districts
 * Returns FeatureCollection of related boundaries inside the county.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  try {
    const { id: countyId, kind: rawKind } = await params;
    if (!countyId || !isRelatedKind(rawKind)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const db = createTerritoryServerClient();

    if (rawKind === 'cities-and-towns') {
      const config = getTerritoryLayer('cities-and-towns')!;
      const { data, error } = await db
        .from(config.table)
        .select(config.boundarySelect)
        .eq('county_id', countyId)
        .order(config.nameColumn, { ascending: true });

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[territory related CTU]', error);
        }
        return NextResponse.json({ error: 'Failed to load cities and towns' }, { status: 500 });
      }

      const fc = rowsToFeatureCollection(
        config,
        (data ?? []) as unknown as Record<string, unknown>[],
      );
      return NextResponse.json(fc, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
      });
    }

    // school-districts: interior / centroid inside county (exclude border-only neighbors)
    const config = getTerritoryLayer('school-districts')!;
    const { data: countyRow, error: countyErr } = await db
      .from('counties')
      .select('id, geometry:geometry_simplified')
      .eq('id', countyId)
      .maybeSingle();

    if (countyErr || !countyRow) {
      return NextResponse.json({ error: 'County not found' }, { status: 404 });
    }

    const countyGeom = normalizePolygonGeometry(
      (countyRow as { geometry?: unknown }).geometry as Parameters<
        typeof normalizePolygonGeometry
      >[0],
    );
    if (!countyGeom) {
      return NextResponse.json(
        { type: 'FeatureCollection', features: [] } satisfies FeatureCollection,
      );
    }
    const countyFeature = asFeature(countyGeom);

    const { data: sdRows, error: sdErr } = await db
      .from(config.table)
      .select(config.boundarySelect)
      .order(config.nameColumn, { ascending: true });

    if (sdErr) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[territory related SD]', sdErr);
      }
      return NextResponse.json({ error: 'Failed to load school districts' }, { status: 500 });
    }

    const allFc = rowsToFeatureCollection(
      config,
      (sdRows ?? []) as unknown as Record<string, unknown>[],
    );
    const features = allFc.features.filter((f) =>
      schoolDistrictInsideCounty(countyFeature, f as Feature),
    );

    return NextResponse.json(
      { type: 'FeatureCollection', features } satisfies FeatureCollection,
      {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
      },
    );
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory related]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
