import type { LaunchPageTypeSlug } from '@/lib/directory/pageTypes';

/** Parent buckets that own child categories in `page.categories`. */
export const PAGE_CATEGORY_PARENTS = [
  'local-business',
  'public-figure',
  'community',
  'event',
] as const;

export type PageCategoryParent = (typeof PAGE_CATEGORY_PARENTS)[number];

export type PageCategoryParentConfig = {
  label: string;
  placeholder: string;
  hint: string;
  clearLabel: string;
};

export const PAGE_CATEGORY_PARENT_CONFIG: Record<
  PageCategoryParent,
  PageCategoryParentConfig
> = {
  'local-business': {
    label: 'What kind of business?',
    placeholder: 'Search — e.g. Coffee Shop, Salon, Auto Repair',
    hint: 'Search an existing type or add your own.',
    clearLabel: 'Clear business type',
  },
  'public-figure': {
    label: 'What kind of public figure?',
    placeholder: 'Search — e.g. Musician, Author, Influencer',
    hint: 'Search an existing type or add your own.',
    clearLabel: 'Clear category',
  },
  community: {
    label: 'What kind of community place?',
    placeholder: 'Search — e.g. Park, Church, Lake, Trail',
    hint: 'Search an existing type or add your own.',
    clearLabel: 'Clear community type',
  },
  event: {
    label: 'What kind of event?',
    placeholder: 'Search — e.g. Festival, Farmers Market, Concert',
    hint: 'Search an existing type or add your own.',
    clearLabel: 'Clear event type',
  },
};

export function isPageCategoryParent(value: string): value is PageCategoryParent {
  return (PAGE_CATEGORY_PARENTS as readonly string[]).includes(value);
}

/** Map stored page_type → category parent bucket for the subtype picker. */
export function categoryParentForPageType(
  pageType: string | null | undefined,
): PageCategoryParent | null {
  if (!pageType) return null;
  if (isPageCategoryParent(pageType)) return pageType;
  if (pageType === 'business' || pageType === 'cannabis') return 'local-business';
  if (pageType === 'entertainment') return 'event';
  if (pageType === 'organization' || pageType === 'company-organization') {
    return 'community';
  }
  return null;
}

/** Launch page types are the same parent buckets. */
export function launchTypeIsCategoryParent(
  value: LaunchPageTypeSlug,
): value is PageCategoryParent {
  return isPageCategoryParent(value);
}
