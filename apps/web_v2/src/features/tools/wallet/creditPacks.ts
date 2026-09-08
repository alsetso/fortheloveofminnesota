/**
 * One-time tool credit packs — ios-2 “buy when you need” model.
 * Monthly hobby grant still exists as the free floor; packs top up the same purse.
 * Prices match App Store / Stripe: $9.99 / $49.99 / $99.99.
 */

export type CreditPackId = 'pack_25' | 'pack_100' | 'pack_250';

export type CreditPack = {
  id: CreditPackId;
  credits: number;
  /** Display price (USD). Stripe price IDs wire via env when ready. */
  priceUsd: number;
  label: string;
  blurb: string;
  /** Optional Stripe Price id env key name */
  stripePriceEnv: string;
  /** RevenueCat / App Store product id */
  revenueCatProductId: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_25',
    credits: 25,
    priceUsd: 9.99,
    label: 'Starter',
    blurb: '25 lookups',
    stripePriceEnv: 'STRIPE_TOOL_CREDITS_PACK_25_PRICE_ID',
    revenueCatProductId: 'tool_credits_25',
  },
  {
    id: 'pack_100',
    credits: 100,
    priceUsd: 49.99,
    label: 'Plus',
    blurb: '100 lookups',
    stripePriceEnv: 'STRIPE_TOOL_CREDITS_PACK_100_PRICE_ID',
    revenueCatProductId: 'tool_credits_100',
  },
  {
    id: 'pack_250',
    credits: 250,
    priceUsd: 99.99,
    label: 'Pro',
    blurb: '250 lookups',
    stripePriceEnv: 'STRIPE_TOOL_CREDITS_PACK_250_PRICE_ID',
    revenueCatProductId: 'tool_credits_250',
  },
];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/** Reverse lookup — RevenueCat / App Store product id → pack (used by the webhook). */
export function getCreditPackByProductId(productId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.revenueCatProductId === productId);
}

export function formatPackPrice(usd: number): string {
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}
