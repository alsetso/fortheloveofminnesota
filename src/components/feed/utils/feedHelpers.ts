import { FeedPostData } from '../FeedPost';

/**
 * Validate if a URL is safe for display
 * @param url - URL to validate
 * @returns Boolean indicating if URL is safe
 */
export function isSafeUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  // Reject blob URLs (temporary client-side)
  if (url.startsWith('blob:')) return false;
  // Only accept HTTP/HTTPS URLs
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Filter out invalid media URLs from post images
 * @param images - Array of image objects
 * @returns Filtered array of valid images
 */
export function filterValidMedia(
  images?: Array<{ url: string; filename: string; type?: string; thumbnail_url?: string }> | null
): Array<{ url: string; filename: string; type?: string; thumbnail_url?: string }> {
  if (!images || !Array.isArray(images)) return [];
  
  return images.filter(img => isSafeUrl(img?.url));
}

/**
 * Check if media item is a video
 * @param mediaItem - Media item to check
 * @returns Boolean indicating if it's a video
 */
export function isVideo(mediaItem: { type?: string }): boolean {
  return mediaItem.type === 'video' || mediaItem.type?.startsWith('video/') || false;
}

/**
 * Format location string for breadcrumbs
 * @param city - City name string
 * @param county - County name string
 * @param state - State name string
 * @returns Formatted location string
 */
export function formatLocationBreadcrumb(
  city?: string | null,
  county?: string | null,
  state?: string | null
): string {
  const parts: string[] = [];
  if (city) parts.push(city);
  if (county) parts.push(county);
  if (state) parts.push(state);
  return parts.join(', ');
}

/**
 * Get post URL - use post ID (simple schema doesn't have slugs)
 * @param post - Post data
 * @returns Post URL path
 * @deprecated Feed post detail page has been archived
 */
export function getPostUrl(post: Pick<FeedPostData, 'id' | 'slug'>): string {
  // Feed post detail page archived - return hash to prevent navigation
  return '#';
}

/**
 * Get profile URL from username
 * @param username - Profile username
 * @returns Profile URL path (deprecated - profiles removed)
 * @deprecated Profile pages have been removed
 */
export function getProfileUrl(username?: string | null): string {
  return '#';
}

/**
 * Validate post data structure
 * @param post - Post data to validate
 * @returns Boolean indicating if post is valid
 */
export function isValidPost(post: unknown): post is FeedPostData {
  return (
    post &&
    typeof post.id === 'string' &&
    typeof post.account_id === 'string' &&
    typeof post.content === 'string' &&
    typeof post.created_at === 'string'
  );
}

/**
 * Calculate media grid columns based on count
 * @param count - Number of media items
 * @returns Grid template columns CSS value
 */
export function getMediaGridColumns(count: number): string {
  if (count === 1) return '1fr';
  if (count === 2) return 'repeat(2, 1fr)';
  if (count === 3) return 'repeat(3, 1fr)';
  return 'repeat(2, 1fr)'; // 4+ items in 2x2 grid
}

/**
 * Truncate text to specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}






