import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { isPageLogoHttpUrl, pageTypeName } from '@/lib/directory/pageTypes';
import { createPageServiceClient } from '@/lib/supabase/pageDb';

export const dynamic = 'force-dynamic';

type FavoriteRow = {
  page_id: string;
  created_at: string;
};

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  page_type: string | null;
  icon: string | null;
  address_line: string | null;
  visibility: string | null;
  status: string | null;
};

type MediaRow = {
  page_id: string;
  url: string | null;
};

/**
 * GET /api/directory/favorites
 * Saved pages for the signed-in account (Contacts → Businesses).
 *
 * `?page_id=` — `{ saved: boolean }` for a single page.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const pagesDb = createPageServiceClient();
    const pageIdParam = new URL(request.url).searchParams.get('page_id')?.trim() || null;

    if (pageIdParam) {
      const { data, error } = await pagesDb
        .from('page_favorites')
        .select('page_id')
        .eq('account_id', session.accountId)
        .eq('page_id', pageIdParam)
        .maybeSingle();
      if (error) {
        console.error('[directory/favorites get one]', error);
        return NextResponse.json({ error: 'Failed to check save' }, { status: 500 });
      }
      return NextResponse.json({ saved: Boolean(data), page_id: pageIdParam });
    }

    const { data: rows, error } = await pagesDb
      .from('page_favorites')
      .select('page_id, created_at')
      .eq('account_id', session.accountId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[directory/favorites list]', error);
      return NextResponse.json({ error: 'Failed to load saved pages' }, { status: 500 });
    }

    const favorites = (rows ?? []) as FavoriteRow[];
    const pageIds = favorites.map((r) => r.page_id);
    if (pageIds.length === 0) {
      return NextResponse.json({ pages: [], page_ids: [] });
    }

    const { data: pageRows, error: pagesError } = await pagesDb
      .from('pages')
      .select('id, slug, title, page_type, icon, address_line, visibility, status')
      .in('id', pageIds);

    if (pagesError) {
      console.error('[directory/favorites pages]', pagesError);
      return NextResponse.json({ error: 'Failed to load saved pages' }, { status: 500 });
    }

    const byId = new Map(((pageRows ?? []) as PageRow[]).map((p) => [p.id, p]));
    const logoUrlByPageId: Record<string, string> = {};
    const { data: mediaRows } = await pagesDb
      .from('page_media')
      .select('page_id, url')
      .in('page_id', pageIds)
      .eq('role', 'logo')
      .not('url', 'is', null)
      .order('sort_order', { ascending: true });

    for (const row of (mediaRows ?? []) as MediaRow[]) {
      const urlValue = row.url?.trim();
      if (!urlValue || !isPageLogoHttpUrl(urlValue)) continue;
      if (!logoUrlByPageId[row.page_id]) logoUrlByPageId[row.page_id] = urlValue;
    }

    const pages = pageIds
      .map((id) => {
        const row = byId.get(id);
        if (!row) return null;
        const title = (row.title ?? '').trim() || 'Untitled';
        const icon = row.icon?.trim() || null;
        const logoFromIcon = icon && isPageLogoHttpUrl(icon) ? icon : null;
        return {
          id: row.id,
          slug: row.slug,
          title,
          pageType: row.page_type,
          pageTypeLabel: pageTypeName(row.page_type),
          addressLine: row.address_line,
          logoUrl: logoUrlByPageId[row.id] ?? logoFromIcon,
          icon,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ pages, page_ids: pageIds });
  } catch (err) {
    console.error('[directory/favorites GET]', err);
    return NextResponse.json({ error: 'Failed to load saved pages' }, { status: 500 });
  }
}

/**
 * POST /api/directory/favorites — Save to book. Body: { page_id }
 * DELETE /api/directory/favorites — Remove from book. Body: { page_id }
 */
async function mutate(
  request: NextRequest,
  method: 'add' | 'remove',
) {
  const session = await getSessionAccount();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { page_id?: unknown } | null;
  const pageId = typeof body?.page_id === 'string' ? body.page_id.trim() : '';
  if (!pageId) {
    return NextResponse.json({ error: 'page_id required' }, { status: 400 });
  }

  const pagesDb = createPageServiceClient();

  if (method === 'add') {
    const { data: page, error: pageError } = await pagesDb
      .from('pages')
      .select('id, owner_id, claimed_by')
      .eq('id', pageId)
      .maybeSingle();
    if (pageError) {
      console.error('[directory/favorites add page]', pageError);
      return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
    }
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const { error } = await pagesDb.from('page_favorites').upsert(
      { account_id: session.accountId, page_id: pageId },
      { onConflict: 'account_id,page_id', ignoreDuplicates: true },
    );
    if (error) {
      console.error('[directory/favorites add]', error);
      return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
    }
    return NextResponse.json({ saved: true, page_id: pageId });
  }

  const { error } = await pagesDb
    .from('page_favorites')
    .delete()
    .eq('account_id', session.accountId)
    .eq('page_id', pageId);
  if (error) {
    console.error('[directory/favorites remove]', error);
    return NextResponse.json({ error: 'Failed to remove page' }, { status: 500 });
  }
  return NextResponse.json({ saved: false, page_id: pageId });
}

export async function POST(request: NextRequest) {
  try {
    return await mutate(request, 'add');
  } catch (err) {
    console.error('[directory/favorites POST]', err);
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return await mutate(request, 'remove');
  } catch (err) {
    console.error('[directory/favorites DELETE]', err);
    return NextResponse.json({ error: 'Failed to remove page' }, { status: 500 });
  }
}
