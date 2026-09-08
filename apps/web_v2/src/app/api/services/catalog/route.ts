import { NextResponse } from 'next/server';
import { getServiceCatalog } from '@/lib/services/catalog';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services/catalog — home-service categories + trades.
 * Public read; posting still requires auth via /api/community/posts.
 */
export async function GET() {
  const catalog = getServiceCatalog();
  return NextResponse.json(catalog, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
