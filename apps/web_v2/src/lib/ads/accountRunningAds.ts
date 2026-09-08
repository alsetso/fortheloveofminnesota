import { getEventCreditCosts, getWalletBalance } from '@/lib/ads/credits';
import { getAdsServiceDb, getPageServiceDb } from '@/lib/ads/adsServiceDb';
import { USER_GENERATED_PAGE_TYPE_FILTER } from '@/lib/directory/pageTypes';

export type AccountRunningAdsStatus = {
  /** True when ≥1 owned/claimed page has an active, placed, funded creative. */
  hasRunningAds: boolean;
  /** Distinct pages currently advertising. */
  pageCount: number;
  /** Active creatives with a live placement on a funded page. */
  creativeCount: number;
  /** Page ids that are currently advertising (funded + placed). */
  pageIds: string[];
};

/**
 * Whether this account is currently running ads through any of their pages.
 * Matches the page-level rule: active creative + active placement + wallet ≥ impression cost.
 */
export async function loadAccountRunningAdsStatus(
  accountId: string,
): Promise<AccountRunningAdsStatus> {
  const empty: AccountRunningAdsStatus = {
    hasRunningAds: false,
    pageCount: 0,
    creativeCount: 0,
    pageIds: [],
  };

  const pagesDb = getPageServiceDb();
  const mine = `owner_id.eq.${accountId},claimed_by.eq.${accountId}`;
  const { data: pageRows, error: pagesError } = await pagesDb
    .from('pages')
    .select('id')
    .or(mine)
    .is('entity_id', null)
    .in('page_type', [...USER_GENERATED_PAGE_TYPE_FILTER])
    .limit(100);

  if (pagesError || !pageRows?.length) return empty;

  const pageIds = (pageRows as Array<{ id: string }>).map((r) => r.id);
  const adsDb = getAdsServiceDb();

  const { data: creatives } = await adsDb
    .from('ad_creatives')
    .select('id, page_id')
    .in('page_id', pageIds)
    .eq('status', 'active');

  const creativeRows = (creatives ?? []) as Array<{ id: string; page_id: string }>;
  if (creativeRows.length === 0) return empty;

  const creativeIds = creativeRows.map((c) => c.id);
  const { data: placementRows } = await adsDb
    .from('placements')
    .select('creative_id')
    .in('creative_id', creativeIds)
    .eq('status', 'active');

  const placedCreativeIds = new Set(
    ((placementRows ?? []) as Array<{ creative_id: string }>).map((p) => p.creative_id),
  );
  if (placedCreativeIds.size === 0) return empty;

  const placedByPage = new Map<string, number>();
  for (const c of creativeRows) {
    if (!placedCreativeIds.has(c.id)) continue;
    placedByPage.set(c.page_id, (placedByPage.get(c.page_id) ?? 0) + 1);
  }
  if (placedByPage.size === 0) return empty;

  const impressionCost = (await getEventCreditCosts()).impression;
  const pageIdsRunning: string[] = [];
  let creativeCount = 0;

  for (const [pageId, count] of placedByPage) {
    let balance = 0;
    try {
      balance = await getWalletBalance(pageId);
    } catch {
      balance = 0;
    }
    if (balance < impressionCost) continue;
    pageIdsRunning.push(pageId);
    creativeCount += count;
  }

  return {
    hasRunningAds: pageIdsRunning.length > 0,
    pageCount: pageIdsRunning.length,
    creativeCount,
    pageIds: pageIdsRunning,
  };
}
