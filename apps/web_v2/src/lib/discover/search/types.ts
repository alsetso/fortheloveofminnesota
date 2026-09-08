/** Discover search — normalized hit types for `/api/discover/search`. */

export type DiscoverSearchKind =
  | 'page'
  | 'territory'
  | 'atlas_feature'
  | 'atlas_collection'
  | 'place'
  | 'experience_zone'
  | 'school'
  | 'post'
  | 'account';

export type DiscoverSearchHit = {
  kind: DiscoverSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  kindLabel: string;
  href: string | null;
  meta?: {
    lat?: number;
    lng?: number;
    slug?: string;
    collectionSlug?: string;
    username?: string | null;
    imageUrl?: string | null;
  };
};

export type DiscoverSearchSection = {
  kind: DiscoverSearchKind;
  label: string;
  hits: DiscoverSearchHit[];
};

export type DiscoverSearchCompletedVia = 'result_open' | 'submit';

export type DiscoverSearchRecentRow = {
  id: string;
  query: string;
  createdAt: string;
  completedVia: DiscoverSearchCompletedVia;
  hitKind: DiscoverSearchKind | null;
  hitTitle: string | null;
  hitHref: string | null;
};

/** Payload written when a Discover search completes. */
export type DiscoverSearchPersistInput = {
  query: string;
  completedVia: DiscoverSearchCompletedVia;
  hitKind?: DiscoverSearchKind | null;
  hitId?: string | null;
  hitTitle?: string | null;
  hitHref?: string | null;
};

export type DiscoverSearchResponse = {
  query: string;
  sections: DiscoverSearchSection[];
  recent?: DiscoverSearchRecentRow[];
};

export const DISCOVER_SEARCH_MIN_QUERY = 2;

/** Destination used when opening a hit — map focus kinds land on /game. */
export function discoverHitHref(
  hit: Pick<DiscoverSearchHit, 'kind' | 'href'>,
): string | null {
  if (hit.href) return hit.href;
  if (hit.kind === 'place' || hit.kind === 'school') return '/game';
  return null;
}

/** Stable section order on Discover results. */
export const DISCOVER_SEARCH_SECTION_ORDER: DiscoverSearchKind[] = [
  'page',
  'territory',
  'atlas_feature',
  'atlas_collection',
  'place',
  'experience_zone',
  'post',
  'account',
];

export const DISCOVER_SEARCH_SECTION_LABELS: Record<DiscoverSearchKind, string> = {
  page: 'Pages',
  territory: 'Territories',
  atlas_feature: 'Atlas',
  atlas_collection: 'Atlas',
  place: 'Places',
  experience_zone: 'Experience zones',
  school: 'Schools',
  post: 'Posts',
  account: 'People',
};
