import { NextResponse } from 'next/server';
import { createAtlasServerClient } from '@/lib/supabase/atlasDb';
import type {
  AtlasCollectionRow,
  AtlasCollectionVisibility,
  AtlasFilterKind,
  AtlasGeomType,
} from '@/lib/atlas/types';

export const dynamic = 'force-dynamic';

type CollectionDbRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  filter_kind: AtlasFilterKind;
  geom_modes: string[] | null;
  visibility: AtlasCollectionVisibility;
  sort_order: number;
  source_label: string | null;
  is_published: boolean;
};

/**
 * GET /api/discover/atlas
 * Optional: ?unitId= — include territory_scoped collections for that unit.
 *
 * Feature sets = published atlas.collections (Discover Atlas strip).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const unitId = (url.searchParams.get('unitId') ?? '').trim() || null;

    const db = createAtlasServerClient();

    // Prefer RPC when unit-scoped; otherwise direct table (statewide + metro).
    let collections: CollectionDbRow[] = [];
    if (unitId) {
      const { data, error } = await db.rpc('collections_for_discover', {
        p_unit_id: unitId,
      });
      if (error) throw error;
      collections = (data ?? []) as CollectionDbRow[];
    } else {
      const { data, error } = await db
        .from('collections')
        .select(
          'id, slug, name, description, filter_kind, geom_modes, visibility, sort_order, source_label, is_published',
        )
        .eq('is_published', true)
        .in('visibility', ['statewide', 'metro'])
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      collections = (data ?? []) as CollectionDbRow[];
    }

    const ids = collections.map((c) => c.id);
    const countById = new Map<string, number>();
    if (ids.length > 0) {
      await Promise.all(
        ids.map(async (id) => {
          const { count, error: countError } = await db
            .from('features')
            .select('id', { count: 'exact', head: true })
            .eq('collection_id', id)
            .eq('is_published', true);
          if (countError) throw countError;
          countById.set(id, count ?? 0);
        }),
      );
    }

    const featureSets: AtlasCollectionRow[] = collections.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      filterKind: c.filter_kind,
      geomModes: (c.geom_modes ?? []).filter((m): m is AtlasGeomType =>
        m === 'point' || m === 'line' || m === 'polygon',
      ),
      visibility: c.visibility,
      sortOrder: c.sort_order,
      sourceLabel: c.source_label,
      featureCount: countById.get(c.id) ?? 0,
    }));

    return NextResponse.json({ featureSets });
  } catch (err) {
    console.error('[discover/atlas]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load atlas' },
      { status: 500 },
    );
  }
}
