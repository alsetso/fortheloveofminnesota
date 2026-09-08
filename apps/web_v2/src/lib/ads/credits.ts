export const CREDIT_COST_DEFAULTS = {
  impression: 1,
  click: 5,
} as const;

export type AdEventType = keyof typeof CREDIT_COST_DEFAULTS;

export type EventCreditCosts = Record<AdEventType, number>;

export async function getEventCreditCosts(): Promise<EventCreditCosts> {
  const { getAdsServiceDb } = await import('@/lib/ads/adsServiceDb');
  const adsDb = getAdsServiceDb();
  const { data, error } = await adsDb
    .from('event_credit_costs')
    .select('event_type, credits');

  const costs: EventCreditCosts = { ...CREDIT_COST_DEFAULTS };
  if (error || !data?.length) return costs;

  for (const row of data as Array<{ event_type: string; credits: number }>) {
    if (row.event_type === 'impression' || row.event_type === 'click') {
      const n = Number(row.credits);
      if (Number.isFinite(n) && n >= 0) costs[row.event_type] = n;
    }
  }
  return costs;
}

export async function getWalletBalance(pageId: string): Promise<number> {
  const { getAdsServiceDb } = await import('@/lib/ads/adsServiceDb');
  const adsDb = getAdsServiceDb();
  const { data, error } = await adsDb.rpc('wallet_balance', { p_page_id: pageId });
  if (error) throw new Error(`wallet_balance: ${error.message}`);
  if (typeof data === 'number') return data;
  const parsed = Number.parseFloat(String(data ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}
