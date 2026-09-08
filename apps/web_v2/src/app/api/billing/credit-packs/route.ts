import { NextResponse } from 'next/server';

/**
 * POST /api/billing/credit-packs
 *
 * V1 App Store build is earn-only — credit packs / IAP / Stripe checkout are disabled.
 * Credits come from map collects + plan grants. Re-enable with RevenueCat in a later build.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Credit purchases are not available in this version.',
      code: 'EARN_ONLY',
      note: 'Earn credits by collecting coins and finds on the map.',
    },
    { status: 410 },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      purchasesEnabled: false,
      packs: [],
      note: 'Earn-only V1 — no credit packs offered.',
    },
    { status: 200 },
  );
}
