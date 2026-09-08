/** Category / maki string → emoji chip for nearby-place UI (carousel, callout, listing). */

export type NearbyPlaceCategoryChip = {
  emoji: string;
  label: string;
};

const DEFAULT_EMOJI = '📍';

/** Ordered so more specific keywords win over generic ones (e.g. "fast food" before "food"). */
const CATEGORY_EMOJI_RULES: Array<{ match: RegExp; emoji: string }> = [
  { match: /coffee|cafe/i, emoji: '☕️' },
  { match: /bar|pub|brewery|winery/i, emoji: '🍺' },
  { match: /pizza/i, emoji: '🍕' },
  { match: /bakery/i, emoji: '🥐' },
  { match: /fast.?food|burger/i, emoji: '🍔' },
  { match: /restaurant|food|dining|eatery/i, emoji: '🍽️' },
  { match: /grocery|supermarket|market/i, emoji: '🛒' },
  { match: /shop|store|retail|boutique|mall/i, emoji: '🛍️' },
  { match: /park|trail|garden|nature/i, emoji: '🌳' },
  { match: /beach|lake|water/i, emoji: '🏖️' },
  { match: /museum|gallery|art/i, emoji: '🖼️' },
  { match: /hotel|lodging/i, emoji: '🛏️' },
  { match: /gym|fitness|yoga/i, emoji: '💪' },
  { match: /school|university|college/i, emoji: '🎓' },
  { match: /hospital|clinic|pharmacy|medical/i, emoji: '⚕️' },
  { match: /bank|atm|finance/i, emoji: '🏦' },
  { match: /gas|fuel|charging/i, emoji: '⛽️' },
  { match: /theater|theatre|cinema|movie/i, emoji: '🎬' },
  { match: /church|worship|temple/i, emoji: '⛪️' },
];

/** Map a Mapbox category / maki string to an emoji + display label. */
export function nearbyPlaceCategoryChip(category: string): NearbyPlaceCategoryChip {
  const label = category.trim() || 'Place';
  const rule = CATEGORY_EMOJI_RULES.find((r) => r.match.test(label));
  return { emoji: rule?.emoji ?? DEFAULT_EMOJI, label };
}
