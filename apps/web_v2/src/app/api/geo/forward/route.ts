import { NextResponse } from 'next/server';
import { searchMinnesotaForward } from '@/lib/geo/minnesotaMapbox';
import { MAP_CONFIG } from '@/map/config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/geo/forward?q=&limit=
 * Minnesota-biased address / place search for universal search + locate.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const rawLimit = Number(url.searchParams.get('limit') ?? 5) || 5;
    const limit = Math.min(8, Math.max(1, rawLimit));

    if (q.length < 2) {
      return NextResponse.json({ hits: [] });
    }
    if (q.length > 120) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }
    if (!MAP_CONFIG.MAPBOX_TOKEN) {
      return NextResponse.json({ error: 'Geocoding not configured' }, { status: 503 });
    }

    const hits = await searchMinnesotaForward(q, limit);
    return NextResponse.json({ hits });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[api/geo/forward]', err);
    }
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
