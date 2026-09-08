import type { MultiPolygon, Polygon } from 'geojson';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ExperienceZoneListItem,
  ExperienceZoneListResult,
} from '@/lib/experienceZones/experienceZoneTypes';

export const dynamic = 'force-dynamic';

function isPolygonGeometry(value: unknown): value is Polygon | MultiPolygon {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: string; coordinates?: unknown };
  return (
    (g.type === 'Polygon' || g.type === 'MultiPolygon') &&
    Array.isArray(g.coordinates)
  );
}

/**
 * GET /api/experience-zones
 * Active primary experience zones + simplified polygons for Object Map overlays.
 *
 * Query:
 * - `featured=1` — Play hub only: limit to featured primary zones.
 */
export async function GET(request: Request) {
  try {
    const featuredOnly =
      new URL(request.url).searchParams.get('featured') === '1';

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .schema('world')
      .from('experience_zones')
      .select(
        'id, slug, name, description, featured, geometry_simplified, parent_zone_id',
      )
      .eq('status', 'active')
      .is('parent_zone_id', null)
      .order('name');

    if (featuredOnly) {
      query = query.eq('featured', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[experience-zones] list', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const zones: ExperienceZoneListItem[] = [];
    for (const row of data ?? []) {
      if (
        typeof row.id !== 'string' ||
        typeof row.slug !== 'string' ||
        typeof row.name !== 'string'
      ) {
        continue;
      }
      zones.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description:
          typeof row.description === 'string' ? row.description : null,
        featured: Boolean(row.featured),
        geometry: isPolygonGeometry(row.geometry_simplified)
          ? row.geometry_simplified
          : null,
      });
    }

    return NextResponse.json(
      { zones } satisfies ExperienceZoneListResult,
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (err) {
    console.error('[experience-zones]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
