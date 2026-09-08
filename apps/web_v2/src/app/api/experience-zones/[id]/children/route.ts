import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/experience-zones/[id]/children
 * All active sub-zones whose parent_zone_id matches [id].
 * Used by the Object Map to draw and label every sub-zone when exploring a primary zone.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema('world')
      .from('experience_zones')
      .select('id, slug, name, geometry_simplified')
      .eq('parent_zone_id', id)
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) {
      console.error('[experience-zones/children]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        subZones: (data ?? []).map((z) => ({
          id: z.id,
          slug: z.slug,
          name: z.name,
          geometry: z.geometry_simplified ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch (err) {
    console.error('[experience-zones/children]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
