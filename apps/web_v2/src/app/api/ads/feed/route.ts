import { NextResponse } from 'next/server';
import {
  listFeedAdsForSlot,
  parseFeedAdSlot,
} from '@/lib/ads/listFeedAds';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ads/feed?slot=main_feed|ads_feed&limit=12
 * Returns funded active placements for interleaving into feed UIs.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slot = parseFeedAdSlot(url.searchParams.get('slot'));
    if (!slot) {
      return NextResponse.json(
        { error: 'slot must be ads_feed, homepage, or main_feed' },
        { status: 400 },
      );
    }
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '12', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(40, Math.max(1, limitRaw)) : 12;
    const items = await listFeedAdsForSlot(slot, limit);
    return NextResponse.json({ items, slot });
  } catch (e) {
    console.error('[ads/feed]', e);
    return NextResponse.json({ error: 'Failed to load ads' }, { status: 500 });
  }
}
