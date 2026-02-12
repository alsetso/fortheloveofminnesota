/**
 * Draft/Unpublished Pages Configuration
 * 
 * Pages listed here will:
 * 1. Be marked with noindex/nofollow robots meta (via generateDraftMetadata)
 * 2. Optionally be blocked from access via middleware (if enabled)
 * 3. Show up in admin dashboard as "draft" status
 * 
 * To mark a page as draft:
 * 1. Add the route path to DRAFT_ROUTES below
 * 2. Use generateDraftMetadata() in the page's metadata export
 * 3. Optionally enable middleware blocking for production
 */

export const DRAFT_ROUTES = [
  // Add routes that aren't ready for publication
  // Example: '/marketplace',
  // Example: '/stories',
  // Example: '/feed',
] as const;

export type DraftRoute = typeof DRAFT_ROUTES[number];

/**
 * Check if a route is marked as draft/unpublished
 */
export function isDraftRoute(pathname: string): boolean {
  return DRAFT_ROUTES.some(route => {
    // Exact match
    if (pathname === route) return true;
    // Prefix match (e.g., /marketplace/items matches /marketplace)
    if (pathname.startsWith(route + '/')) return true;
    return false;
  });
}

/**
 * Configuration for draft page behavior
 */
export const DRAFT_CONFIG = {
  // Block access to draft pages in production (via middleware)
  blockInProduction: false,
  
  // Allow access in development/staging
  allowInDevelopment: true,
  
  // Show draft banner on page
  showDraftBanner: true,
} as const;
