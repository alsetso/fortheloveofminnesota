/**
 * Canonical XP source catalog — labels, categories, and which sources are
 * claimable vs auto-claimed. Keep in sync with
 * account_xp_transactions_source_type_check and
 * game_economy_versions.source_xp_by_type.
 */

export const XP_SOURCE_TYPES = [
  'collect',
  'territory_unlock',
  'daily_streak',
  'bonus',
  'gift',
  'referral',
] as const;

export type XpSourceType = (typeof XP_SOURCE_TYPES)[number];

/** How the source participates in the economy. */
export type XpSourceCategory =
  /** Finite progression pool — counted in xp_ceiling(). */
  | 'progression'
  /** Repeatable engagement (login streak) — versioned rate, outside ceiling. */
  | 'engagement'
  /** Promo / grant / gift — one-off or campaign, outside ceiling. */
  | 'bonus';

export type XpSourceMeta = {
  type: XpSourceType;
  /** Short label for XP sources lists. */
  label: string;
  /** Unclaimed / claim sheet label. */
  claimLabel: string;
  category: XpSourceCategory;
  /** false = auto-claimed at write time (collect). */
  requiresClaim: boolean;
  /** Rate lives on game_economy_versions.source_xp_by_type. */
  economyKeyed: boolean;
};

export const XP_SOURCES: Record<XpSourceType, XpSourceMeta> = {
  collect: {
    type: 'collect',
    label: 'Collecting',
    claimLabel: 'Collectible',
    category: 'progression',
    requiresClaim: false,
    economyKeyed: false,
  },
  territory_unlock: {
    type: 'territory_unlock',
    label: 'Area unlocks',
    claimLabel: 'Area unlocked',
    category: 'progression',
    requiresClaim: true,
    economyKeyed: false,
  },
  daily_streak: {
    type: 'daily_streak',
    label: 'Daily streak',
    claimLabel: 'Daily streak',
    category: 'engagement',
    requiresClaim: true,
    economyKeyed: true,
  },
  bonus: {
    type: 'bonus',
    label: 'Bonus',
    claimLabel: 'Bonus XP',
    category: 'bonus',
    requiresClaim: true,
    economyKeyed: true,
  },
  gift: {
    type: 'gift',
    label: 'Gift',
    claimLabel: 'Gift XP',
    category: 'bonus',
    requiresClaim: true,
    economyKeyed: true,
  },
  referral: {
    type: 'referral',
    label: 'Referral code',
    claimLabel: 'Referral reward',
    category: 'bonus',
    requiresClaim: false,
    economyKeyed: false,
  },
};

/** Engagement / bonus rates editable on economy versions. */
export const ECONOMY_SOURCE_RATE_KEYS = ['daily_streak', 'bonus', 'gift'] as const;
export type EconomySourceRateKey = (typeof ECONOMY_SOURCE_RATE_KEYS)[number];

export const DEFAULT_SOURCE_XP_BY_TYPE: Record<EconomySourceRateKey, number> = {
  daily_streak: 250,
  bonus: 0,
  gift: 0,
};

export function xpSourceLabel(sourceType: string): string {
  return XP_SOURCES[sourceType as XpSourceType]?.label ?? sourceType;
}

export function xpSourceClaimLabel(sourceType: string): string {
  return XP_SOURCES[sourceType as XpSourceType]?.claimLabel ?? sourceType;
}

export function xpSourceCategory(sourceType: string): XpSourceCategory | null {
  return XP_SOURCES[sourceType as XpSourceType]?.category ?? null;
}

/**
 * Display labels for territory unit kinds — used in the XP activity feed and
 * passport UI whenever a territory_unlock row needs a type label.
 */
export const TERRITORY_KIND_LABELS: Record<string, string> = {
  ctu: 'City / township',
  county: 'County',
  school_district: 'School district',
  district: 'Congressional district',
  congressional: 'Congressional district',
  senate_district: 'Senate district',
  house_district: 'House district',
  legislative: 'Legislative district',
  zipcode: 'ZIP code',
};

export function territoryKindLabel(kind: string): string {
  return TERRITORY_KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}
