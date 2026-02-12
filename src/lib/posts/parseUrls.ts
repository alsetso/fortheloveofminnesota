/**
 * Utility functions for parsing URLs from post content
 */

/**
 * Common TLDs to match
 * Includes common domains: .com, .dev, .ai, .gov, .org, .net, .io, .co, etc.
 */
const COMMON_TLDS = [
  'com', 'dev', 'ai', 'gov', 'org', 'net', 'io', 'co', 'edu', 'mil',
  'us', 'uk', 'ca', 'au', 'de', 'fr', 'jp', 'cn', 'in', 'br',
  'mx', 'ru', 'kr', 'it', 'es', 'nl', 'se', 'no', 'pl', 'tr',
  'info', 'biz', 'name', 'tv', 'me', 'cc', 'ws', 'mobi', 'app',
  'tech', 'online', 'site', 'website', 'store', 'shop', 'blog',
  'xyz', 'top', 'space', 'cloud', 'digital', 'media', 'news'
];

/**
 * Build regex pattern for URL detection
 * Matches:
 * - URLs with protocol: http://example.com, https://example.com
 * - URLs without protocol: www.example.com, example.com
 * - URLs with paths: example.com/path, example.com/path?query=1
 */
export function buildUrlRegex(): RegExp {
  // Escape special regex characters in TLDs
  const tldPattern = COMMON_TLDS.map(tld => tld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  
  // Pattern breakdown:
  // (?:https?:\/\/)? - Optional protocol (http:// or https://)
  // (?:www\.)? - Optional www.
  // [a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])? - Domain name (1-63 chars, alphanumeric and hyphens)
  // (?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)* - Optional subdomains
  // \\.(?:${tldPattern}) - TLD from our list
  // (?::[0-9]{1,5})? - Optional port
  // (?:\/[^\\s@]*)? - Optional path/query/fragment (non-whitespace, non-@)
  // Word boundary check: ensure URL is not part of another word
  
  // Match URLs that are:
  // - At start of string or after whitespace/punctuation
  // - Before whitespace/punctuation or end of string
  const pattern = `(?:^|[^\\w@])((?:https?:\\/\\/)?(?:www\\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\\.(?:${tldPattern})(?::[0-9]{1,5})?(?:\\/[^\\s@]*)?)(?=[^\\w]|$)`;
  
  return new RegExp(pattern, 'gi');
}

/**
 * Extract URLs from text content
 * @param content - The text content to parse
 * @returns Array of URLs found in the content
 */
export function extractUrls(content: string): string[] {
  if (!content) return [];
  
  const urlRegex = buildUrlRegex();
  const matches = content.matchAll(urlRegex);
  const urls = new Set<string>();
  
  for (const match of matches) {
    // match[1] is the captured URL (group 1), match[0] includes the preceding character
    const url = match[1] || match[0];
    // Don't include URLs that are part of mentions (e.g., @username.com)
    const beforeMatch = content.substring(Math.max(0, match.index! - 1), match.index!);
    if (!beforeMatch.endsWith('@')) {
      urls.add(url);
    }
  }
  
  return Array.from(urls);
}

/**
 * Normalize URL - add protocol if missing
 * @param url - The URL to normalize
 * @returns Normalized URL with protocol
 */
export function normalizeUrl(url: string): string {
  // Remove trailing punctuation that might have been included
  const cleaned = url.replace(/[.,;:!?]+$/, '');
  
  // If URL already has protocol, return as-is
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  
  // Add https:// protocol
  return `https://${cleaned}`;
}

/**
 * Check if a string is a valid URL
 * @param url - The string to check
 * @returns True if the string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url);
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}
