import { NextRequest, NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import {
  isPageLogoHttpUrl,
  pageTypeName,
  USER_GENERATED_PAGE_TYPE_FILTER,
} from '@/lib/directory/pageTypes';
import {
  asClaimStatus,
  asPageStatus,
  asVisibility,
  pageViewerAccess,
} from '@/lib/directory/pageAudience';
import { createPageServiceClient } from '@/lib/supabase/pageDb';

export const dynamic = 'force-dynamic';

type PageRow = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  page_type: string | null;
  icon: string | null;
  cover_url: string | null;
  visibility: string | null;
  status: string | null;
  address_line: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  owner_id: string | null;
  claimed_by: string | null;
  claim_status: string | null;
};

type MediaRow = {
  page_id: string;
  url: string | null;
  role: string;
};

/**
 * GET /api/accounts/pages
 * Pages the signed-in account created (`owner_id`) or officially claimed (`claimed_by`).
 *
 * `?count=1` — `{ count }` only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const pagesDb = createPageServiceClient();
    const url = new URL(request.url);

    const mine = `owner_id.eq.${session.accountId},claimed_by.eq.${session.accountId}`;

    if (url.searchParams.get('count') === '1') {
      const { count, error } = await pagesDb
        .from('pages')
        .select('id', { count: 'exact', head: true })
        .or(mine)
        .is('entity_id', null)
        .in('page_type', [...USER_GENERATED_PAGE_TYPE_FILTER]);
      if (error) {
        console.error('[accounts/pages count]', error);
        return NextResponse.json({ error: 'Failed to count pages' }, { status: 500 });
      }
      return NextResponse.json({ count: count ?? 0 });
    }

    const { data, error } = await pagesDb
      .from('pages')
      .select(
        'id, slug, title, description, page_type, icon, cover_url, visibility, status, address_line, lat, lng, created_at, owner_id, claimed_by, claim_status',
      )
      .or(mine)
      .is('entity_id', null)
      .in('page_type', [...USER_GENERATED_PAGE_TYPE_FILTER])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[accounts/pages]', error);
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }

    const rows = (data ?? []) as PageRow[];
    const pageIds = rows.map((r) => r.id);
    const logoUrlByPageId: Record<string, string> = {};

    if (pageIds.length > 0) {
      const { data: mediaRows } = await pagesDb
        .from('page_media')
        .select('page_id, url, role')
        .in('page_id', pageIds)
        .eq('role', 'logo')
        .not('url', 'is', null)
        .order('sort_order', { ascending: true });

      for (const row of (mediaRows ?? []) as MediaRow[]) {
        const urlValue = row.url?.trim();
        if (!urlValue || !isPageLogoHttpUrl(urlValue)) continue;
        if (!logoUrlByPageId[row.page_id]) logoUrlByPageId[row.page_id] = urlValue;
      }
    }

    const pages = rows.map((row) => {
      const title = (row.title ?? '').trim() || 'Untitled';
      const icon = row.icon?.trim() || null;
      const logoFromIcon = icon && isPageLogoHttpUrl(icon) ? icon : null;
      const logoUrl = logoUrlByPageId[row.id] ?? logoFromIcon;
      const viewer = pageViewerAccess(session.accountId, row.owner_id, row.claimed_by);
      return {
        id: row.id,
        slug: row.slug,
        title,
        pageType: row.page_type,
        pageTypeLabel: pageTypeName(row.page_type),
        description: row.description,
        addressLine: row.address_line,
        logoUrl,
        icon,
        coverUrl: row.cover_url,
        visibility: asVisibility(row.visibility),
        status: asPageStatus(row.status),
        claimStatus: asClaimStatus(row.claim_status),
        lat: row.lat,
        lng: row.lng,
        isCreator: viewer.isCreator,
        isClaimedOwner: viewer.isClaimedOwner,
        createdAt: row.created_at,
      };
    });

    return NextResponse.json({ pages });
  } catch (e) {
    console.error('[accounts/pages]', e);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}
