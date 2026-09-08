import { NextResponse } from 'next/server';
import type { DirectoryPagePin } from '@/lib/directory/directoryPageTypes';
import {
  isPageLogoHttpUrl,
  pageTypeName,
  USER_GENERATED_PAGE_TYPE_FILTER,
} from '@/lib/directory/pageTypes';
import { createPageServiceClient } from '@/lib/supabase/pageDb';

export const dynamic = 'force-dynamic';

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  icon: string | null;
  cover_url: string | null;
  page_type: string | null;
  description: string | null;
  address_line: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
};

type MediaRow = {
  page_id: string;
  url: string | null;
  role: string;
};

/**
 * GET /api/directory/pages
 * Public user-generated directory pins (coords + resolved logo) for the map layer.
 */
export async function GET() {
  try {
    const pagesDb = createPageServiceClient();

    const { data: rows, error } = await pagesDb
      .from('pages')
      .select(
        'id, slug, title, icon, cover_url, page_type, description, address_line, website, lat, lng',
      )
      .eq('visibility', 'public')
      .eq('status', 'active')
      .in('page_type', [...USER_GENERATED_PAGE_TYPE_FILTER])
      .is('entity_id', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('title', { ascending: true })
      .limit(1000);

    if (error) {
      console.error('[directory/pages]', error);
      return NextResponse.json({ error: 'Failed to load pages' }, { status: 500 });
    }

    const pageRows = (rows ?? []) as PageRow[];
    const pageIds = pageRows.map((r) => r.id);

    const logoUrlByPageId: Record<string, string> = {};
    const coverUrlByPageId: Record<string, string> = {};
    if (pageIds.length > 0) {
      const { data: mediaRows } = await pagesDb
        .from('page_media')
        .select('page_id, url, role')
        .in('page_id', pageIds)
        .in('role', ['logo', 'cover'])
        .not('url', 'is', null)
        .order('sort_order', { ascending: true });

      for (const row of (mediaRows ?? []) as MediaRow[]) {
        const url = row.url?.trim();
        if (!url || !isPageLogoHttpUrl(url)) continue;
        if (row.role === 'logo' && !logoUrlByPageId[row.page_id]) {
          logoUrlByPageId[row.page_id] = url;
        }
        if (row.role === 'cover' && !coverUrlByPageId[row.page_id]) {
          coverUrlByPageId[row.page_id] = url;
        }
      }
    }

    const pages: DirectoryPagePin[] = [];
    for (const row of pageRows) {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
      const icon = row.icon?.trim() || null;
      const iconHttp = isPageLogoHttpUrl(icon) ? icon : null;
      const coverDirect =
        typeof row.cover_url === 'string' && isPageLogoHttpUrl(row.cover_url)
          ? row.cover_url.trim()
          : null;
      pages.push({
        id: row.id,
        slug: row.slug,
        title: (row.title ?? '').trim() || 'Untitled',
        pageType: row.page_type,
        pageTypeLabel: pageTypeName(row.page_type),
        description: row.description?.trim() || null,
        addressLine: row.address_line?.trim() || null,
        logoUrl: logoUrlByPageId[row.id] ?? iconHttp,
        icon,
        coverUrl: coverUrlByPageId[row.id] ?? coverDirect,
        website: row.website?.trim() || null,
        lat: row.lat as number,
        lng: row.lng as number,
      });
    }

    return NextResponse.json(
      { pages },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (e) {
    console.error('[directory/pages]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
