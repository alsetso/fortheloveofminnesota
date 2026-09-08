/**
 * contributionTypes — Minnesota map contribution taxonomy.
 *
 * Compose kinds (v2): Event · Marketplace · Promotion · Note.
 * Legacy report/highlight/story/idea stay for reading old pins.
 * Stable UUIDs match community.post_types / public.mention_types.
 */

// ─── Category IDs ────────────────────────────────────────────────────────────

export type ContributionCategoryId =
  | 'event'
  | 'marketplace'
  | 'promotion'
  | 'note'
  | 'report'
  | 'highlight'
  | 'story'
  | 'idea';

export const CATEGORY_UUID: Record<ContributionCategoryId, string> = {
  event: '11111111-0000-0000-0000-000000000003',
  marketplace: '11111111-0000-0000-0000-000000000006',
  promotion: '11111111-0000-0000-0000-000000000007',
  note: '11111111-0000-0000-0000-000000000008',
  report: '11111111-0000-0000-0000-000000000001',
  highlight: '11111111-0000-0000-0000-000000000002',
  story: '11111111-0000-0000-0000-000000000004',
  idea: '11111111-0000-0000-0000-000000000005',
};

/**
 * Resolve mention_type_id / category_id from a contribution slug.
 * Free compose defaults to Note.
 */
export function resolveMentionTypeId(
  categorySlug?: string | null,
  fallback: ContributionCategoryId = 'note',
): string {
  if (categorySlug && categorySlug in CATEGORY_UUID) {
    return CATEGORY_UUID[categorySlug as ContributionCategoryId];
  }
  return CATEGORY_UUID[fallback];
}

export type ContributionSubtype = {
  slug: string;
  label: string;
  emoji: string;
  description: string;
  composePlaceholder: string;
};

export type ContributionCategory = {
  id: ContributionCategoryId;
  slug: ContributionCategoryId;
  label: string;
  description: string;
  /** Longer copy for the kind picker step. */
  detail: string;
  emoji: string;
  subtypes: ContributionSubtype[];
};

export const CONTRIBUTION_CATEGORIES: ContributionCategory[] = [
  {
    id: 'event',
    slug: 'event',
    label: 'Event',
    description: 'Something happening people might attend.',
    detail:
      'Anything happening at a specific time/place people might want to attend — festivals, farmers markets, garage/estate sales, meetups, school or sports games, concerts, pop-ups, fundraisers, block parties.',
    emoji: '📅',
    subtypes: [],
  },
  {
    id: 'marketplace',
    slug: 'marketplace',
    label: 'Marketplace',
    description: 'Buy, sell, give away, rent, or request.',
    detail:
      'Anything being bought, sold, given away, rented, or requested — items for sale, free stuff, vehicles, housing/rentals/sublets, services offered, services wanted, jobs/gigs, trades/barters.',
    emoji: '🏷️',
    subtypes: [],
  },
  {
    id: 'promotion',
    slug: 'promotion',
    label: 'Promotion',
    description: 'Business or org visibility.',
    detail:
      'Business or organization-driven visibility — deals/specials, grand openings, check out this shop, sponsored features, loyalty pushes, seasonal business announcements.',
    emoji: '📣',
    subtypes: [],
  },
  {
    id: 'note',
    slug: 'note',
    label: 'Note',
    description: 'Tips, observations, recommendations.',
    detail:
      'Low-urgency personal or opinion content meant to inform or entertain — personal notes, recommendations, hidden-gem tips, general observations, reviews of a place.',
    emoji: '📝',
    subtypes: [],
  },
  // Legacy — readable on old pins; not in compose chrome.
  {
    id: 'report',
    slug: 'report',
    label: 'Report',
    description: 'Something needs attention.',
    detail: 'Something needs attention.',
    emoji: '🚨',
    subtypes: [],
  },
  {
    id: 'highlight',
    slug: 'highlight',
    label: 'Highlight',
    description: 'Something worth knowing.',
    detail: 'Something worth knowing.',
    emoji: '⭐',
    subtypes: [],
  },
  {
    id: 'story',
    slug: 'story',
    label: 'Story',
    description: 'Something worth remembering.',
    detail: 'Something worth remembering.',
    emoji: '📖',
    subtypes: [],
  },
  {
    id: 'idea',
    slug: 'idea',
    label: 'Idea',
    description: 'Something should happen.',
    detail: 'Something should happen.',
    emoji: '💡',
    subtypes: [],
  },
];

export const CONTRIBUTION_CATEGORY_MAP = new Map<ContributionCategoryId, ContributionCategory>(
  CONTRIBUTION_CATEGORIES.map((c) => [c.id, c]),
);

export function getContributionCategory(id: ContributionCategoryId): ContributionCategory {
  return CONTRIBUTION_CATEGORY_MAP.get(id) ?? CONTRIBUTION_CATEGORIES[0]!;
}

/** Create Post kinds — Event / Marketplace / Promotion / Note. */
export const COMPOSE_KIND_IDS = ['event', 'marketplace', 'promotion', 'note'] as const;
export type ComposeKindId = (typeof COMPOSE_KIND_IDS)[number];

export const COMPOSE_CATEGORIES = CONTRIBUTION_CATEGORIES.filter((row) =>
  COMPOSE_KIND_IDS.includes(row.id as ComposeKindId),
);

export const COMPOSE_PLACEHOLDER: Record<ComposeKindId, string> = {
  event: 'What’s happening — when, where, and what should people expect?',
  marketplace: 'What are you offering or looking for? Price, condition, how to reach you…',
  promotion: 'What’s the deal, opening, or announcement?',
  note: 'What’s worth knowing about this place?',
};

export function isComposeKind(id: string | null | undefined): id is ComposeKindId {
  return (
    id === 'event' || id === 'marketplace' || id === 'promotion' || id === 'note'
  );
}

export function composeCategoryBySlug(
  slug: string | null | undefined,
): (ContributionCategory & { id: ComposeKindId }) | null {
  if (!isComposeKind(slug)) return null;
  const category = CONTRIBUTION_CATEGORY_MAP.get(slug);
  if (!category) return null;
  return category as ContributionCategory & { id: ComposeKindId };
}
