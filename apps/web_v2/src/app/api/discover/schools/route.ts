import { NextResponse } from 'next/server';
import { querySchoolCatalog } from '@/lib/schools/serverCatalog';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

/**
 * GET /api/discover/schools?offset=0&limit=25&q=
 *
 * Alphabetical K–12 schools from `territory.schools`, with district name
 * when available. Fuzzy filter via ilike on name.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
    const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
    const q = (url.searchParams.get('q') ?? '').trim();

    const { rows, total } = await querySchoolCatalog({ q, offset, limit });

    return NextResponse.json({
      rows,
      total,
      offset,
      limit,
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[discover schools]', err);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
