import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

type ZoneRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  geometry_simplified: unknown;
  status: string;
};

/**
 * GET /api/experience-zones/[id]
 * Active experience zone + geometry, sub-zones, and content collections
 * (place_collections linked through placements tagged to this zone).
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
      .select('id, slug, name, description, geometry_simplified, status')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('[experience-zones/[id]]', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const zone = data as ZoneRow;

    const [{ count: placementCount, error: countError }, childrenRes] =
      await Promise.all([
        supabase
          .schema('world')
          .from('world_placement_experience_zones')
          .select('placement_id', { count: 'exact', head: true })
          .eq('zone_id', id),
        supabase
          .schema('world')
          .from('experience_zones')
          .select('id, slug, name, description, geometry_simplified')
          .eq('parent_zone_id', id)
          .eq('status', 'active')
          .order('name', { ascending: true }),
      ]);

    if (countError && process.env.NODE_ENV === 'development') {
      console.error('[experience-zones/[id]] count', countError.message);
    }
    if (childrenRes.error) {
      console.error('[experience-zones/[id]] children', childrenRes.error.message);
    }

    const subZones = (childrenRes.data ?? []).map((z) => ({
      id: z.id as string,
      slug: z.slug as string,
      name: z.name as string,
      description: (z.description as string | null) ?? null,
      geometry: z.geometry_simplified ?? null,
    }));

    // Collections in the zone bag: placements → models → place_collection_models
    const { data: memberships } = await supabase
      .schema('world')
      .from('world_placement_experience_zones')
      .select('placement_id')
      .eq('zone_id', id)
      .limit(4000);

    const placementIds = (memberships ?? [])
      .map((r) => (r as { placement_id?: string }).placement_id)
      .filter((pid): pid is string => Boolean(pid));

    const collections: Array<{
      slug: string;
      label: string;
      description: string | null;
      placementCount: number;
    }> = [];

    if (placementIds.length > 0) {
      const { data: placementRows } = await supabase
        .schema('world')
        .from('world_placements')
        .select('id, model_id')
        .in('id', placementIds)
        .eq('visible', true)
        .limit(4000);

      const modelIds = [
        ...new Set(
          (placementRows ?? [])
            .map((r) => (r as { model_id?: string }).model_id)
            .filter((mid): mid is string => Boolean(mid)),
        ),
      ];

      const placementCountByModel = new Map<string, number>();
      for (const row of placementRows ?? []) {
        const mid = (row as { model_id?: string }).model_id;
        if (!mid) continue;
        placementCountByModel.set(mid, (placementCountByModel.get(mid) ?? 0) + 1);
      }

      if (modelIds.length > 0) {
        const { data: membershipRows } = await supabase
          .schema('world')
          .from('place_collection_models')
          .select('model_id, collection_id')
          .in('model_id', modelIds);

        const countByCollection = new Map<string, number>();
        for (const row of membershipRows ?? []) {
          const mid = (row as { model_id?: string }).model_id;
          const cid = (row as { collection_id?: string }).collection_id;
          if (!mid || !cid) continue;
          countByCollection.set(
            cid,
            (countByCollection.get(cid) ?? 0) + (placementCountByModel.get(mid) ?? 0),
          );
        }

        const collectionIds = [...countByCollection.keys()];
        if (collectionIds.length > 0) {
          const { data: cols } = await supabase
            .schema('world')
            .from('place_collections')
            .select('id, slug, label, description, active')
            .in('id', collectionIds)
            .eq('active', true);

          for (const c of cols ?? []) {
            const row = c as {
              id: string;
              slug: string;
              label: string;
              description: string | null;
            };
            collections.push({
              slug: row.slug,
              label: row.label,
              description: row.description,
              placementCount: countByCollection.get(row.id) ?? 0,
            });
          }

          collections.sort(
            (a, b) =>
              b.placementCount - a.placementCount ||
              a.label.localeCompare(b.label),
          );
        }
      }
    }

    return NextResponse.json(
      {
        zone: {
          id: zone.id,
          slug: zone.slug,
          name: zone.name,
          description: zone.description ?? null,
          geometry: zone.geometry_simplified ?? null,
          placementCount:
            typeof placementCount === 'number' ? placementCount : null,
          collectionCount: collections.length,
          subZoneCount: subZones.length,
        },
        subZones,
        collections,
      },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (err) {
    console.error('[experience-zones/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
