import { NextResponse } from 'next/server';
import { createAtlasServerClient } from '@/lib/supabase/atlasDb';
import type { AtlasFeatureListRow, AtlasGeomType } from '@/lib/atlas/types';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;
const SEARCH_MIN = 1;

function escapeIlike(q: string): string {
  return q.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

type FeatureDbRow = {
  id: string;
  name: string;
  slug: string;
  display_name: string | null;
  blurb: string | null;
  geom_type: AtlasGeomType;
  lat: number | null;
  lng: number | null;
  tags: string[] | null;
  featured: boolean;
};

/**
 * GET /api/discover/atlas/[slug]?offset=0&limit=40&q=
 * Features in one published collection (feature set).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: rawSlug } = await context.params;
    const slug = decodeURIComponent(rawSlug ?? '').trim();
    if (!slug) {
      return NextResponse.json({ error: 'Missing collection slug' }, { status: 400 });
    }

    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
    const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
    const q = (url.searchParams.get('q') ?? '').trim();

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

    const collectionId = String((collection as { id: string }).id);

    let query = db
      .from('features')
      .select(
        'id, name, slug, display_name, blurb, geom_type, lat, lng, tags, featured',
        { count: 'exact' },
      )
      .eq('collection_id', collectionId)
      .eq('is_published', true)
      .order('featured', { ascending: false })
      .order('name', { ascending: true });

    if (q.length >= SEARCH_MIN) {
      const pattern = `%${escapeIlike(q)}%`;
      query = query.or(
        `name.ilike.${pattern},display_name.ilike.${pattern},blurb.ilike.${pattern}`,
      );
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const rows: AtlasFeatureListRow[] = ((data ?? []) as FeatureDbRow[]).map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      displayName: f.display_name,
      blurb: f.blurb,
      geomType: f.geom_type,
      lat: f.lat,
      lng: f.lng,
      tags: f.tags ?? [],
      featured: Boolean(f.featured),
    }));

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
      collection: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        filterKind: c.filter_kind,
        visibility: c.visibility,
        sourceLabel: c.source_label,
        geomModes: (c.geom_modes ?? []).filter(
          (m): m is AtlasGeomType =>
            m === 'point' || m === 'line' || m === 'polygon',
        ),
      },
      rows,
      total: count ?? rows.length,
      offset,
      limit,
    });
  } catch (err) {
    console.error('[discover/atlas/slug]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load features' },
      { status: 500 },
    );
  }
}
