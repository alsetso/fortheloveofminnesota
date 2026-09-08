import { NextResponse } from 'next/server';
import { getTerritoryLayer } from '@/features/map/territory/territoryLayers';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

/**
 * GET /api/territory/layers/[slug]/records?offset=0&limit=25
 * Alphabetical name list from territory.* (no geometry).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const config = getTerritoryLayer(slug);
    if (!config) {
      return NextResponse.json({ error: 'Unknown layer' }, { status: 404 });
    }

    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
    const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
    const q = (url.searchParams.get('q') ?? '').trim();

    const db = createTerritoryServerClient();
    let query = db
      .from(config.table)
      .select(config.selectColumns, { count: 'exact' })
      .order(config.nameColumn, { ascending: true });

    if (q.length >= 2) {
      const escaped = q.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
      query = query.ilike(config.nameColumn, `%${escaped}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[territory records ${slug}]`, error);
      }
      return NextResponse.json({ error: 'Failed to load records' }, { status: 500 });
    }

    return NextResponse.json({
      rows: data ?? [],
      total: count ?? 0,
      offset,
      limit,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[territory records]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
