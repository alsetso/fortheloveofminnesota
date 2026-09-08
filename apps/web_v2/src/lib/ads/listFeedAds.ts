import { getEventCreditCosts, getWalletBalance } from '@/lib/ads/credits';
import { getAdsServiceDb, getPageServiceDb } from '@/lib/ads/adsServiceDb';
import {
  isPlatformPlacementSlot,
  type PlatformPlacementSlot,
} from '@/lib/ads/placementSlots';

export type FeedAdPromo = {
  placementId: string;
  creativeId: string;
  advertiserPageId: string;
  advertiserSlug: string;
  advertiserTitle: string;
  advertiserLogoUrl: string | null;
  caption: string;
  imageUrl: string;
  destinationUrl: string;
  ctaLabel: string;
};

function isHttpUrl(url: string | null | undefined): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'));
}

/**
 * Funded, active placements for a platform slot — enough to interleave into a feed.
 * Ordered by least-recently served so rotation stays fair across scrolls.
 */
export async function listFeedAdsForSlot(
  slot: PlatformPlacementSlot,
  limit = 12,
): Promise<FeedAdPromo[]> {
  const adsDb = getAdsServiceDb();
  const { data: placementRows, error } = await adsDb
    .from('placements')
    .select('id, creative_id, last_served_at')
    .eq('platform_slot', slot)
    .eq('status', 'active')
    .order('last_served_at', { ascending: true, nullsFirst: true })
    .limit(Math.min(40, Math.max(1, limit * 3)));

  if (error || !placementRows?.length) return [];

  const creativeIds = [
    ...new Set((placementRows as { creative_id: string }[]).map((r) => r.creative_id)),
  ];

  const { data: creatives } = await adsDb
    .from('ad_creatives')
    .select('id, page_id, caption, image_url, destination_url, cta_type, cta_payload, status')
    .in('id', creativeIds)
    .eq('status', 'active');

  if (!creatives?.length) return [];

  type CreativeRow = {
    id: string;
    page_id: string;
    caption: string;
    image_url: string;
    destination_url: string;
    cta_type: string | null;
    cta_payload: unknown;
  };

  const impressionCost = (await getEventCreditCosts()).impression;
  const balanceCache = new Map<string, number>();
  const funded: CreativeRow[] = [];

  for (const c of creatives as CreativeRow[]) {
    let balance = balanceCache.get(c.page_id);
    if (balance === undefined) {
      try {
        balance = await getWalletBalance(c.page_id);
      } catch {
        balance = 0;
      }
      balanceCache.set(c.page_id, balance);
    }
    if (balance >= impressionCost) funded.push(c);
  }

  if (!funded.length) return [];

  const fundedIds = new Set(funded.map((c) => c.id));
  const advertiserIds = [...new Set(funded.map((c) => c.page_id))];
  const pagesDb = getPageServiceDb();
  const { data: advertiserPages } = await pagesDb
    .from('pages')
    .select('id, slug, title, icon')
    .in('id', advertiserIds);

  const advertiserById = new Map(
    ((advertiserPages ?? []) as Array<{
      id: string;
      slug: string;
      title: string;
      icon: string | null;
    }>).map((p) => [
      p.id,
      {
        slug: p.slug,
        title: p.title,
        logoUrl: isHttpUrl(p.icon) ? p.icon!.trim() : null,
      },
    ]),
  );

  const creativeById = new Map(funded.map((c) => [c.id, c]));
  const out: FeedAdPromo[] = [];

  for (const row of placementRows as Array<{
    id: string;
    creative_id: string;
  }>) {
    if (!fundedIds.has(row.creative_id)) continue;
    const c = creativeById.get(row.creative_id);
    if (!c) continue;
    const adv = advertiserById.get(c.page_id);
    const payload = c.cta_payload as { label?: string } | null;
    out.push({
      placementId: row.id,
      creativeId: c.id,
      advertiserPageId: c.page_id,
      advertiserSlug: adv?.slug ?? '',
      advertiserTitle: adv?.title ?? 'Sponsored',
      advertiserLogoUrl: adv?.logoUrl ?? null,
      caption: c.caption,
      imageUrl: c.image_url,
      destinationUrl: c.destination_url,
      ctaLabel: payload?.label?.trim() || 'Learn more',
    });
    if (out.length >= limit) break;
  }

  return out;
}

export function parseFeedAdSlot(raw: string | null | undefined): PlatformPlacementSlot | null {
  if (!raw) return null;
  return isPlatformPlacementSlot(raw) ? raw : null;
}
