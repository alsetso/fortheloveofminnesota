import { NextResponse } from 'next/server';
import type { FeatureCollection } from 'geojson';
import { createAtlasServerClient } from '@/lib/supabase/atlasDb';
import { MAP_CONFIG } from '@/map/config';
import { parseRunways } from '@/features/fly/runways';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const b = MAP_CONFIG.MINNESOTA_BOUNDS;
  if (!params.has('lat') || !params.has('lng') || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < b.south || lat > b.north || lng < b.west || lng > b.east) {
    return NextResponse.json({ error: 'A position inside Minnesota map bounds is required.' }, { status: 400 });
  }
  try {
    const db = createAtlasServerClient();
    const { data, error } = await db.rpc('features_in_bbox', {
      p_bbox_west: Math.max(b.west, lng - 0.35), p_bbox_east: Math.min(b.east, lng + 0.35),
      p_bbox_south: Math.max(b.south, lat - 0.25), p_bbox_north: Math.min(b.north, lat + 0.25),
      p_collection_slugs: ['mn_airport_runways'], p_limit: 1000,
    });
    if (error || data?.meta?.error) throw new Error('Runway atlas lookup failed.');
    const fc = data as FeatureCollection & { meta?: { truncated?: boolean } };
    if (!Array.isArray(fc?.features) || fc.meta?.truncated) throw new Error('Runway atlas response is incomplete.');
    if (!fc.features.length) return NextResponse.json({ runways: [], source: 'mn_airport_runways' });
    const ids = fc.features.map((f) => String(f.id ?? f.properties?.id));
    const metadata = await db.from('features').select('id,attrs').in('id', ids).eq('is_published', true);
    if (metadata.error) throw new Error('Runway dimensions could not be loaded.');
    const attrs = new Map((metadata.data ?? []).map((row) => [row.id, row.attrs]));
    fc.features = fc.features.filter((f) => attrs.has(String(f.id ?? f.properties?.id))).map((f) => ({
      ...f, properties: { ...f.properties, attrs: attrs.get(String(f.id ?? f.properties?.id)) },
    }));
    return NextResponse.json({ runways: parseRunways(fc), source: 'mn_airport_runways' });
  } catch (error) {
    console.error('[fly/runways]', error instanceof Error ? error.message : 'Lookup failed');
    return NextResponse.json({ error: 'Runways are unavailable. Retry the radar lookup.' }, { status: 503 });
  }
}
