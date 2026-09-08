import { NextRequest, NextResponse } from 'next/server';
import { loadAccountRunningAdsStatus } from '@/lib/ads/accountRunningAds';
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
 * GET /api/community/profile/pages?account_id=
 * Pages created or claimed by that account.
 * Self sees drafts/unlisted; everyone else sees public + active only.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get('account_id')?.trim() || null;
    if (!accountId) {
      return NextResponse.json({ error: 'account_id required' }, { status: 400 });
    }

    const session = await getSessionAccount();
    const isSelf = Boolean(session?.accountId && session.accountId === accountId);

    const pagesDb = createPageServiceClient();
    const mine = `owner_id.eq.${accountId},claimed_by.eq.${accountId}`;

    let query = pagesDb
      .from('pages')
      .select(
        'id, slug, title, description, page_type, icon, cover_url, visibility, status, address_line, lat, lng, created_at, owner_id, claimed_by, claim_status',
      )
      .or(mine)
      .is('entity_id', null)
      .in('page_type', [...USER_GENERATED_PAGE_TYPE_FILTER])
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isSelf) {
      query = query.eq('visibility', 'public').eq('status', 'active');
    }

    const { data, error } = await query;
    if (error) {
      console.error('[community/profile/pages]', error);
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
      const viewer = pageViewerAccess(session?.accountId, row.owner_id, row.claimed_by);
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

    let runningAds = {
      hasRunningAds: false,
      pageCount: 0,
      creativeCount: 0,
      pageIds: [] as string[],
    };
    try {
      runningAds = await loadAccountRunningAdsStatus(accountId);
    } catch (e) {
      console.error('[community/profile/pages] runningAds', e);
    }

    return NextResponse.json({ pages, runningAds });
  } catch (e) {
    console.error('[community/profile/pages]', e);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
}
