/**
 * Utility functions for managing URL parameters related to guest/account state
 */

/**
 * Remove guest-related URL parameters
 * Call this when user logs in to clean up the URL
 */
export function removeGuestParams(router: any, searchParams?: URLSearchParams): void {
  if (typeof window === 'undefined') return;

  const currentParams = searchParams || new URLSearchParams(window.location.search);
  const hasGuestParams = currentParams.has('guest') || currentParams.has('guest_id');

  if (hasGuestParams) {
    const newParams = new URLSearchParams(currentParams);
    newParams.delete('guest');
    newParams.delete('guest_id');
    
    const newUrl = `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }
}

/**
 * Remove account-related URL parameters
 * Useful for cleaning up after account operations
 */
export function removeAccountParams(router: any, searchParams?: URLSearchParams): void {
  if (typeof window === 'undefined') return;

  const currentParams = searchParams || new URLSearchParams(window.location.search);
  const hasAccountParams = currentParams.has('account_id');

  if (hasAccountParams) {
    const newParams = new URLSearchParams(currentParams);
    newParams.delete('account_id');
    
    const newUrl = `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }
}

/**
 * Get guest ID from URL parameters
 */
export function getGuestIdFromUrl(searchParams: URLSearchParams): string | null {
  return searchParams.get('guest_id');
}

/**
 * Get account ID from URL parameters
 */
export function getAccountIdFromUrl(searchParams: URLSearchParams): string | null {
  return searchParams.get('account_id');
}

/**
 * Build URL with guest_id parameter
 */
export function buildGuestUrl(path: string, guestId: string): string {
  const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  url.searchParams.set('guest_id', guestId);
  return url.pathname + url.search;
}

/**
 * Build URL with account_id parameter
 */
export function buildAccountUrl(path: string, accountId: string): string {
  const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  url.searchParams.set('account_id', accountId);
  return url.pathname + url.search;
}

/**
 * Clean all guest/account parameters from URL
 * Use this when user authenticates
 */
export function cleanAuthParams(router: any, searchParams?: URLSearchParams): void {
  if (typeof window === 'undefined') return;

  const currentParams = searchParams || new URLSearchParams(window.location.search);
  const hasAuthParams = currentParams.has('guest') || 
                        currentParams.has('guest_id') || 
                        currentParams.has('account_id');

  if (hasAuthParams) {
    const newParams = new URLSearchParams(currentParams);
    newParams.delete('guest');
    newParams.delete('guest_id');
    newParams.delete('account_id');
    
    const newUrl = `${window.location.pathname}${newParams.toString() ? `?${newParams.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }
}

