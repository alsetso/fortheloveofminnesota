import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CityDirectoryPage = {
  id: string;
  slug: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  pageType: string | null;
  description: string | null;
  addressLine: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  isVerified: boolean;
  qualityScore: number | null;
  /** 'direct' = city_id match; 'boundary' = PostGIS ST_Within fallback */
  source: 'direct' | 'boundary';
};

type PageRow = {
  id: string;
  slug: string | null;
  title: string | null;
  icon: string | null;
  cover_url: string | null;
  page_type: string | null;
  description: string | null;
  address_line: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  is_verified: boolean;
  quality_score: number | null;
};

const PAGE_SELECT =
  'id, slug, title, icon, cover_url, page_type, description, address_line, website, lat, lng, is_verified, quality_score';

function toPage(row: PageRow, source: CityDirectoryPage['source']): CityDirectoryPage {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title ?? '',
    icon: row.icon,
    coverUrl: row.cover_url,
    pageType: row.page_type,
    description: row.description,
    addressLine: row.address_line,
    website: row.website,
    lat: row.lat,
    lng: row.lng,
    isVerified: row.is_verified,
    qualityScore: row.quality_score,
    source,
  };
}

const FALLBACK_THRESHOLD = 5;

/**
 * GET /api/territory/units/[id]/directory
 *
 * Returns directory pages for a CTU in priority order:
 *   1. Direct  — page.pages WHERE city_id = [ctu_id]         (fastest, clean FK)
 *   2. Boundary — PostGIS ST_Within on lat/lng vs CTU polygon (fallback when direct < 5)
 *
 * Query params:
 *   q?      text search on title / description / address
 *   limit?  default 40, max 100
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 40), 100);

    const db = createServiceRoleClient();

    // ── Pass 1: direct city_id match ─────────────────────────────────────────
    let directQ = db
      .schema('page')
      .from('pages')
      .select(PAGE_SELECT)
      .eq('city_id', id)
      .eq('status', 'active')
      .eq('visibility', 'public')
      .order('quality_score', { ascending: false, nullsFirst: false })
      .order('title', { ascending: true })
      .limit(limit);

    if (q) {
      directQ = directQ.or(
        `title.ilike.%${q}%,description.ilike.%${q}%,address_line.ilike.%${q}%`,
      );
    }

    const { data: directRaw, error: directErr } = await directQ;

    if (directErr) {
      console.error('[territory/directory] direct:', directErr.message);
      return NextResponse.json({ error: 'Failed to load directory' }, { status: 500 });
    }

    const directPages = (directRaw ?? []) as PageRow[];
    const directResults = directPages.map((r) => toPage(r, 'direct'));

    if (directResults.length >= FALLBACK_THRESHOLD) {
      return NextResponse.json({ pages: directResults, source: 'direct' });
    }

    // ── Pass 2: PostGIS boundary fallback via SQL function ────────────────────
    const exclIds = directPages.map((p) => p.id);
    const remaining = limit - directResults.length;

    const { data: boundaryRaw, error: boundaryErr } = await db.rpc(
      'get_directory_pages_for_ctu',
      {
        p_ctu_id: id,
        p_query: q,
        p_excl_ids: exclIds,
        p_limit: remaining,
      },
    );

    if (boundaryErr) {
      console.error('[territory/directory] boundary:', boundaryErr.message);
      // Return whatever we have from direct pass rather than failing
      return NextResponse.json({ pages: directResults, source: 'direct' });
    }

    const boundaryResults = ((boundaryRaw ?? []) as PageRow[]).map((r) =>
      toPage(r, 'boundary'),
    );

    const allPages = [...directResults, ...boundaryResults];
    const source = directResults.length > 0 ? 'mixed' : 'boundary';

    return NextResponse.json({ pages: allPages, source });
  } catch (e) {
    console.error('[territory/directory]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
