/** Matches EditProfileForm: visible when `search_visibility !== false`. */
export const ACCOUNT_SEARCH_VISIBILITY_FILTER =
  'search_visibility.is.null,search_visibility.eq.true';

export function isAccountVisibleInSearch(
  searchVisibility: boolean | null | undefined,
): boolean {
  return searchVisibility !== false;
}
