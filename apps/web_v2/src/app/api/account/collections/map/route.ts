import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Object-map collectibles — hearts, credits, chests. */
const OBJECT_SLUGS = [
  'heart-quaternius',
  'coin-quaternius',
  'treasure-chest-safayan',
] as const;

type CollectionRow = {
  placement_id: string;
  world_models: { slug: string } | null;
};

type PlacementRow = {
  id: string;
  lat: number | string | null;
  lng: number | string | null;
};

/**
 * GET /api/account/collections/map
 * Lat/lng for collectibles this account has claimed — used by the
 * Object Map "Collected" toggle (Object Radar / Game).
 */
export async function GET() {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const allow = new Set<string>(OBJECT_SLUGS);

    const { data: collectionRows, error: collectionErr } = await supabase
      .schema('world')
      .from('world_collections')
      .select('placement_id, world_models(slug)')
      .eq('account_id', session.accountId)
      .order('collected_at', { ascending: false })
      .limit(2000)
      .overrideTypes<CollectionRow[]>();

    if (collectionErr) throw collectionErr;

    const slugByPlacement = new Map<string, string>();
    for (const row of collectionRows ?? []) {
      const slug = row.world_models?.slug;
      if (!slug || !allow.has(slug) || !row.placement_id) continue;
      slugByPlacement.set(row.placement_id, slug);
    }

    const placementIds = [...slugByPlacement.keys()];
    if (placementIds.length === 0) {
      return NextResponse.json({ placements: [] });
    }

    const { data: placementRows, error: placementErr } = await supabase
      .schema('world')
      .from('world_placements')
      .select('id, lat, lng')
      .in('id', placementIds)
      .overrideTypes<PlacementRow[]>();

    if (placementErr) throw placementErr;

    const placements = (placementRows ?? [])
      .map((row) => {
        const slug = slugByPlacement.get(row.id);
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!slug || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { id: row.id, lat, lng, slug, collected: true as const };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    return NextResponse.json({ placements });
  } catch (err) {
    console.error('[account/collections/map]', err);
    return NextResponse.json({ error: 'Failed to load collected map' }, { status: 500 });
  }
}
