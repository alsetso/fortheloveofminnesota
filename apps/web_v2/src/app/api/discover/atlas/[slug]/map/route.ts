import { NextResponse } from 'next/server';
import { createAtlasServerClient } from '@/lib/supabase/atlasDb';

export const dynamic = 'force-dynamic';

/** Cap preview features — dense statewide point sets stay snappy on mobile. */
const MAP_LIMIT = 2500;

type MapGeoJson = {
  type?: string;
  features?: unknown[];
  meta?: {
    total?: number;
    previewCount?: number;
    truncated?: boolean;
    geomModes?: string[];
    collection?: Record<string, unknown>;
  };
};

/**
 * GET /api/discover/atlas/[slug]/map
 * Type-correct Point / Line / Polygon FeatureCollection for the inline preview map.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = decodeURIComponent(rawSlug ?? '').trim();
    if (!slug) {
      return NextResponse.json({ error: 'Missing collection slug' }, { status: 400 });
    }

    const db = createAtlasServerClient();

    const { data: collection, error: collectionError } = await db
      .from('collections')
      .select(
        'id, slug, name, description, filter_kind, visibility, source_label, geom_modes, is_published',
      )
      .eq('slug', slug)
      .maybeSingle();
    if (collectionError) throw collectionError;
    if (!collection || !(collection as { is_published?: boolean }).is_published) {
      return NextResponse.json({ error: 'Feature set not found' }, { status: 404 });
    }

    const { data, error } = await db.rpc('collection_map_geojson', {
      p_slug: slug,
      p_limit: MAP_LIMIT,
    });
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Feature set not found' }, { status: 404 });
    }

    const fc = data as MapGeoJson;
    const c = collection as {
      slug: string;
      name: string;
      description: string | null;
      filter_kind: string;
      visibility: string;
      source_label: string | null;
      geom_modes: string[] | null;
    };

    return NextResponse.json({
      type: 'FeatureCollection',
      features: Array.isArray(fc.features) ? fc.features : [],
      meta: {
        collection: {
          slug: c.slug,
          name: c.name,
          description: c.description,
          filterKind: c.filter_kind,
          visibility: c.visibility,
          sourceLabel: c.source_label,
          geomModes: c.geom_modes ?? fc.meta?.geomModes ?? [],
        },
        total: fc.meta?.total ?? 0,
        previewCount: fc.meta?.previewCount ?? (fc.features?.length ?? 0),
        truncated: Boolean(fc.meta?.truncated),
        geomModes: c.geom_modes ?? fc.meta?.geomModes ?? [],
      },
    });
  } catch (err) {
    console.error('[discover/atlas/slug/map]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load map' },
      { status: 500 },
    );
  }
}
