import type { ComposeKindId } from '@/features/community/contributionTypes';

export const MARKETPLACE_INTENTS = ['selling', 'free', 'wanted', 'renting'] as const;
export type MarketplaceIntent = (typeof MARKETPLACE_INTENTS)[number];

export const MARKETPLACE_INTENT_LABEL: Record<MarketplaceIntent, string> = {
  selling: 'Selling',
  free: 'Free',
  wanted: 'Wanted',
  renting: 'Renting',
};

export function isMarketplaceIntent(value: unknown): value is MarketplaceIntent {
  return (
    value === 'selling' || value === 'free' || value === 'wanted' || value === 'renting'
  );
}

/** Home-service bid request urgency (portal · Marketplace Wanted). */
export const SERVICE_URGENCIES = ['flexible', 'soon', 'urgent'] as const;
export type ServiceUrgency = (typeof SERVICE_URGENCIES)[number];

export const SERVICE_URGENCY_LABEL: Record<ServiceUrgency, string> = {
  flexible: 'Flexible',
  soon: 'This week',
  urgent: 'ASAP',
};

export function isServiceUrgency(value: unknown): value is ServiceUrgency {
  return value === 'flexible' || value === 'soon' || value === 'urgent';
}

export type ComposeKindMetaInput = {
  eventTitle?: string | null;
  eventStartsAt?: string | null;
  eventEndsAt?: string | null;
  marketplaceIntent?: MarketplaceIntent | null;
  marketplacePrice?: string | null;
  promotionEndsAt?: string | null;
};

export type ServiceRequestMetaInput = {
  category: { id: string; label: string };
  /** Selected trades — at least one. First is primary for legacy `trade` / `trade_label`. */
  trades: Array<{ id: string; label: string }>;
  urgency: ServiceUrgency;
  budget?: string | null;
};

/** Kind-specific meta merged into community.posts.meta. */
export function buildKindMeta(
  kind: ComposeKindId | null | undefined,
  input: ComposeKindMetaInput,
): Record<string, unknown> {
  if (!kind) return {};
  if (kind === 'event' && input.eventStartsAt) {
    return {
      event: {
        starts_at: input.eventStartsAt,
        ...(input.eventEndsAt ? { ends_at: input.eventEndsAt } : {}),
        ...(input.eventTitle?.trim()
          ? { title: input.eventTitle.trim().slice(0, 120) }
          : {}),
      },
    };
  }
  if (kind === 'marketplace' && input.marketplaceIntent) {
    const price =
      input.marketplaceIntent === 'free'
        ? null
        : input.marketplacePrice?.trim().slice(0, 40) || null;
    return {
      marketplace: {
        intent: input.marketplaceIntent,
        ...(price ? { price } : {}),
      },
    };
  }
  if (kind === 'promotion' && input.promotionEndsAt) {
    return { promotion: { ends_at: input.promotionEndsAt } };
  }
  return {};
}

/**
 * Additive meta for `/services` bid requests.
 * Keeps Marketplace · Wanted readable by existing feed/compose paths.
 */
export function buildServiceRequestMeta(
  input: ServiceRequestMetaInput,
): Record<string, unknown> {
  const categoryId = input.category.id.trim().slice(0, 48);
  const categoryLabel =
    input.category.label.trim().slice(0, 80) || categoryId;
  const trades = input.trades
    .map((row) => ({
      id: row.id.trim().slice(0, 48),
      label: row.label.trim().slice(0, 80) || row.id.trim().slice(0, 48),
    }))
    .filter((row) => row.id);
  const primary = trades[0];
  if (!categoryId || !primary) {
    throw new Error('Pick a service category and at least one trade.');
  }
  const tradeLabel =
    trades.length === 1
      ? primary.label
      : trades.map((row) => row.label).join(', ').slice(0, 120);
  const budget = input.budget?.trim().slice(0, 40) || null;
  return {
    marketplace: {
      intent: 'wanted' as const,
      ...(budget ? { price: budget } : {}),
    },
    service_request: {
      category: { id: categoryId, label: categoryLabel },
      category_id: categoryId,
      category_label: categoryLabel,
      trade: primary.id,
      trade_label: tradeLabel,
      trades: trades.map((row) => ({ id: row.id, label: row.label })),
      urgency: input.urgency,
      ...(budget ? { budget } : {}),
    },
  };
}
