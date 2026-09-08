import { NextResponse } from 'next/server';
import { createAtlasServerClient } from '@/lib/supabase/atlasDb';

export const dynamic = 'force-dynamic';

/** Hard cap for a single viewport response — game zoom stays well under this. */
const MAX_LIMIT = 4000;
const DEFAULT_LIMIT = 2000;

type BboxMeta = {
  total?: number;
  returned?: number;
  truncated?: boolean;
  collectionSlugs?: string[];
  error?: string;
};

type MapGeoJson = {
  type?: string;
  features?: unknown[];
  meta?: BboxMeta;
};

function parseBbox(raw: string | null): {
  west: number;
  south: number;
  east: number;
  north: number;
} | null {
  if (!raw) return null;
  const parts = raw.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

function parseCollections(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * GET /api/atlas/features?bbox=west,south,east,north&collections=slug,slug&limit=
 * Viewport FeatureCollection for game map atlas overlays.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bbox = parseBbox(url.searchParams.get('bbox'));
    if (!bbox) {
      return NextResponse.json(
        { error: 'bbox=west,south,east,north is required' },
        { status: 400 },
      );
    }

    const collections = parseCollections(url.searchParams.get('collections'));
    if (collections.length === 0) {
      return NextResponse.json({
        type: 'FeatureCollection',
        features: [],
        meta: {
          total: 0,
          returned: 0,
          truncated: false,
          collectionSlugs: [],
        },
      });
    }

    const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(Math.floor(limitRaw), MAX_LIMIT))
      : DEFAULT_LIMIT;

    const db = createAtlasServerClient();
    const { data, error } = await db.rpc('features_in_bbox', {
      p_bbox_west: bbox.west,
      p_bbox_south: bbox.south,
      p_bbox_east: bbox.east,
      p_bbox_north: bbox.north,
      p_collection_slugs: collections,
      p_limit: limit,
    });
    if (error) throw error;

    const fc = (data ?? {}) as MapGeoJson;
    return NextResponse.json({
      type: 'FeatureCollection',
      features: Array.isArray(fc.features) ? fc.features : [],
      meta: {
        total: fc.meta?.total ?? 0,
        returned: fc.meta?.returned ?? 0,
        truncated: Boolean(fc.meta?.truncated),
        collectionSlugs: Array.isArray(fc.meta?.collectionSlugs)
          ? fc.meta.collectionSlugs
          : collections,
        ...(fc.meta?.error ? { error: fc.meta.error } : {}),
      },
    });
  } catch (err) {
    console.error('[api/atlas/features]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load atlas features' },
      { status: 500 },
    );
  }
}
