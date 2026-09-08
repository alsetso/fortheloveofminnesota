/**
 * Directory page types — keep in sync with web `apps/web/src/lib/directory/pageTypes.ts`
 * and the `page.pages.page_type` CHECK constraint.
 */

/**
 * Types shown in the public create-page (launch) flow.
 * These are also the category parent buckets in `page.categories`.
 */
export const LAUNCH_PAGE_TYPES = [
  { slug: 'local-business', name: 'Local Business' },
  { slug: 'public-figure', name: 'Public Figure' },
  { slug: 'community', name: 'Community' },
  { slug: 'event', name: 'Event' },
] as const;

/** Short copy for the create-page type picker. */
export const LAUNCH_PAGE_TYPE_META: Record<
  (typeof LAUNCH_PAGE_TYPES)[number]['slug'],
  { description: string }
> = {
  'local-business': { description: 'Shop, restaurant, service, or storefront' },
  'public-figure': { description: 'Person, artist, band, or creator' },
  community: { description: 'Park, church, club, or neighborhood place' },
  event: { description: 'Festival, market, show, or gathering' },
};

/** User-created directory types (isolatable from entity-backed civic pages). */
export const USER_GENERATED_PAGE_TYPES = [
  ...LAUNCH_PAGE_TYPES,
  { slug: 'business', name: 'Business' },
  { slug: 'organization', name: 'Organization' },
  { slug: 'company-organization', name: 'Organization' },
  { slug: 'entertainment', name: 'Event' },
  { slug: 'cannabis', name: 'Cannabis Retailer' },
] as const;

export const USER_GENERATED_PAGE_TYPE_SLUGS = USER_GENERATED_PAGE_TYPES.map(
  (t) => t.slug,
) as string[];

/** Include every known UG slug when filtering live rows. */
export const USER_GENERATED_PAGE_TYPE_FILTER = [
  ...new Set(USER_GENERATED_PAGE_TYPE_SLUGS),
] as string[];

export type LaunchPageTypeSlug = (typeof LAUNCH_PAGE_TYPES)[number]['slug'];

export type UserGeneratedPageTypeSlug =
  (typeof USER_GENERATED_PAGE_TYPES)[number]['slug'];

const NAME_BY_SLUG: Record<string, string> = Object.fromEntries(
  USER_GENERATED_PAGE_TYPES.map((t) => [t.slug, t.name]),
);

export function pageTypeName(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return (
    NAME_BY_SLUG[slug] ??
    slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function isUserGeneratedPageType(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return USER_GENERATED_PAGE_TYPE_FILTER.includes(slug);
}

export function isLaunchPageType(slug: string | null | undefined): slug is LaunchPageTypeSlug {
  if (!slug) return false;
  return (LAUNCH_PAGE_TYPES as readonly { slug: string }[]).some((t) => t.slug === slug);
}

/** True when a string is usable as a Mapbox / img logo URL. */
export function isPageLogoHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}
